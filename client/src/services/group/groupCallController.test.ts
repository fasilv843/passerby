import { FakeMediaStreamTrack } from "fake-mediastreamtrack";
import { Device, FakeHandler, testFakeParameters } from "mediasoup-client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { GroupRequests, GroupServerEvents, ProducerInfo } from "../../types/group";
import { GroupCallController } from "./groupCallController";
import type { GroupSignaling } from "./groupSignaling";

// Node has no MediaStream; this is all the controller needs from one.
beforeAll(() => {
  globalThis.MediaStream = class {
    constructor(private readonly tracks: MediaStreamTrack[] = []) {}
    getTracks() { return this.tracks; }
    getAudioTracks() { return this.tracks.filter((t) => t.kind === "audio"); }
    getVideoTracks() { return this.tracks.filter((t) => t.kind === "video"); }
  } as unknown as typeof MediaStream;
});

const flush = () => new Promise((r) => setTimeout(r, 20));
const otherProducer = (kind: "audio" | "video", peerId = "bob", producerId = `${peerId}-${kind}`): ProducerInfo => ({
  producerId, peerId, kind, paused: false,
});

/**
 * Plays the server: answers requests like the real one would (using
 * mediasoup-client's fake parameters) and lets tests push server events.
 */
function fakeServer(initial: { peers?: { peerId: string; displayName: string }[]; producers?: ProducerInfo[] } = {}) {
  const handlers = new Map<string, (payload: never) => void>();
  const requests: [string, unknown][] = [];
  let nextProducer = 0;

  const answers: { [E in keyof GroupRequests]?: (payload: never) => GroupRequests[E]["result"] } = {
    join: () => ({
      selfId: "me",
      routerRtpCapabilities: testFakeParameters.generateRouterRtpCapabilities(),
      peers: initial.peers ?? [],
      producers: initial.producers ?? [],
      iceServers: [],
    }),
    createTransport: () => testFakeParameters.generateTransportRemoteParameters() as never,
    connectTransport: () => null,
    produce: () => ({ producerId: `my-producer-${nextProducer++}` }),
    consume: ({ producerId }: { producerId: string }) => {
      const kind = producerId.endsWith("audio") ? "audio" : "video";
      const params = testFakeParameters.generateConsumerRemoteParameters({
        codecMimeType: kind === "audio" ? "audio/opus" : "video/VP8",
      });
      return {
        consumerId: `consumer-of-${producerId}`,
        producerId,
        peerId: producerId.split("-")[0],
        kind,
        rtpParameters: params.rtpParameters,
        producerPaused: false,
      };
    },
    resumeConsumer: () => null,
    setPreferredLayer: () => null,
    setProducerPaused: () => null,
  };

  const signaling: GroupSignaling = {
    async request(event, ...payload) {
      requests.push([event, payload[0]]);
      const answer = answers[event];
      if (!answer) throw new Error(`unexpected request ${event}`);
      return answer(payload[0] as never) as never;
    },
    on(event, handler) {
      handlers.set(event, handler as never);
    },
    disconnect: vi.fn(),
  };

  return {
    signaling,
    requests,
    sent: (event: string) => requests.filter(([e]) => e === event).map(([, p]) => p),
    emit<E extends keyof GroupServerEvents>(event: E, payload: Parameters<GroupServerEvents[E]>[0]) {
      handlers.get(event)?.(payload as never);
    },
  };
}

function setup(server = fakeServer(), withCamera = true) {
  const localStream = withCamera
    ? new MediaStream([
        new FakeMediaStreamTrack({ kind: "audio" }) as unknown as MediaStreamTrack,
        new FakeMediaStreamTrack({ kind: "video" }) as unknown as MediaStreamTrack,
      ])
    : null;
  const controller = new GroupCallController({
    roomId: "room12345678",
    displayName: "Me",
    localStream,
    connect: () => server.signaling,
    createDevice: async () => new Device({ handlerFactory: FakeHandler.createFactory(testFakeParameters) }),
  });
  return { controller, server, localStream };
}

describe("GroupCallController", () => {
  it("joins, sends mic and camera (with simulcast), and receives existing tracks", async () => {
    const server = fakeServer({
      peers: [{ peerId: "bob", displayName: "Bob" }],
      producers: [otherProducer("audio"), otherProducer("video")],
    });
    const { controller } = setup(server);
    await controller.start();

    expect(controller.getState()).toMatchObject({ status: "joined", micOn: true, cameraOn: true });
    expect(server.sent("join")).toEqual([{ roomId: "room12345678", displayName: "Me" }]);
    expect(server.sent("createTransport")).toEqual(expect.arrayContaining([{ direction: "send" }, { direction: "recv" }]));

    const produced = server.sent("produce") as { kind: string; rtpParameters: { encodings: unknown[] } }[];
    expect(produced.map((p) => p.kind).sort()).toEqual(["audio", "video"]);
    expect(produced.find((p) => p.kind === "video")!.rtpParameters.encodings).toHaveLength(3);

    const [bob] = controller.getState().participants;
    expect(bob).toMatchObject({ peerId: "bob", displayName: "Bob", micOff: false, cameraOff: false });
    expect(bob.stream?.getTracks()).toHaveLength(2);
    expect(server.sent("resumeConsumer")).toHaveLength(2);
    // One other person: ask for the highest layer.
    expect(server.sent("setPreferredLayer")).toEqual([{ consumerId: "consumer-of-bob-video", spatialLayer: 2 }]);
  });

  it("joins without sending when there's no camera or mic", async () => {
    const { controller, server } = setup(fakeServer(), false);
    await controller.start();
    expect(controller.getState()).toMatchObject({ status: "joined", micOn: false, cameraOn: false });
    expect(server.sent("createTransport")).toEqual([{ direction: "recv" }]);
  });

  it("adds people and their tracks as they arrive, and removes them when they leave", async () => {
    const { controller, server } = setup();
    await controller.start();

    server.emit("peerJoined", { peerId: "cara", displayName: "Cara" });
    server.emit("newProducer", otherProducer("video", "cara"));
    await flush();
    expect(controller.getState().participants[0]).toMatchObject({ displayName: "Cara", cameraOff: false, micOff: true });

    server.emit("producerPaused", { producerId: "cara-video", paused: true });
    expect(controller.getState().participants[0].cameraOff).toBe(true);

    server.emit("consumerClosed", { consumerId: "consumer-of-cara-video" });
    expect(controller.getState().participants[0].stream).toBeNull();

    server.emit("peerLeft", { peerId: "cara" });
    expect(controller.getState().participants).toEqual([]);
  });

  it("asks for lower layers as the room fills up", async () => {
    const server = fakeServer({ peers: [{ peerId: "bob", displayName: "Bob" }], producers: [otherProducer("video")] });
    const { controller } = setup(server);
    await controller.start();

    for (const peerId of ["c", "d", "e"]) server.emit("peerJoined", { peerId, displayName: peerId });
    const layers = (server.sent("setPreferredLayer") as { spatialLayer: number }[]).map((p) => p.spatialLayer);
    expect(layers).toEqual([2, 1, 1, 0]); // 1 other → 2, 2–3 others → 1, 4+ → 0
  });

  it("consumes a track announced twice only once", async () => {
    const { controller, server } = setup(fakeServer({ peers: [{ peerId: "bob", displayName: "Bob" }], producers: [otherProducer("audio")] }));
    await controller.start();
    server.emit("newProducer", otherProducer("audio"));
    await flush();
    expect(server.sent("consume")).toHaveLength(1);
  });

  it("toggles the mic and camera and tells the server", async () => {
    const { controller, server } = setup();
    await controller.start();

    controller.toggleMic();
    controller.toggleCamera();
    await flush();
    expect(controller.getState()).toMatchObject({ micOn: false, cameraOn: false });
    expect(server.sent("setProducerPaused")).toEqual([
      { producerId: "my-producer-0", paused: true },
      { producerId: "my-producer-1", paused: true },
    ]);

    controller.toggleMic();
    await flush();
    expect(controller.getState().micOn).toBe(true);
  });

  it("shows the server's reason when joining fails", async () => {
    const server = fakeServer();
    server.signaling.request = (async () => {
      const { GroupRequestError } = await import("./groupSignaling");
      throw new GroupRequestError("This room is full (6 people max)");
    }) as never;
    const { controller } = setup(server);
    await controller.start();
    expect(controller.getState()).toMatchObject({ status: "failed", error: "This room is full (6 people max)" });
  });

  it("stop disconnects and keeps the local camera running", async () => {
    const { controller, server, localStream } = setup();
    await controller.start();
    controller.stop();
    controller.stop();
    expect(server.signaling.disconnect).toHaveBeenCalledTimes(1);
    expect(localStream!.getTracks().every((t) => t.readyState === "live")).toBe(true);
  });
});
