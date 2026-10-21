import { io, type Socket } from "socket.io-client";
import { serverUrl } from "../../config/env";
import type { AckResponse, GroupRequests, GroupServerEvents } from "../../types/group";

const REQUEST_TIMEOUT_MS = 10_000;

/** A request the server refused, with a message that's safe to show. */
export class GroupRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupRequestError";
  }
}

/** The small part of a Socket.IO client the group code uses (fakeable in tests). */
export interface GroupSignaling {
  request<E extends keyof GroupRequests>(
    event: E,
    ...payload: GroupRequests[E]["payload"] extends undefined ? [] : [GroupRequests[E]["payload"]]
  ): Promise<GroupRequests[E]["result"]>;
  on<E extends keyof GroupServerEvents>(event: E, handler: GroupServerEvents[E]): void;
  disconnect(): void;
}

/**
 * Connects to the "/group" namespace. Requests wait for the server's
 * acknowledgement and reject with GroupRequestError if it refuses.
 */
export function connectGroupSignaling(): GroupSignaling {
  const socket: Socket = io(`${serverUrl}/group`, { transports: ["websocket"] });

  return {
    async request(event, ...payload) {
      let response: AckResponse<unknown>;
      try {
        response = await socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck(event, ...payload);
      } catch {
        throw new GroupRequestError("The server didn't respond. Check your connection and try again.");
      }
      if (!response.ok) throw new GroupRequestError(response.error);
      return response.data as never;
    },
    on(event, handler) {
      socket.on(event, handler as never);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

/** Creates a room and returns its id, using a short-lived connection. */
export async function createGroupRoom(): Promise<string> {
  const signaling = connectGroupSignaling();
  try {
    const { roomId } = await signaling.request("createRoom");
    return roomId;
  } finally {
    signaling.disconnect();
  }
}
