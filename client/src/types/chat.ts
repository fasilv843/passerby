export const MAX_CHAT_LENGTH = 1000;

/** Messages sent over the "chat" RTCDataChannel, as JSON. */
export type ChatWireMessage =
  | { type: "message"; id: string; text: string; sentAt: number }
  | { type: "typing"; active: boolean }
  | { type: "bye" };

export type ChatTextMessage = Extract<ChatWireMessage, { type: "message" }>;

/** One line in the chat panel. */
export interface ChatEntry {
  id: string;
  from: "me" | "stranger" | "system";
  text: string;
}
