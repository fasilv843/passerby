import type { types } from "mediasoup";
import type {
  ConsumerParams,
  MediaKind,
  PeerInfo,
  ProducerInfo,
  TransportDirection,
  TransportParams,
} from "../contracts/groupEvents";
import { GroupError } from "./groupError";
import { GroupPeer } from "./groupPeer";
import { MAX_INCOMING_BITRATE, ROUTER_MEDIA_CODECS, webRtcTransportOptions } from "./mediaConfig";

/** Lets the room tell a peer about things that happen on their own, like a consumer closing. */
export interface GroupNotifier {
  consumerClosed(peerId: string, consumerId: string): void;
}

/**
 * A group call: one mediasoup router and the people in it.
 * Knows nothing about Socket.IO; the handlers decide who to notify.
 */
export class GroupRoom {
  private readonly peers = new Map<string, GroupPeer>();

  private constructor(
    readonly id: string,
    private readonly router: types.Router,
    private readonly maxPeers: number,
    private readonly notifier: GroupNotifier
  ) {}

  static async create(id: string, worker: types.Worker, maxPeers: number, notifier: GroupNotifier) {
    const router = await worker.createRouter({ mediaCodecs: ROUTER_MEDIA_CODECS });
    return new GroupRoom(id, router, maxPeers, notifier);
  }

  get rtpCapabilities(): types.RtpCapabilities {
    return this.router.rtpCapabilities;
  }

  get size() {
    return this.peers.size;
  }

  // ---- membership ----

  addPeer(peerId: string, displayName: string): GroupPeer {
    if (this.peers.has(peerId)) throw new GroupError("Already in this room");
    if (this.peers.size >= this.maxPeers) throw new GroupError(`This room is full (${this.maxPeers} people max)`);
    const peer = new GroupPeer(peerId, displayName);
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId: string) {
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
  }

  /** Everyone except `exceptPeerId`. */
  peerInfos(exceptPeerId: string): PeerInfo[] {
    return [...this.peers.values()]
      .filter((peer) => peer.id !== exceptPeerId)
      .map(({ id, displayName }) => ({ peerId: id, displayName }));
  }

  /** Every track being sent, except by `exceptPeerId`. */
  producerInfos(exceptPeerId: string): ProducerInfo[] {
    return [...this.peers.values()]
      .filter((peer) => peer.id !== exceptPeerId)
      .flatMap((peer) => [...peer.producers.values()].map((producer) => toProducerInfo(peer.id, producer)));
  }

  // ---- transports ----

  async createTransport(peerId: string, direction: TransportDirection): Promise<TransportParams> {
    const peer = this.peer(peerId);
    const transport = await this.router.createWebRtcTransport({
      ...webRtcTransportOptions(),
      appData: { direction },
    });
    if (direction === "send") await transport.setMaxIncomingBitrate(MAX_INCOMING_BITRATE);
    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /** Completes the DTLS handshake setup with the browser's fingerprint. */
  async connectTransport(peerId: string, transportId: string, dtlsParameters: types.DtlsParameters) {
    await this.peer(peerId).transport(transportId).connect({ dtlsParameters });
  }

  // ---- sending ----

  async produce(
    peerId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: types.RtpParameters
  ): Promise<ProducerInfo> {
    const peer = this.peer(peerId);
    const producer = await peer.transport(transportId).produce({ kind, rtpParameters });
    peer.producers.set(producer.id, producer);
    producer.on("transportclose", () => peer.producers.delete(producer.id));
    return toProducerInfo(peerId, producer);
  }

  /** Camera or mic off/on. A paused producer stops forwarding to everyone. */
  async setProducerPaused(peerId: string, producerId: string, paused: boolean) {
    const producer = this.peer(peerId).producer(producerId);
    if (paused) await producer.pause();
    else await producer.resume();
  }

  // ---- receiving ----

  /**
   * Creates a consumer of another person's track. It starts paused: the
   * client resumes it once its side is ready, so no early packets are lost.
   */
  async consume(
    peerId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: types.RtpCapabilities
  ): Promise<ConsumerParams> {
    const peer = this.peer(peerId);
    const owner = this.ownerOf(producerId);
    if (!owner || owner.id === peerId) throw new GroupError("That track is no longer available");
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new GroupError("Your browser can't play this track's codec");
    }

    const consumer = await peer.transport(transportId).consume({ producerId, rtpCapabilities, paused: true });
    peer.consumers.set(consumer.id, consumer);

    const forget = () => peer.consumers.delete(consumer.id);
    consumer.on("transportclose", forget);
    consumer.on("producerclose", () => {
      forget();
      this.notifier.consumerClosed(peerId, consumer.id);
    });

    return {
      consumerId: consumer.id,
      producerId,
      peerId: owner.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerPaused: consumer.producerPaused,
    };
  }

  async resumeConsumer(peerId: string, consumerId: string) {
    await this.peer(peerId).consumer(consumerId).resume();
  }

  /**
   * Simulcast: which of the sender's three layers to forward (0 = smallest).
   * mediasoup still drops to a lower layer by itself if this viewer's bandwidth is short.
   */
  async setPreferredLayer(peerId: string, consumerId: string, spatialLayer: number) {
    const consumer = this.peer(peerId).consumer(consumerId);
    if (consumer.type !== "simulcast") return; // audio, or a sender without simulcast
    await consumer.setPreferredLayers({ spatialLayer, temporalLayer: 2 });
  }

  close() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.router.close();
  }

  private peer(peerId: string): GroupPeer {
    const peer = this.peers.get(peerId);
    if (!peer) throw new GroupError("Join the room first");
    return peer;
  }

  private ownerOf(producerId: string): GroupPeer | undefined {
    return [...this.peers.values()].find((peer) => peer.producers.has(producerId));
  }
}

const toProducerInfo = (peerId: string, producer: types.Producer): ProducerInfo => ({
  producerId: producer.id,
  peerId,
  kind: producer.kind,
  paused: producer.paused,
});
