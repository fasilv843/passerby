import { Device, type types } from "mediasoup-client";
import { preferredSpatialLayer, SIMULCAST_ENCODINGS } from "../../media/simulcast";
import type { MediaKind, PeerInfo, ProducerInfo, TransportDirection } from "../../types/group";
import { Store } from "../store";
import { connectGroupSignaling, GroupRequestError } from "./groupSignaling";
import type { GroupSignaling } from "./groupSignaling";

/** Someone else in the room, as the UI shows them. */
export interface GroupParticipant {
  peerId: string;
  displayName: string;
  /** Their audio and video tracks. A new stream object whenever the tracks change. */
  stream: MediaStream | null;
  micOff: boolean;
  cameraOff: boolean;
}

export interface GroupCallState {
  status: "joining" | "joined" | "failed";
  /** Why joining failed, in words for the user. */
  error: string | null;
  /** Everyone else, in the order they joined. */
  participants: GroupParticipant[];
  micOn: boolean;
  cameraOn: boolean;
}

const INITIAL_STATE: GroupCallState = {
  status: "joining",
  error: null,
  participants: [],
  micOn: false,
  cameraOn: false,
};

export interface GroupCallOptions {
  roomId: string;
  displayName: string;
  /** Null joins as a listener: nothing is sent. */
  localStream: MediaStream | null;
  /** Injectable for tests. */
  connect?: () => GroupSignaling;
  createDevice?: () => Promise<Device>;
}

/** What we know about another person: their tracks and which ones are paused. */
interface RemotePeer {
  displayName: string;
  tracks: Partial<Record<MediaKind, MediaStreamTrack>>;
  paused: Record<MediaKind, boolean>;
  stream: MediaStream | null;
}

interface ConsumerEntry {
  consumer: types.Consumer;
  peerId: string;
  producerId: string;
  kind: MediaKind;
}

/**
 * One group call through the SFU, using mediasoup-client:
 *
 *   join → load Device → send transport (produce mic + camera with simulcast)
 *                       → recv transport (consume everyone else's tracks)
 *
 * No React here; the useGroupCall hook renders its state.
 */
export class GroupCallController extends Store<GroupCallState> {
  private readonly options: GroupCallOptions;
  private signaling: GroupSignaling | null = null;
  private device: Device | null = null;
  private sendTransport: types.Transport | null = null;
  private readonly recvTransport = deferred<types.Transport>();
  private readonly producers = new Map<MediaKind, types.Producer>();
  private readonly consumers = new Map<string, ConsumerEntry>();
  /** Producer ids already being consumed, so one announced twice is consumed once. */
  private readonly consumedProducers = new Set<string>();
  private readonly peers = new Map<string, RemotePeer>();
  private closed = false;

  constructor(options: GroupCallOptions) {
    super(INITIAL_STATE);
    this.options = options;
  }

  // ---- lifecycle ----

  async start() {
    if (this.signaling || this.closed) return;
    const signaling = (this.options.connect ?? connectGroupSignaling)();
    this.signaling = signaling;
    // Listen before joining: events can arrive while setup is still running.
    this.listen(signaling);

    try {
      const join = await signaling.request("join", {
        roomId: this.options.roomId,
        displayName: this.options.displayName,
      });
      if (this.closed) return;

      const device = await (this.options.createDevice ?? (() => Device.factory()))();
      await device.load({ routerRtpCapabilities: join.routerRtpCapabilities });
      this.device = device;

      join.peers.forEach((peer) => this.addPeer(peer));

      // Sending and receiving don't depend on each other: set both up at once.
      await Promise.all([
        this.startSending(join.iceServers),
        this.createTransport("recv", join.iceServers).then((transport) => this.recvTransport.resolve(transport)),
      ]);
      await Promise.all(join.producers.map((producer) => this.consume(producer)));

      if (!this.closed) this.setState({ status: "joined" });
    } catch (err) {
      if (!this.closed) this.setState({ status: "failed", error: describeError(err) });
    }
  }

  /** Leaves the room. The local camera stays on; it belongs to whoever opened it. */
  stop() {
    if (this.closed) return;
    this.closed = true;
    this.sendTransport?.close();
    this.recvTransport.current?.close();
    this.signaling?.disconnect();
    this.signaling = null;
  }

  // ---- user actions ----

  toggleMic() {
    void this.togglePaused("audio", "micOn");
  }

  toggleCamera() {
    void this.togglePaused("video", "cameraOn");
  }

  // ---- sending ----

  private async startSending(iceServers: RTCIceServer[]) {
    const stream = this.options.localStream;
    if (!stream) return;

    const transport = await this.createTransport("send", iceServers);
    this.sendTransport = transport;

    // mediasoup-client asks us to tell the server about each new track.
    transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
      this.request("produce", { transportId: transport.id, kind, rtpParameters })
        .then(({ producerId }) => callback({ id: producerId }))
        .catch(errback);
    });

    const [audio] = stream.getAudioTracks();
    const [video] = stream.getVideoTracks();
    // stopTracks: false, because the camera is shared with the local preview.
    if (audio) this.producers.set("audio", await transport.produce({ track: audio, stopTracks: false }));
    if (video) {
      this.producers.set(
        "video",
        await transport.produce({
          track: video,
          stopTracks: false,
          encodings: SIMULCAST_ENCODINGS,
          codecOptions: { videoGoogleStartBitrate: 1000 },
        })
      );
    }
    this.setState({ micOn: Boolean(audio), cameraOn: Boolean(video) });
  }

  private async togglePaused(kind: MediaKind, flag: "micOn" | "cameraOn") {
    const producer = this.producers.get(kind);
    if (!producer || this.closed) return;
    const paused = !producer.paused;
    if (paused) producer.pause();
    else producer.resume();
    this.setState({ [flag]: !paused });
    try {
      await this.request("setProducerPaused", { producerId: producer.id, paused });
    } catch (err) {
      console.warn("[group] couldn't update the server", err);
    }
  }

  // ---- receiving ----

  private async consume(info: ProducerInfo) {
    if (this.closed || this.consumedProducers.has(info.producerId)) return;
    this.consumedProducers.add(info.producerId);

    try {
      const transport = await this.recvTransport.promise;
      const params = await this.request("consume", {
        transportId: transport.id,
        producerId: info.producerId,
        rtpCapabilities: this.device!.rtpCapabilities,
      });
      const consumer = await transport.consume({
        id: params.consumerId,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
      });
      if (this.closed) return;

      this.consumers.set(consumer.id, { consumer, peerId: params.peerId, producerId: params.producerId, kind: params.kind });
      this.updatePeer(params.peerId, (peer) => {
        peer.tracks[params.kind] = consumer.track;
        peer.paused[params.kind] = params.producerPaused;
      });

      // The server creates consumers paused so no packets arrive before we're ready.
      await this.request("resumeConsumer", { consumerId: consumer.id });
      if (params.kind === "video") this.requestLayer(consumer.id);
    } catch (err) {
      console.warn("[group] couldn't receive a track", err);
    }
  }

  /** Asks the SFU for the simulcast layer that suits the current number of tiles. */
  private requestLayer(consumerId: string) {
    const spatialLayer = preferredSpatialLayer(this.peers.size);
    this.request("setPreferredLayer", { consumerId, spatialLayer }).catch((err) =>
      console.warn("[group] couldn't set layer", err)
    );
  }

  private updateAllLayers() {
    this.consumers.forEach((entry, consumerId) => {
      if (entry.kind === "video") this.requestLayer(consumerId);
    });
  }

  // ---- server events ----

  private listen(signaling: GroupSignaling) {
    signaling.on("peerJoined", (peer) => {
      this.addPeer(peer);
      this.updateAllLayers();
    });
    signaling.on("peerLeft", ({ peerId }) => {
      this.removePeer(peerId);
      this.updateAllLayers();
    });
    signaling.on("newProducer", (producer) => void this.consume(producer));
    signaling.on("producerPaused", ({ producerId, paused }) => {
      const entry = [...this.consumers.values()].find((c) => c.producerId === producerId);
      if (entry) this.updatePeer(entry.peerId, (peer) => (peer.paused[entry.kind] = paused));
    });
    signaling.on("consumerClosed", ({ consumerId }) => this.closeConsumer(consumerId));
  }

  private closeConsumer(consumerId: string) {
    const entry = this.consumers.get(consumerId);
    if (!entry) return;
    entry.consumer.close();
    this.consumers.delete(consumerId);
    this.consumedProducers.delete(entry.producerId);
    this.updatePeer(entry.peerId, (peer) => delete peer.tracks[entry.kind]);
  }

  // ---- participants ----

  private addPeer({ peerId, displayName }: PeerInfo) {
    if (this.peers.has(peerId)) return;
    this.peers.set(peerId, { displayName, tracks: {}, paused: { audio: false, video: false }, stream: null });
    this.publishParticipants();
  }

  private removePeer(peerId: string) {
    this.consumers.forEach((entry, consumerId) => {
      if (entry.peerId === peerId) this.closeConsumer(consumerId);
    });
    this.peers.delete(peerId);
    this.publishParticipants();
  }

  /** Changes one peer's tracks or pause flags, then rebuilds its stream and the participant list. */
  private updatePeer(peerId: string, change: (peer: RemotePeer) => void) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    const tracksBefore = Object.values(peer.tracks);
    change(peer);
    const tracksAfter = Object.values(peer.tracks);
    const tracksChanged =
      tracksBefore.length !== tracksAfter.length || tracksBefore.some((track, i) => track !== tracksAfter[i]);
    if (tracksChanged) peer.stream = tracksAfter.length ? new MediaStream(tracksAfter) : null;
    this.publishParticipants();
  }

  private publishParticipants() {
    if (this.closed) return;
    const participants = [...this.peers].map(([peerId, peer]) => ({
      peerId,
      displayName: peer.displayName,
      stream: peer.stream,
      micOff: !peer.tracks.audio || peer.paused.audio,
      cameraOff: !peer.tracks.video || peer.paused.video,
    }));
    this.setState({ participants });
  }

  // ---- helpers ----

  private async createTransport(direction: TransportDirection, iceServers: RTCIceServer[]): Promise<types.Transport> {
    const params = await this.request("createTransport", { direction });
    const options = { ...params, iceServers };
    const transport =
      direction === "send" ? this.device!.createSendTransport(options) : this.device!.createRecvTransport(options);

    // Fires once, when the transport first sends or receives: finish DTLS setup on the server.
    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      this.request("connectTransport", { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });
    return transport;
  }

  private request: GroupSignaling["request"] = (event, ...payload) => {
    if (!this.signaling) return Promise.reject(new GroupRequestError("Not connected"));
    return this.signaling.request(event, ...payload);
  };
}

function describeError(err: unknown): string {
  if (err instanceof GroupRequestError) return err.message;
  if (err instanceof Error && err.name === "UnsupportedError") {
    return "This browser doesn't support group calls. Try a recent Chrome, Firefox or Safari.";
  }
  console.error("[group] join failed", err);
  return "Couldn't join the room. Please try again.";
}

/** A promise that's resolved from outside, plus the value once it is. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const result = {
    current: null as T | null,
    promise: new Promise<T>((r) => (resolve = r)),
    resolve: (value: T) => {
      result.current = value;
      resolve(value);
    },
  };
  return result;
}
