import { applyVideoCodecPreferences } from "../../media/codecs";
import { tuneOpus } from "../../media/opus";
import type { MediaSettings } from "../../media/settings";
import type { CallStats } from "../../media/stats";
import type { ChatWireMessage } from "../../types/chat";
import type { SignalMessage } from "../../types/signaling";
import { ChatChannel } from "./chatChannel";
import { QualityMonitor } from "./qualityMonitor";

export interface PeerSessionOptions {
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

/**
 * One RTCPeerConnection for one match: negotiation and connection recovery.
 * Chat and stats/quality live in ChatChannel and QualityMonitor.
 *
 * Negotiation follows the "perfect negotiation" pattern
 * (https://w3c.github.io/webrtc-pc/#perfect-negotiation-example):
 * both peers add tracks and react to `negotiationneeded` the same way.
 * If both send an offer at once, the impolite peer ignores the incoming
 * offer and the polite peer rolls back its own and answers instead.
 */
export class PeerSession {
  readonly roomId: string;
  readonly chat: ChatChannel;

  private readonly opts: PeerSessionOptions;
  private readonly pc: RTCPeerConnection;
  private readonly quality: QualityMonitor;

  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  /** Candidates that arrive before the remote description is set. */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private closed = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fallbackRemoteStream = new MediaStream();

  constructor(opts: PeerSessionOptions) {
    this.opts = opts;
    this.roomId = opts.roomId;
    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers });

    this.pc.ontrack = this.handleTrack;
    this.pc.onicecandidate = this.handleIceCandidate;
    this.pc.onnegotiationneeded = this.handleNegotiationNeeded;
    this.pc.onconnectionstatechange = this.handleConnectionStateChange;

    // addTrack() creates exactly one sendrecv transceiver per track.
    const videoSender = this.addLocalTracks(opts.localStream);
    applyVideoCodecPreferences(this.pc, opts.settings.preferredVideoCodec);

    this.chat = new ChatChannel(this.pc, {
      onMessage: opts.onChatMessage,
      onOpenChange: opts.onChatOpenChange,
    });
    this.quality = new QualityMonitor(this.pc, videoSender, opts.settings.adaptiveQuality, opts.onStats);

    window.addEventListener("online", this.handleNetworkChange);
    networkInformation()?.addEventListener("change", this.handleNetworkChange);
  }

  /** Apply a description or candidate received from the other peer. */
  async handleSignal({ description, candidate }: SignalMessage) {
    if (this.closed) return;
    try {
      if (description) await this.handleDescription(description);
      else if (candidate) await this.handleCandidate(candidate);
    } catch (err) {
      console.error("[peer] failed to handle signal", err);
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;

    this.quality.stop();
    this.clearDisconnectTimer();
    window.removeEventListener("online", this.handleNetworkChange);
    networkInformation()?.removeEventListener("change", this.handleNetworkChange);

    this.pc.ontrack = null;
    this.pc.onicecandidate = null;
    this.pc.onnegotiationneeded = null;
    this.pc.onconnectionstatechange = null;
    this.chat.close();
    // Closing the connection stops the senders; the local camera stays on for the next match.
    this.pc.close();
  }

  private addLocalTracks(stream: MediaStream | null): RTCRtpSender | null {
    let videoSender: RTCRtpSender | null = null;
    stream?.getTracks().forEach((track) => {
      const sender = this.pc.addTrack(track, stream);
      if (track.kind === "video") videoSender = sender;
    });
    return videoSender;
  }

  private async handleDescription(description: RTCSessionDescriptionInit) {
    const readyForOffer =
      !this.makingOffer && (this.pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;

    this.ignoreOffer = !this.opts.polite && offerCollision;
    if (this.ignoreOffer) {
      console.info("[peer] ignoring colliding offer (impolite peer)");
      return;
    }

    this.isSettingRemoteAnswerPending = description.type === "answer";
    // For the polite peer, this implicitly rolls back its own pending offer.
    await this.pc.setRemoteDescription(this.withOpusSettings(description));
    this.isSettingRemoteAnswerPending = false;
    await this.flushPendingCandidates();

    if (description.type === "offer") {
      await this.pc.setLocalDescription();
      this.send({ description: this.pc.localDescription!.toJSON() });
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.addCandidate(candidate);
  }

  /** Opus FEC/DTX: see media/opus.ts for why the *remote* description is edited. */
  private withOpusSettings(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (!description.sdp) return description;
    const { opusFec: fec, opusDtx: dtx } = this.opts.settings;
    return { ...description, sdp: tuneOpus(description.sdp, { fec, dtx }) };
  }

  /**
   * Gathers new candidates and renegotiates on the existing connection.
   * Used when the connection fails or the device's network changes
   * (e.g. Wi-Fi to mobile data). Triggers `negotiationneeded`.
   */
  private restartIce() {
    if (this.closed) return;
    console.info("[peer] restarting ICE");
    this.pc.restartIce();
  }

  private send(message: Omit<SignalMessage, "roomId">) {
    if (!this.closed) this.opts.sendSignal({ roomId: this.roomId, ...message });
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
      // With no argument, this creates the right description (an offer) for the current state.
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

    switch (state) {
      case "connected":
        this.clearDisconnectTimer();
        this.quality.start();
        break;
      case "disconnected":
        // Often recovers by itself within a few seconds; restart only if it doesn't.
        this.clearDisconnectTimer();
        this.disconnectTimer = setTimeout(() => {
          if (this.pc.connectionState === "disconnected") this.restartIce();
        }, DISCONNECT_GRACE_MS);
        break;
      case "failed":
        this.quality.stop();
        this.opts.onStats(null);
        this.restartIce();
        break;
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

  private clearDisconnectTimer() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }
}

/** Network Information API (Chrome, Android); absent in Safari and Firefox. */
function networkInformation(): EventTarget | undefined {
  return (navigator as Navigator & { connection?: EventTarget }).connection;
}
