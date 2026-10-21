import type { SignalMessage } from "../types/signaling";
import { sortCodecs, videoCodecOrder } from "../media/codecs";
import { tuneOpus } from "../media/opus";
import { createStatsSummarizer } from "../media/stats";
import type { CallStats } from "../media/stats";
import { initialAdaptationState, nextAdaptationState, QUALITY_LEVELS } from "../media/adaptation";
import type { AdaptationState } from "../media/adaptation";
import type { MediaSettings } from "../media/settings";
import { MAX_CHAT_LENGTH, newId, parseChatWireMessage } from "../types/chat";
import type { ChatWireMessage } from "../types/chat";

interface PeerSessionOptions {
  roomId: string;
  polite: boolean;
  iceServers: RTCIceServer[];
  localStream: MediaStream | null;
  settings: MediaSettings;
  sendSignal: (message: SignalMessage) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  /** Called every few seconds while connected; null when the connection fails. */
  onStats: (stats: CallStats | null) => void;
  onChatMessage: (message: ChatWireMessage) => void;
  onChatOpenChange: (open: boolean) => void;
}

/** How long a "disconnected" connection may stay that way before we restart ICE. */
const DISCONNECT_GRACE_MS = 4000;
const STATS_INTERVAL_MS = 3000;

type NetworkInformationLike = EventTarget;

/**
 * One RTCPeerConnection for one match.
 *
 * Negotiation follows the "perfect negotiation" pattern
 * (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example):
 * both peers add tracks and react to `negotiationneeded` the same way.
 * If both send an offer at once, the impolite peer ignores the incoming
 * offer and the polite peer rolls back its own and answers instead.
 */
export class PeerSession {
  readonly roomId: string;
  private readonly polite: boolean;
  private readonly pc: RTCPeerConnection;
  private readonly opts: PeerSessionOptions;

  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  /** Candidates that arrive before the remote description is set. */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private closed = false;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fallbackRemoteStream = new MediaStream();
  private readonly chat: RTCDataChannel;

  private readonly summarizeStats = createStatsSummarizer();
  private videoSender: RTCRtpSender | null = null;
  private adaptation: AdaptationState = initialAdaptationState;
  /** Quality level currently set on the video sender, or -1 before the first apply. */
  private appliedLevel = -1;

  constructor(opts: PeerSessionOptions) {
    this.opts = opts;
    this.roomId = opts.roomId;
    this.polite = opts.polite;
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers });

    this.pc.ontrack = this.handleTrack;
    this.pc.onicecandidate = this.handleIceCandidate;
    this.pc.onnegotiationneeded = this.handleNegotiationNeeded;
    this.pc.onconnectionstatechange = this.handleConnectionStateChange;

    // addTrack() creates exactly one sendrecv transceiver per track.
    // (Calling addTransceiver() first and then addTrack() created a second,
    // unused audio and video section in every SDP.)
    const stream = opts.localStream;
    stream?.getTracks().forEach((track) => {
      const sender = this.pc.addTrack(track, stream);
      if (track.kind === "video") this.videoSender = sender;
    });
    this.applyVideoCodecPreferences();

    // Text chat runs peer to peer over SCTP inside the same DTLS connection.
    // `negotiated: true` with a fixed id means both peers create the channel
    // themselves, so there's no "who opens it" race and no ondatachannel handler.
    // In text-only mode this channel is the only thing in the SDP.
    this.chat = this.pc.createDataChannel("chat", { negotiated: true, id: 0, ordered: true });
    this.chat.onopen = () => opts.onChatOpenChange(true);
    this.chat.onclose = () => opts.onChatOpenChange(false);
    this.chat.onmessage = ({ data }) => {
      const message = parseChatWireMessage(data);
      if (message) opts.onChatMessage(message);
    };

    window.addEventListener("online", this.handleNetworkChange);
    this.networkInfo()?.addEventListener("change", this.handleNetworkChange);
  }

  /** Apply a description or candidate received from the other peer. */
  async handleSignal({ description, candidate }: SignalMessage) {
    if (this.closed) return;

    try {
      if (description) {
        const readyForOffer =
          !this.makingOffer &&
          (this.pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
        const offerCollision = description.type === "offer" && !readyForOffer;

        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) {
          console.info("[peer] ignoring colliding offer (impolite peer)");
          return;
        }

        this.isSettingRemoteAnswerPending = description.type === "answer";
        // Opus FEC/DTX: see media/opus.ts for why the *remote* description is edited.
        const remote = description.sdp
          ? { ...description, sdp: tuneOpus(description.sdp, { fec: this.opts.settings.opusFec, dtx: this.opts.settings.opusDtx }) }
          : description;
        // For the polite peer, this implicitly rolls back its own pending offer.
        await this.pc.setRemoteDescription(remote);
        this.isSettingRemoteAnswerPending = false;
        await this.flushPendingCandidates();

        if (description.type === "offer") {
          await this.pc.setLocalDescription();
          this.send({ description: this.pc.localDescription!.toJSON() });
        }
      } else if (candidate) {
        if (!this.pc.remoteDescription) {
          this.pendingCandidates.push(candidate);
          return;
        }
        await this.addCandidate(candidate);
      }
    } catch (err) {
      console.error("[peer] failed to handle signal", err);
    }
  }

  /** Sends a chat message. Returns it, or null if the channel isn't open. */
  sendChat(text: string): Extract<ChatWireMessage, { type: "message" }> | null {
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!trimmed) return null;
    const message = { type: "message" as const, id: newId(), text: trimmed, sentAt: Date.now() };
    return this.sendOnChannel(message) ? message : null;
  }

  sendTyping(active: boolean) {
    this.sendOnChannel({ type: "typing", active });
  }

  /** Tells the other person we're leaving, before the server's "lobby" event reaches them. */
  sendBye() {
    this.sendOnChannel({ type: "bye" });
  }

  get chatOpen() {
    return this.chat.readyState === "open";
  }

  /**
   * Gathers new candidates and renegotiates on the existing connection.
   * Used when the connection fails or the device's network changes
   * (e.g. Wi-Fi to mobile data). Triggers `negotiationneeded`.
   */
  restartIce() {
    if (this.closed) return;
    console.info("[peer] restarting ICE");
    this.pc.restartIce();
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    this.stopStatsPolling();
    this.clearDisconnectTimer();
    window.removeEventListener("online", this.handleNetworkChange);
    this.networkInfo()?.removeEventListener("change", this.handleNetworkChange);

    this.pc.ontrack = null;
    this.pc.onicecandidate = null;
    this.pc.onnegotiationneeded = null;
    this.pc.onconnectionstatechange = null;
    this.chat.onopen = null;
    this.chat.onclose = null;
    this.chat.onmessage = null;
    this.chat.close();
    // Closing the connection stops the senders; the local camera stays on for the next match.
    this.pc.close();
  }

  private sendOnChannel(message: ChatWireMessage): boolean {
    if (this.closed || this.chat.readyState !== "open") return false;
    try {
      this.chat.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.warn("[peer] chat send failed", err);
      return false;
    }
  }

  private send(message: Omit<SignalMessage, "roomId">) {
    if (this.closed) return;
    this.opts.sendSignal({ roomId: this.roomId, ...message });
  }

  private handleTrack = ({ track, streams }: RTCTrackEvent) => {
    const stream = streams[0] ?? this.fallbackRemoteStream;
    if (!streams[0]) stream.addTrack(track);
    this.opts.onRemoteStream(stream);
  };

  private handleIceCandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
    // A null candidate only marks the end of gathering; nothing to send.
    if (candidate) this.send({ candidate: candidate.toJSON() });
  };

  private handleNegotiationNeeded = async () => {
    try {
      this.makingOffer = true;
      // With no argument, this creates the right description (offer) for the current state.
      await this.pc.setLocalDescription();
      this.send({ description: this.pc.localDescription!.toJSON() });
    } catch (err) {
      console.error("[peer] negotiation failed", err);
    } finally {
      this.makingOffer = false;
    }
  };

  private handleConnectionStateChange = () => {
    const state = this.pc.connectionState;
    this.opts.onConnectionStateChange(state);

    if (state === "connected") {
      this.clearDisconnectTimer();
      this.startStatsPolling();
    } else if (state === "disconnected") {
      // Often recovers by itself within a few seconds; restart only if it doesn't.
      this.clearDisconnectTimer();
      this.disconnectTimer = setTimeout(() => {
        if (this.pc.connectionState === "disconnected") this.restartIce();
      }, DISCONNECT_GRACE_MS);
    } else if (state === "failed") {
      this.stopStatsPolling();
      this.opts.onStats(null);
      this.restartIce();
    }
  };

  private handleNetworkChange = () => {
    // A new network means new local candidates; the old pair is likely dead.
    if (this.pc.connectionState === "new" || this.pc.connectionState === "closed") return;
    this.restartIce();
  };

  private async addCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      // Candidates for an offer we ignored are expected to fail.
      if (!this.ignoreOffer) throw err;
    }
  }

  private async flushPendingCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      await this.addCandidate(candidate);
    }
  }

  private startStatsPolling() {
    if (this.statsTimer) return;
    const poll = async () => {
      if (this.closed) return;
      try {
        const stats = this.summarizeStats(await this.pc.getStats());
        if (this.closed) return;
        await this.adaptVideoQuality(stats);
        const level = QUALITY_LEVELS[this.adaptation.level];
        this.opts.onStats(
          this.videoSender
            ? { ...stats, quality: { label: level.label, level: this.adaptation.level, adaptive: this.opts.settings.adaptiveQuality } }
            : stats
        );
      } catch (err) {
        console.warn("[peer] getStats failed", err);
      }
    };
    poll();
    this.statsTimer = setInterval(poll, STATS_INTERVAL_MS);
  }

  /**
   * Orders the codecs we're willing to receive. The other side encodes with
   * the first one in our description that it supports.
   */
  private applyVideoCodecPreferences() {
    const capabilities = typeof RTCRtpReceiver.getCapabilities === "function"
      ? RTCRtpReceiver.getCapabilities("video")
      : null;
    if (!capabilities) return;
    const order = videoCodecOrder(this.opts.settings.preferredVideoCodec);
    const codecs = sortCodecs(capabilities.codecs, order);

    for (const transceiver of this.pc.getTransceivers()) {
      if (transceiver.receiver.track.kind !== "video") continue;
      if (typeof transceiver.setCodecPreferences !== "function") return; // older browsers
      try {
        transceiver.setCodecPreferences(codecs);
      } catch (err) {
        console.warn("[peer] setCodecPreferences failed", err);
      }
    }
  }

  /**
   * Steps video bitrate and resolution down on sustained loss or latency,
   * and back up when the network recovers. See media/adaptation.ts.
   */
  private async adaptVideoQuality(stats: CallStats) {
    if (!this.videoSender) return;
    if (this.opts.settings.adaptiveQuality) {
      this.adaptation = nextAdaptationState(this.adaptation, {
        lossPct: stats.video.send?.remoteLossPct,
        rttMs: stats.rttMs,
        availableKbps: stats.availableOutgoingKbps,
      });
    }
    if (this.adaptation.level === this.appliedLevel) return;

    const params = this.videoSender.getParameters();
    if (!params.encodings?.length) return; // not negotiated yet; try on the next poll
    const level = QUALITY_LEVELS[this.adaptation.level];
    params.encodings[0].maxBitrate = level.maxBitrateKbps * 1000;
    params.encodings[0].scaleResolutionDownBy = level.scaleResolutionDownBy;
    try {
      await this.videoSender.setParameters(params);
      if (this.appliedLevel !== -1) console.info(`[peer] video quality → ${level.label}`);
      this.appliedLevel = this.adaptation.level;
    } catch (err) {
      console.warn("[peer] setParameters failed", err);
    }
  }

  private stopStatsPolling() {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }

  /** Network Information API (Chrome, Android); absent in Safari and Firefox. */
  private networkInfo(): NetworkInformationLike | undefined {
    return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  }
}
