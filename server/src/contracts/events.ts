/**
 * The Socket.IO contract between client and server: every event name and payload.
 * The client keeps a copy in client/src/types/signaling.ts; change both together.
 */
import type { MatchPrefs, SearchScope } from "../matching/prefs";

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/** Sent to each user when they are paired. */
export interface MatchedPayload {
  roomId: string;
  /** Perfect negotiation role: the polite peer yields when both send offers at once. */
  polite: boolean;
  iceServers: IceServer[];
}

/** WebRTC signaling relayed between the two users of a room: an SDP description or an ICE candidate. */
export interface SignalMessage {
  roomId: string;
  description?: { type: "offer" | "answer" | "pranswer" | "rollback"; sdp?: string };
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  } | null;
}

export interface ClientToServerEvents {
  /** Start looking for a partner. Sent on connect, reconnect and after "lobby". */
  find: () => void;
  /** Skip the current partner and look for a new one. */
  pass: (payload: { roomId: string }) => void;
  signal: (message: SignalMessage) => void;
}

export interface ServerToClientEvents {
  matched: (payload: MatchedPayload) => void;
  signal: (message: SignalMessage) => void;
  /** The partner left or passed. The client should send "find" again. */
  lobby: () => void;
  /** How wide the current search is; it widens while nobody matches. */
  "queue-status": (payload: { scope: SearchScope }) => void;
}

/** Events between server instances (none yet; the Redis adapter handles broadcasting). */
export type InterServerEvents = Record<string, never>;

/** Per-connection data, set once in the handshake middleware. */
export interface SocketData {
  prefs: MatchPrefs;
}
