/**
 * Group-room signaling against real mediasoup workers, with Socket.IO clients
 * standing in for browsers. RTP parameters are written by hand (what
 * mediasoup-client would produce), so no browser or Redis is needed.
 */
import { createServer } from "http";
import type { AddressInfo } from "net";
import { Server } from "socket.io";
import { io as connectClient, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AckResponse, ConsumerParams, JoinResult, TransportParams } from "../src/contracts/groupEvents";
import { createGroupRooms } from "../src/sfu/createGroupRooms";
import type { AppServer } from "../src/socket/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A VP8 camera track sent as three simulcast layers. */
const videoRtpParameters = {
  mid: "0",
  codecs: [
    {
      mimeType: "video/VP8",
      payloadType: 96,
      clockRate: 90000,
      rtcpFeedback: [{ type: "nack" }, { type: "nack", parameter: "pli" }, { type: "ccm", parameter: "fir" }],
    },
  ],
  headerExtensions: [{ uri: "urn:ietf:params:rtp-hdrext:sdes:mid", id: 1 }],
  encodings: [{ ssrc: 1111 }, { ssrc: 2222 }, { ssrc: 3333 }],
  rtcp: { cname: "camera" },
};

const audioRtpParameters = {
  mid: "1",
  codecs: [{ mimeType: "audio/opus", payloadType: 111, clockRate: 48000, channels: 2 }],
  headerExtensions: [{ uri: "urn:ietf:params:rtp-hdrext:sdes:mid", id: 1 }],
  encodings: [{ ssrc: 4444 }],
  rtcp: { cname: "mic" },
};

describe("group rooms (mediasoup)", () => {
  let io: AppServer;
  let url: string;
  let groupRooms: Awaited<ReturnType<typeof createGroupRooms>>;
  const clients: Socket[] = [];

  /** A connected client plus a typed request helper and a log of server events. */
  async function connect() {
    const socket = connectClient(`${url}/group`, { transports: ["websocket"], forceNew: true });
    clients.push(socket);
    await new Promise<void>((resolve) => socket.once("connect", () => resolve()));
    const events: [string, unknown][] = [];
    socket.onAny((event, payload) => events.push([event, payload]));

    async function request<T>(event: string, payload?: unknown): Promise<T> {
      const response: AckResponse<T> =
        payload === undefined ? await socket.emitWithAck(event) : await socket.emitWithAck(event, payload);
      if (!response.ok) throw new Error(response.error);
      return response.data;
    }
    return { socket, events, request };
  }

  beforeAll(async () => {
    const http = createServer();
    io = new Server(http) as AppServer;
    groupRooms = await createGroupRooms(io);
    await new Promise<void>((resolve) => http.listen(0, resolve));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    clients.forEach((c) => c.disconnect());
    await io.close();
    groupRooms.close();
  });

  it("runs a full join → send → receive → leave flow", async () => {
    const alice = await connect();
    const { roomId } = await alice.request<{ roomId: string }>("createRoom");
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{11}$/);

    const aliceJoin = await alice.request<JoinResult>("join", { roomId, displayName: "Alice" });
    expect(aliceJoin.peers).toEqual([]);
    expect(aliceJoin.routerRtpCapabilities.codecs?.map((c) => c.mimeType)).toContain("video/VP8");

    // Alice sends camera (simulcast) and mic.
    const send = await alice.request<TransportParams>("createTransport", { direction: "send" });
    expect(send.iceCandidates[0]).toMatchObject({ address: "127.0.0.1" });
    const { producerId: videoId } = await alice.request<{ producerId: string }>("produce", {
      transportId: send.id, kind: "video", rtpParameters: videoRtpParameters,
    });
    await alice.request("produce", { transportId: send.id, kind: "audio", rtpParameters: audioRtpParameters });

    // Bob joins and sees Alice and both of her tracks.
    const bob = await connect();
    const bobJoin = await bob.request<JoinResult>("join", { roomId, displayName: "Bob" });
    expect(bobJoin.peers).toEqual([{ peerId: aliceJoin.selfId, displayName: "Alice" }]);
    expect(bobJoin.producers.map((p) => p.kind).sort()).toEqual(["audio", "video"]);
    await wait(50);
    expect(alice.events).toContainEqual(["peerJoined", { peerId: bobJoin.selfId, displayName: "Bob" }]);

    // Bob receives Alice's camera as a simulcast consumer and picks a layer.
    const recv = await bob.request<TransportParams>("createTransport", { direction: "recv" });
    const consumer = await bob.request<ConsumerParams>("consume", {
      transportId: recv.id, producerId: videoId, rtpCapabilities: bobJoin.routerRtpCapabilities,
    });
    expect(consumer).toMatchObject({ producerId: videoId, peerId: aliceJoin.selfId, kind: "video", producerPaused: false });
    expect(consumer.rtpParameters.codecs[0].mimeType).toBe("video/VP8");
    await bob.request("resumeConsumer", { consumerId: consumer.consumerId });
    await bob.request("setPreferredLayer", { consumerId: consumer.consumerId, spatialLayer: 0 });

    // Alice turns her camera off; Bob is told.
    await alice.request("setProducerPaused", { producerId: videoId, paused: true });
    await wait(50);
    expect(bob.events).toContainEqual(["producerPaused", { producerId: videoId, paused: true }]);

    // Alice leaves: Bob's consumer of her camera closes and he sees her go.
    alice.socket.disconnect();
    await wait(200);
    expect(bob.events).toContainEqual(["consumerClosed", { consumerId: consumer.consumerId }]);
    expect(bob.events).toContainEqual(["peerLeft", { peerId: aliceJoin.selfId }]);
  });

  it("tells newcomers about tracks added after they joined", async () => {
    const host = await connect();
    const { roomId } = await host.request<{ roomId: string }>("createRoom");
    await host.request("join", { roomId, displayName: "Host" });
    const guest = await connect();
    await guest.request("join", { roomId, displayName: "Guest" });

    const send = await host.request<TransportParams>("createTransport", { direction: "send" });
    const { producerId } = await host.request<{ producerId: string }>("produce", {
      transportId: send.id, kind: "audio", rtpParameters: audioRtpParameters,
    });
    await wait(50);
    expect(guest.events).toContainEqual(["newProducer", expect.objectContaining({ producerId, kind: "audio" })]);
  });

  it("rejects joining a full room, a missing room, and malformed requests", async () => {
    const owner = await connect();
    const { roomId } = await owner.request<{ roomId: string }>("createRoom");
    for (const name of ["A", "B", "C"]) {
      await (await connect()).request("join", { roomId, displayName: name });
    }
    const late = await connect();
    await expect(late.request("join", { roomId, displayName: "D" })).rejects.toThrow("This room is full (3 people max)");
    await expect(late.request("join", { roomId: "doesNotExist1", displayName: "D" })).rejects.toThrow("doesn't exist");
    await expect(late.request("join", { roomId: "../../etc", displayName: "D" })).rejects.toThrow("Invalid request");
    await expect(late.request("createTransport", { direction: "send" })).rejects.toThrow("Join a room first");
  });

  it("doesn't let a peer consume its own track or an unknown one", async () => {
    const solo = await connect();
    const { roomId } = await solo.request<{ roomId: string }>("createRoom");
    const join = await solo.request<JoinResult>("join", { roomId, displayName: "Solo" });
    const send = await solo.request<TransportParams>("createTransport", { direction: "send" });
    const { producerId } = await solo.request<{ producerId: string }>("produce", {
      transportId: send.id, kind: "audio", rtpParameters: audioRtpParameters,
    });
    const recv = await solo.request<TransportParams>("createTransport", { direction: "recv" });
    const consume = (id: string) =>
      solo.request("consume", { transportId: recv.id, producerId: id, rtpCapabilities: join.routerRtpCapabilities });
    await expect(consume(producerId)).rejects.toThrow("no longer available");
    await expect(consume("nope")).rejects.toThrow("no longer available");
  });
});
