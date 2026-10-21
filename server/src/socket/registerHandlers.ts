import { passSchema } from "../contracts/schemas";
import { createLogger } from "../logger";
import type { Matchmaker } from "../matching/matchmaker";
import type { RoomService } from "../rooms/roomService";
import type { SignalRelay } from "../signaling/signalRelay";
import type { AppSocket } from "./types";

const log = createLogger("socket");

export interface Services {
  rooms: RoomService;
  matchmaker: Matchmaker;
  signals: SignalRelay;
}

/**
 * Wires one connection's events to the services.
 * Handlers stay thin: validate, delegate, and log failures so one bad
 * request can't crash the process with an unhandled rejection.
 */
export function registerHandlers(socket: AppSocket, { rooms, matchmaker, signals }: Services) {
  const userId = socket.id;
  const { prefs } = socket.data;

  const safely = (event: string, handler: () => Promise<void>) => {
    handler().catch((err) => log.error(`"${event}" failed for ${userId}`, err));
  };

  socket.on("find", () =>
    safely("find", async () => {
      if (await rooms.isInRoom(userId)) return;
      await matchmaker.find(userId, prefs);
    })
  );

  socket.on("pass", (payload) =>
    safely("pass", async () => {
      const parsed = passSchema.safeParse(payload);
      if (!parsed.success) return;
      await rooms.leave(userId, parsed.data.roomId);
      await matchmaker.find(userId, prefs);
    })
  );

  socket.on("signal", (message) => safely("signal", () => signals.relay(userId, message)));

  socket.on("disconnect", () =>
    safely("disconnect", async () => {
      await matchmaker.leave(userId);
      await rooms.leave(userId);
    })
  );
}
