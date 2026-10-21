import { newId } from "../../lib/id";
import type { MediaSettings } from "../../media/settings";
import type { CallStats } from "../../media/stats";
import type { ChatEntry, ChatWireMessage } from "../../types/chat";
import type { MatchedPayload, MatchPrefs, SearchScope, SignalMessage } from "../../types/signaling";
import { PeerSession } from "../peer/peerSession";
import type { PeerSessionOptions } from "../peer/peerSession";
import { connectSignaling } from "../socketClient";
import { Store } from "../store";
import type { SignalingSocket } from "../socketClient";
import { TypingNotifier } from "./typingNotifier";

/** Everything the room screen shows. Replaced (never mutated) on every change. */
export interface CallState {
  /** Set while matched with someone; null while searching. */
  roomId: string | null;
  /** How wide the server's search is, while searching. */
  searchScope: SearchScope | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  stats: CallStats | null;
  chat: {
    entries: ChatEntry[];
    /** The data channel is open, so messages can be sent. */
    open: boolean;
    strangerTyping: boolean;
  };
}

export const INITIAL_CALL_STATE: CallState = {
  roomId: null,
  searchScope: null,
  remoteStream: null,
  connectionState: null,
  stats: null,
  chat: { entries: [], open: false, strangerTyping: false },
};

/** Hide "Stranger is typing…" if no refresh arrives within this time. */
const STRANGER_TYPING_TIMEOUT_MS = 4000;

type SocketLike = Pick<SignalingSocket, "on" | "off" | "emit" | "disconnect" | "connected">;
type PeerSessionLike = Pick<PeerSession, "roomId" | "handleSignal" | "close"> & {
  chat: Pick<PeerSession["chat"], "sendText" | "sendTyping" | "sendBye">;
};

export interface CallControllerOptions {
  prefs: MatchPrefs;
  localStream: MediaStream | null;
  settings: MediaSettings;
  /** Injectable for tests. */
  connect?: (prefs: MatchPrefs) => SocketLike;
  createPeer?: (options: PeerSessionOptions) => PeerSessionLike;
}

const systemEntry = (text: string): ChatEntry => ({ id: newId(), from: "system", text });

/**
 * Runs a stranger-chat session: the signaling connection, matching, one
 * PeerSession per match, and chat. No React here; the useCall hook
 * subscribes to it, so components only render state and forward clicks.
 */
export class CallController extends Store<CallState> {
  private socket: SocketLike | null = null;
  private session: PeerSessionLike | null = null;
  /** Identifies the current session, so callbacks from a closed one are ignored. */
  private sessionToken: object | null = null;
  private strangerTypingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly typing = new TypingNotifier((active) => this.session?.chat.sendTyping(active));
  private readonly options: CallControllerOptions;

  constructor(options: CallControllerOptions) {
    super(INITIAL_CALL_STATE);
    this.options = options;
  }

  // ---- lifecycle ----

  /** Connects to the signaling server and starts looking for a partner. */
  start() {
    if (this.socket) return;
    const connect = this.options.connect ?? connectSignaling;
    const socket = connect(this.options.prefs);
    this.socket = socket;

    socket.on("connect", this.handleConnect);
    socket.on("queue-status", this.handleQueueStatus);
    socket.on("matched", this.handleMatched);
    socket.on("signal", this.handleSignal);
    socket.on("lobby", this.handleLobby);
    if (socket.connected) this.handleConnect();
  }

  /** Ends any call and disconnects. Safe to call more than once. */
  stop() {
    this.endSession();
    const socket = this.socket;
    if (!socket) return;
    socket.off("connect", this.handleConnect);
    socket.off("queue-status", this.handleQueueStatus);
    socket.off("matched", this.handleMatched);
    socket.off("signal", this.handleSignal);
    socket.off("lobby", this.handleLobby);
    socket.disconnect();
    this.socket = null;
  }

  // ---- user actions ----

  /** Sends a chat message. Returns false if it couldn't be sent (empty, or not connected). */
  sendMessage(text: string): boolean {
    const sent = this.session?.chat.sendText(text);
    if (!sent) return false;
    this.typing.stop();
    this.appendChat({ id: sent.id, from: "me", text: sent.text });
    return true;
  }

  /** Call on every change to the message draft, to drive the typing indicator. */
  updateDraft(text: string) {
    this.typing.update(text);
  }

  stopTyping() {
    this.typing.stop();
  }

  /** Skip the current partner. The server puts us back in the queue. */
  pass() {
    const roomId = this.getState().roomId;
    if (!roomId || !this.socket) return;
    this.session?.chat.sendBye();
    this.socket.emit("pass", { roomId });
    this.endSession();
    this.setChat({ entries: [] });
  }

  /** Say goodbye to the partner before the page closes the controller. */
  leave() {
    this.session?.chat.sendBye();
    this.stop();
  }

  // ---- socket events ----

  private handleConnect = () => {
    // Also runs after a reconnect: the server forgets queued users when a connection drops.
    this.socket?.emit("find");
  };

  private handleQueueStatus = ({ scope }: { scope: SearchScope }) => {
    this.setState({ searchScope: scope });
  };

  private handleMatched = ({ roomId, polite, iceServers }: MatchedPayload) => {
    this.endSession();
    this.session = this.createSession(roomId, polite, iceServers);
    this.setState({
      roomId,
      searchScope: null,
      connectionState: "new",
      chat: { entries: [systemEntry("You're connected to a stranger. Say hi!")], open: false, strangerTyping: false },
    });
  };

  private handleSignal = (message: SignalMessage) => {
    // Drop late signals from a previous match.
    if (this.session?.roomId === message.roomId) void this.session.handleSignal(message);
  };

  /** The partner left or passed. Look for someone new. */
  private handleLobby = () => {
    this.endSessionWithNotice();
    this.socket?.emit("find");
  };

  // ---- peer session ----

  private createSession(roomId: string, polite: boolean, iceServers: RTCIceServer[]): PeerSessionLike {
    const create = this.options.createPeer ?? ((options) => new PeerSession(options));
    const token = {};
    this.sessionToken = token;
    const ifCurrent =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (this.sessionToken === token) fn(...args);
      };

    return create({
      roomId,
      polite,
      iceServers,
      localStream: this.options.localStream,
      settings: this.options.settings,
      sendSignal: (message) => this.socket?.emit("signal", message),
      onRemoteStream: ifCurrent((remoteStream) => this.setState({ remoteStream })),
      onConnectionStateChange: ifCurrent((connectionState) => this.setState({ connectionState })),
      onStats: ifCurrent((stats) => this.setState({ stats })),
      onChatOpenChange: ifCurrent((open) => this.setChat({ open })),
      onChatMessage: ifCurrent(this.handleChatMessage),
    });
  }

  private handleChatMessage = (message: ChatWireMessage) => {
    switch (message.type) {
      case "message":
        this.setStrangerTyping(false);
        this.appendChat({ id: `s-${message.id}`, from: "stranger", text: message.text });
        break;
      case "typing":
        this.setStrangerTyping(message.active);
        break;
      case "bye":
        // The server's "lobby" event follows and starts a new search.
        this.endSessionWithNotice();
        break;
    }
  };

  /** Closes the session and keeps the chat on screen with a note, so a goodbye can still be read. */
  private endSessionWithNotice() {
    if (!this.session) return;
    this.endSession();
    this.appendChat(systemEntry("Stranger left."));
  }

  private endSession() {
    this.sessionToken = null;
    this.session?.close();
    this.session = null;
    this.typing.reset();
    this.setStrangerTyping(false);
    const { roomId, remoteStream, connectionState, stats } = this.getState();
    if (roomId || remoteStream || connectionState || stats) {
      this.setState({ roomId: null, remoteStream: null, connectionState: null, stats: null });
    }
    this.setChat({ open: false });
  }

  // ---- state helpers ----

  private setStrangerTyping(active: boolean) {
    if (this.strangerTypingTimer) clearTimeout(this.strangerTypingTimer);
    this.strangerTypingTimer = active
      ? setTimeout(() => this.setChat({ strangerTyping: false }), STRANGER_TYPING_TIMEOUT_MS)
      : null;
    this.setChat({ strangerTyping: active });
  }

  private appendChat(entry: ChatEntry) {
    this.setChat({ entries: [...this.getState().chat.entries, entry] });
  }

  private setChat(patch: Partial<CallState["chat"]>) {
    const chat = this.getState().chat;
    const changed = (Object.keys(patch) as (keyof CallState["chat"])[]).some((k) => chat[k] !== patch[k]);
    if (changed) this.setState({ chat: { ...chat, ...patch } });
  }
}
