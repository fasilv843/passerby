import type { ConnectionPath, SignalMessage } from "../types/signaling";
import { MAX_CHAT_LENGTH, newId, parseChatWireMessage } from "../types/chat";
import type { ChatWireMessage } from "../types/chat";

interface PeerSessionOptions {
  roomId: string;
  polite: boolean;
  iceServers: RTCIceServer[];
  localStream: MediaStream | null;
  sendSignal: (message: SignalMessage) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onPathChange: (path: ConnectionPath | null) => void;
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
    stream?.getTracks().forEach((track) => this.pc.addTrack(track, stream));

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
        // For the polite peer, this implicitly rolls back its own pending offer.
        await this.pc.setRemoteDescription(description);
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

  /** Reads the selected candidate pair and reports whether media is direct or relayed. */
  async getConnectionPath(): Promise<ConnectionPath | null> {
    if (this.closed) return null;
    const stats = await this.pc.getStats();

    let pair: RTCIceCandidatePairStats | undefined;
    stats.forEach((report) => {
      // Chrome and Safari: the transport points at the selected pair.
      if (report.type === "transport" && report.selectedCandidatePairId) {
        pair = stats.get(report.selectedCandidatePairId);
      }
    });
    if (!pair) {
      stats.forEach((report) => {
        // Firefox marks the pair itself as selected.
        if (report.type === "candidate-pair" && (report.selected || report.nominated) && report.state === "succeeded") {
          pair = report;
        }
      });
    }
    if (!pair) return null;

    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    if (!local || !remote) return null;

    const isRelay = local.candidateType === "relay" || remote.candidateType === "relay";
    return {
      kind: isRelay ? "relay" : "direct",
      localType: local.candidateType,
      remoteType: remote.candidateType,
      protocol: local.protocol,
      relayProtocol: local.relayProtocol,
      rttMs:
        typeof pair.currentRoundTripTime === "number"
          ? Math.round(pair.currentRoundTripTime * 1000)
          : undefined,
    };
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
      this.opts.onPathChange(null);
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
      try {
        this.opts.onPathChange(await this.getConnectionPath());
      } catch (err) {
        console.warn("[peer] getStats failed", err);
      }
    };
    poll();
    this.statsTimer = setInterval(poll, STATS_INTERVAL_MS);
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
