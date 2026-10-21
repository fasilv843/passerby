import { createTextMessage, encodeChatMessage, parseChatMessage } from "../../lib/chatProtocol";
import type { ChatTextMessage, ChatWireMessage } from "../../types/chat";

export interface ChatChannelHandlers {
  onMessage: (message: ChatWireMessage) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Text chat over an RTCDataChannel (SCTP inside the call's DTLS connection),
 * so messages go peer to peer and never touch the server.
 *
 * `negotiated: true` with a fixed id means both peers create the channel
 * themselves: no "who opens it" race and no ondatachannel handler. In text-only
 * mode this channel is the only thing in the SDP.
 */
export class ChatChannel {
  private readonly channel: RTCDataChannel;

  constructor(pc: RTCPeerConnection, handlers: ChatChannelHandlers) {
    this.channel = pc.createDataChannel("chat", { negotiated: true, id: 0, ordered: true });
    this.channel.onopen = () => handlers.onOpenChange(true);
    this.channel.onclose = () => handlers.onOpenChange(false);
    this.channel.onmessage = ({ data }) => {
      const message = parseChatMessage(data);
      if (message) handlers.onMessage(message);
    };
  }

  get isOpen() {
    return this.channel.readyState === "open";
  }

  /** Sends a text message. Returns it, or null if it was empty or the channel isn't open. */
  sendText(text: string): ChatTextMessage | null {
    const message = createTextMessage(text);
    return message && this.send(message) ? message : null;
  }

  sendTyping(active: boolean) {
    this.send({ type: "typing", active });
  }

  /** Tells the other person we're leaving, before the server's "lobby" event reaches them. */
  sendBye() {
    this.send({ type: "bye" });
  }

  close() {
    this.channel.onopen = null;
    this.channel.onclose = null;
    this.channel.onmessage = null;
    this.channel.close();
  }

  private send(message: ChatWireMessage): boolean {
    if (!this.isOpen) return false;
    try {
      this.channel.send(encodeChatMessage(message));
      return true;
    } catch (err) {
      console.warn("[chat] send failed", err);
      return false;
    }
  }
}
