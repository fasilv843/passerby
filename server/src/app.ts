import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";
import { env } from "./config/env";
import { createAdapterClients, redis } from "./config/redis";
import { Matchmaker } from "./matching/matchmaker";
import { parsePrefs } from "./matching/prefs";
import { RoomService } from "./rooms/roomService";
import { RoomStore } from "./rooms/roomStore";
import { SignalRelay } from "./signaling/signalRelay";
import { registerHandlers } from "./socket/registerHandlers";
import type { AppServer } from "./socket/types";

/**
 * Builds the Socket.IO server with all services wired up, without listening yet,
 * so tests can start it on any port.
 */
export function createApp() {
  const io: AppServer = new Server({ cors: { origin: env.clientUrl } });

  // Lets several server instances share rooms and emits through Redis pub/sub.
  const { pubClient, subClient } = createAdapterClients();
  io.adapter(createAdapter(pubClient, subClient));

  const rooms = new RoomService(io, new RoomStore(redis));
  const services = {
    rooms,
    matchmaker: new Matchmaker(io, redis, rooms, env.matchWidenMs),
    signals: new SignalRelay(io, rooms),
  };

  // Matching preferences arrive with the connection: auth.prefs = { mode, language, country }.
  io.use((socket, next) => {
    socket.data.prefs = parsePrefs(socket.handshake.auth?.prefs);
    next();
  });

  io.on("connection", (socket) => registerHandlers(socket, services));

  return {
    io,
    async close() {
      await io.close();
      pubClient.disconnect();
      subClient.disconnect();
    },
  };
}
