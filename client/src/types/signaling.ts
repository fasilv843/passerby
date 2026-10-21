/**
 * The Socket.IO contract with the server: event names and payloads.
 * Mirrors server/src/contracts/events.ts; change both together.
 */

export type MatchMode = "video" | "text";

/** "*" means "anyone". Sent to the server when connecting. */
export interface MatchPrefs {
  mode: MatchMode;
  /** ISO 639-1 code, e.g. "ml", or "*" */
  language: string;
  /** ISO 3166-1 alpha-2 code, e.g. "IN", or "*" */
  country: string;
}

/** How wide the server's current search is: it widens while nobody matches. */
export type SearchScope = "exact" | "language" | "anyone";

/** Sent by the server to each user when they are paired. */
export interface MatchedPayload {
  roomId: string;
  /** Perfect negotiation role: the polite peer yields when both send offers at once. */
  polite: boolean;
  iceServers: RTCIceServer[];
}

/** All WebRTC signaling goes through one "signal" event: an SDP description or an ICE candidate. */
export interface SignalMessage {
  roomId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}

export interface ServerToClientEvents {
  matched: (payload: MatchedPayload) => void;
  signal: (message: SignalMessage) => void;
  /** The partner left or passed. Send "find" again. */
  lobby: () => void;
  "queue-status": (payload: { scope: SearchScope }) => void;
}

export interface ClientToServerEvents {
  /** Start looking for a partner. */
  find: () => void;
  /** Skip the current partner and look for a new one. */
  pass: (payload: { roomId: string }) => void;
  signal: (message: SignalMessage) => void;
}

/** How media is flowing between the two peers, read from getStats(). */
export interface ConnectionPath {
  /** "direct" = peer to peer (host or srflx candidates); "relay" = through a TURN server. */
  kind: "direct" | "relay";
  localType: RTCIceCandidateType | string;
  remoteType: RTCIceCandidateType | string;
  protocol?: string;
  /** Transport between this browser and the TURN server, when relayed. */
  relayProtocol?: string;
  rttMs?: number;
}
