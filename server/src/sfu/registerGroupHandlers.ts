import type { Namespace, Socket } from "socket.io";
import type { ZodType } from "zod";
import { getIceServers } from "../config/iceServers";
import type {
  Ack,
  GroupClientToServerEvents,
  GroupServerToClientEvents,
  GroupSocketData,
} from "../contracts/groupEvents";
import { groupSchemas } from "../contracts/groupSchemas";
import { createLogger } from "../logger";
import { GroupError } from "./groupError";
import type { GroupRoom } from "./groupRoom";
import type { GroupRoomRegistry } from "./groupRoomRegistry";

const log = createLogger("group");

type EmptyEvents = Record<string, never>;
export type GroupNamespace = Namespace<GroupClientToServerEvents, GroupServerToClientEvents, EmptyEvents, GroupSocketData>;
type GroupSocket = Socket<GroupClientToServerEvents, GroupServerToClientEvents, EmptyEvents, GroupSocketData>;

/**
 * Wires one "/group" connection to the room registry.
 * Every request: validate the payload, run it, answer through the ack.
 * The peer id is the socket id, so a client can only act as itself.
 */
export function registerGroupHandlers(socket: GroupSocket, registry: GroupRoomRegistry) {
  const peerId = socket.id;

  /** The room this socket has joined. */
  const currentRoom = (): GroupRoom => {
    if (!socket.data.roomId) throw new GroupError("Join a room first");
    return registry.get(socket.data.roomId);
  };

  /** Validates the payload, runs the handler and answers with { ok, data } or { ok: false, error }. */
  function handle<T, R>(event: string, schema: ZodType<T>, run: (input: T) => Promise<R>) {
    return (payload: unknown, ack: unknown) => {
      if (typeof ack !== "function") return; // every request expects an answer
      const reply = ack as Ack<R>;
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        reply({ ok: false, error: "Invalid request" });
        return;
      }
      // Promise.resolve().then() so errors thrown synchronously take the same path as rejections.
      Promise.resolve()
        .then(() => run(parsed.data))
        .then((data) => reply({ ok: true, data }))
        .catch((err: unknown) => {
          if (err instanceof GroupError) {
            reply({ ok: false, error: err.message });
          } else {
            log.error(`"${event}" failed for ${peerId}`, err);
            reply({ ok: false, error: "Something went wrong" });
          }
        });
    };
  }

  const leaveCurrentRoom = () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.data.roomId = undefined;
    try {
      const room = registry.get(roomId);
      // Closing this peer's transports closes the others' consumers of its tracks,
      // which tells each of them through the notifier ("consumerClosed").
      room.removePeer(peerId);
      socket.to(roomId).emit("peerLeft", { peerId });
      registry.closeIfStillEmpty(room);
    } catch {
      // The room already closed.
    }
    void socket.leave(roomId);
  };

  socket.on("createRoom", (ack) =>
    handle("createRoom", groupSchemas.none, async () => ({ roomId: (await registry.create()).id }))(undefined, ack)
  );

  socket.on(
    "join",
    handle("join", groupSchemas.join, async ({ roomId, displayName }) => {
      leaveCurrentRoom();
      const room = registry.get(roomId);
      room.addPeer(peerId, displayName);
      registry.keepOpen(room);
      socket.data.roomId = roomId;
      await socket.join(roomId);
      socket.to(roomId).emit("peerJoined", { peerId, displayName });
      log.info(`${peerId} joined ${roomId} (${room.size} in room)`);

      return {
        selfId: peerId,
        routerRtpCapabilities: room.rtpCapabilities,
        peers: room.peerInfos(peerId),
        producers: room.producerInfos(peerId),
        iceServers: getIceServers(peerId),
      };
    })
  );

  socket.on(
    "createTransport",
    handle("createTransport", groupSchemas.createTransport, ({ direction }) =>
      currentRoom().createTransport(peerId, direction)
    )
  );

  socket.on(
    "connectTransport",
    handle("connectTransport", groupSchemas.connectTransport, async ({ transportId, dtlsParameters }) => {
      await currentRoom().connectTransport(peerId, transportId, dtlsParameters as never);
      return null;
    })
  );

  socket.on(
    "produce",
    handle("produce", groupSchemas.produce, async ({ transportId, kind, rtpParameters }) => {
      const producer = await currentRoom().produce(peerId, transportId, kind, rtpParameters as never);
      socket.to(socket.data.roomId!).emit("newProducer", producer);
      return { producerId: producer.producerId };
    })
  );

  socket.on(
    "setProducerPaused",
    handle("setProducerPaused", groupSchemas.setProducerPaused, async ({ producerId, paused }) => {
      await currentRoom().setProducerPaused(peerId, producerId, paused);
      socket.to(socket.data.roomId!).emit("producerPaused", { producerId, paused });
      return null;
    })
  );

  socket.on(
    "consume",
    handle("consume", groupSchemas.consume, ({ transportId, producerId, rtpCapabilities }) =>
      currentRoom().consume(peerId, transportId, producerId, rtpCapabilities as never)
    )
  );

  socket.on(
    "resumeConsumer",
    handle("resumeConsumer", groupSchemas.resumeConsumer, async ({ consumerId }) => {
      await currentRoom().resumeConsumer(peerId, consumerId);
      return null;
    })
  );

  socket.on(
    "setPreferredLayer",
    handle("setPreferredLayer", groupSchemas.setPreferredLayer, async ({ consumerId, spatialLayer }) => {
      await currentRoom().setPreferredLayer(peerId, consumerId, spatialLayer);
      return null;
    })
  );

  socket.on("leave", (ack) =>
    handle("leave", groupSchemas.none, async () => {
      leaveCurrentRoom();
      return null;
    })(undefined, ack)
  );

  socket.on("disconnect", leaveCurrentRoom);
}
