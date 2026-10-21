export const MAX_CHAT_LENGTH = 1000;

/** Messages sent over the "chat" RTCDataChannel, as JSON. */
export type ChatWireMessage =
  | { type: "message"; id: string; text: string; sentAt: number }
  | { type: "typing"; active: boolean }
  | { type: "bye" };

/** One line in the chat panel. */
export interface ChatEntry {
  id: string;
  from: "me" | "stranger" | "system";
  text: string;
  at: number;
}

/** Validates a message from the other peer. Anything unexpected is dropped. */
export function parseChatWireMessage(raw: unknown): ChatWireMessage | null {
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
    case "message":
      if (typeof msg.id !== "string" || typeof msg.text !== "string" || typeof msg.sentAt !== "number") return null;
      if (!msg.text.trim() || msg.text.length > MAX_CHAT_LENGTH) return null;
      return { type: "message", id: msg.id.slice(0, 64), text: msg.text, sentAt: msg.sentAt };
    case "typing":
      return typeof msg.active === "boolean" ? { type: "typing", active: msg.active } : null;
    case "bye":
      return { type: "bye" };
    default:
      return null;
  }
}

/** crypto.randomUUID() needs a secure context; plain-HTTP LAN testing doesn't have one. */
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto && window.isSecureContext
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
