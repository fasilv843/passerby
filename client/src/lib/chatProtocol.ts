import { MAX_CHAT_LENGTH } from "../types/chat";
import type { ChatTextMessage, ChatWireMessage } from "../types/chat";
import { newId } from "./id";

/** Builds a chat message, or null if the text is empty after trimming. Long text is cut to the limit. */
export function createTextMessage(text: string, now = Date.now()): ChatTextMessage | null {
  const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
  return trimmed ? { type: "message", id: newId(), text: trimmed, sentAt: now } : null;
}

export const encodeChatMessage = (message: ChatWireMessage) => JSON.stringify(message);

/**
 * Validates a message from the other peer. Anything unexpected is dropped,
 * since the other side can send arbitrary data over the channel.
 */
export function parseChatMessage(raw: unknown): ChatWireMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_CHAT_LENGTH * 2) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case "message": {
      const valid =
        typeof msg.id === "string" &&
        typeof msg.text === "string" &&
        typeof msg.sentAt === "number" &&
        msg.text.trim() !== "" &&
        msg.text.length <= MAX_CHAT_LENGTH;
      return valid
        ? { type: "message", id: (msg.id as string).slice(0, 64), text: msg.text as string, sentAt: msg.sentAt as number }
        : null;
    }
    case "typing":
      return typeof msg.active === "boolean" ? { type: "typing", active: msg.active } : null;
    case "bye":
      return { type: "bye" };
    default:
      return null;
  }
}
