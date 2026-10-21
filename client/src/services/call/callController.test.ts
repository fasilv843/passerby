import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaSettings } from "../../media/settings";
import type { ChatWireMessage } from "../../types/chat";
import type { PeerSessionOptions } from "../peer/peerSession";
import { CallController } from "./callController";

const settings: MediaSettings = {
  preferredVideoCodec: null,
  opusFec: true,
  opusDtx: true,
  adaptiveQuality: true,
  showStats: false,
};

/** A stand-in for the Socket.IO client: records emits, lets tests deliver server events. */
function fakeSocket() {
  const handlers = new Map<string, (payload?: unknown) => void>();
  return {
    connected: true,
    emitted: [] as [string, unknown?][],
    on(event: string, handler: (payload?: unknown) => void) {
      handlers.set(event, handler);
      return this;
    },
    off(event: string) {
      handlers.delete(event);
      return this;
    },
    emit(event: string, payload?: unknown) {
      this.emitted.push(payload === undefined ? [event] : [event, payload]);
      return this;
    },
    disconnect: vi.fn(),
    receive(event: string, payload?: unknown) {
      handlers.get(event)?.(payload);
    },
    listening: () => [...handlers.keys()],
  };
}

/** A stand-in for PeerSession that exposes the callbacks it was given. */
function fakePeer(options: PeerSessionOptions) {
  return {
    roomId: options.roomId,
    options,
    handleSignal: vi.fn(),
    close: vi.fn(),
    chat: {
      sendText: vi.fn((text: string) => ({ type: "message" as const, id: "m1", text: text.trim(), sentAt: 0 })),
      sendTyping: vi.fn(),
      sendBye: vi.fn(),
    },
  };
}

function setup() {
  const socket = fakeSocket();
  const peers: ReturnType<typeof fakePeer>[] = [];
  const controller = new CallController({
    prefs: { mode: "text", language: "ml", country: "IN" },
    localStream: null,
    settings,
    connect: () => socket as never,
    createPeer: (options) => {
      const peer = fakePeer(options);
      peers.push(peer);
      return peer;
    },
  });
  const match = (roomId = "room:1") => socket.receive("matched", { roomId, polite: true, iceServers: [] });
  const peerSays = (message: ChatWireMessage, peer = peers.at(-1)!) => peer.options.onChatMessage(message);
  return { socket, peers, controller, match, peerSays };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CallController", () => {
  it("asks to be matched as soon as it starts", () => {
    const { socket, controller } = setup();
    controller.start();
    expect(socket.emitted).toEqual([["find"]]);
  });

  it("shows the search scope while waiting", () => {
    const { socket, controller } = setup();
    controller.start();
    socket.receive("queue-status", { scope: "language" });
    expect(controller.getState().searchScope).toBe("language");
  });

  it("creates a peer session on match and relays its signals", () => {
    const { socket, peers, controller, match } = setup();
    controller.start();
    match();

    expect(controller.getState()).toMatchObject({ roomId: "room:1", searchScope: null, connectionState: "new" });
    expect(peers[0].options).toMatchObject({ roomId: "room:1", polite: true });

    peers[0].options.sendSignal({ roomId: "room:1", candidate: { candidate: "c" } });
    expect(socket.emitted.at(-1)).toEqual(["signal", { roomId: "room:1", candidate: { candidate: "c" } }]);
  });

  it("passes signals to the current session only", () => {
    const { socket, peers, controller, match } = setup();
    controller.start();
    match("room:1");
    socket.receive("signal", { roomId: "room:old", description: { type: "offer" } });
    socket.receive("signal", { roomId: "room:1", description: { type: "offer" } });
    expect(peers[0].handleSignal).toHaveBeenCalledTimes(1);
  });

  it("adds sent and received messages to the chat", () => {
    const { controller, match, peerSays } = setup();
    controller.start();
    match();

    expect(controller.sendMessage(" hi ")).toBe(true);
    peerSays({ type: "message", id: "x", text: "hello", sentAt: 0 });

    const lines = controller.getState().chat.entries.map((e) => `${e.from}: ${e.text}`);
    expect(lines).toEqual(["system: You're connected to a stranger. Say hi!", "me: hi", "stranger: hello"]);
  });

  it("shows the typing indicator and hides it after a few quiet seconds", () => {
    const { controller, match, peerSays } = setup();
    controller.start();
    match();

    peerSays({ type: "typing", active: true });
    expect(controller.getState().chat.strangerTyping).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(controller.getState().chat.strangerTyping).toBe(false);
  });

  it("throttles our own typing signals", () => {
    const { peers, controller, match } = setup();
    controller.start();
    match();

    controller.updateDraft("h");
    controller.updateDraft("he");
    controller.updateDraft("hel");
    expect(peers[0].chat.sendTyping.mock.calls).toEqual([[true]]);
    vi.advanceTimersByTime(3000);
    expect(peers[0].chat.sendTyping.mock.calls).toEqual([[true], [false]]);
  });

  it("on 'bye', ends the call but keeps the chat with a note", () => {
    const { peers, controller, match, peerSays } = setup();
    controller.start();
    match();
    peerSays({ type: "message", id: "x", text: "gotta go", sentAt: 0 });
    peerSays({ type: "bye" });

    const state = controller.getState();
    expect(peers[0].close).toHaveBeenCalled();
    expect(state.roomId).toBeNull();
    expect(state.chat.entries.map((e) => e.text).slice(-2)).toEqual(["gotta go", "Stranger left."]);
  });

  it("on 'lobby', looks for someone new without a duplicate notice after 'bye'", () => {
    const { socket, controller, match, peerSays } = setup();
    controller.start();
    match();
    peerSays({ type: "bye" });
    socket.receive("lobby");

    expect(socket.emitted.filter(([e]) => e === "find")).toHaveLength(2);
    expect(controller.getState().chat.entries.filter((e) => e.text === "Stranger left.")).toHaveLength(1);
  });

  it("pass says goodbye, tells the server and clears the chat", () => {
    const { socket, peers, controller, match } = setup();
    controller.start();
    match("room:9");
    controller.pass();

    expect(peers[0].chat.sendBye).toHaveBeenCalled();
    expect(socket.emitted.at(-1)).toEqual(["pass", { roomId: "room:9" }]);
    expect(controller.getState()).toMatchObject({ roomId: null, chat: { entries: [] } });
  });

  it("ignores callbacks from a session that has been replaced", () => {
    const { peers, controller, match } = setup();
    controller.start();
    match("room:1");
    match("room:2");
    peers[0].options.onConnectionStateChange("failed");
    expect(controller.getState()).toMatchObject({ roomId: "room:2", connectionState: "new" });
  });

  it("stop closes the session and disconnects, and can be called twice", () => {
    const { socket, peers, controller, match } = setup();
    controller.start();
    match();
    controller.stop();
    controller.stop();

    expect(peers[0].close).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.listening()).toEqual([]);
  });

  it("notifies subscribers on every change", () => {
    const { controller, match } = setup();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.start();
    match();
    expect(listener).toHaveBeenCalled();
  });
});
