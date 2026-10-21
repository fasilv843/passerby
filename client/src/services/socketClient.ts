import { io, type Socket } from "socket.io-client";
import { serverUrl } from "../config/env";
import type { ClientToServerEvents, MatchPrefs, ServerToClientEvents } from "../types/signaling";

export type SignalingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Opens a connection to the signaling server. Matching preferences travel in
 * the handshake, so changing them means opening a new connection.
 */
export function connectSignaling(prefs: MatchPrefs): SignalingSocket {
  return io(serverUrl, { transports: ["websocket"], auth: { prefs } });
}
