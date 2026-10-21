import { env } from "../config/env";
import type { AppServer } from "../socket/types";
import { GroupRoomRegistry } from "./groupRoomRegistry";
import { registerGroupHandlers } from "./registerGroupHandlers";
import type { GroupNamespace } from "./registerGroupHandlers";
import { WorkerPool } from "./workerPool";

/**
 * Group rooms: a separate "/group" namespace on the same Socket.IO server,
 * backed by mediasoup. The 1:1 stranger chat (default namespace) is untouched.
 */
export async function createGroupRooms(io: AppServer) {
  const workers = await WorkerPool.create(env.sfu.workers);
  const namespace = io.of("/group") as unknown as GroupNamespace;

  const registry = new GroupRoomRegistry(workers, env.sfu.maxPeersPerRoom, {
    consumerClosed: (peerId, consumerId) => namespace.to(peerId).emit("consumerClosed", { consumerId }),
  });

  namespace.on("connection", (socket) => registerGroupHandlers(socket, registry));

  return {
    close() {
      registry.closeAll();
      workers.close();
    },
  };
}
