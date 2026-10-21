import { readFileSync } from "fs";
import { join } from "path";
import { Server } from "socket.io";
import { redis } from "../configs/redisClient";
import { RoomManager } from "../managers/roomManager";
import { MatchPrefs, searchStages } from "./prefs";
import { envConfig } from "../configs/environments";

/** Give up after this many stale (disconnected) partners in a row and just wait. */
const MAX_STALE_PARTNERS = 10;

type ScriptResult = ["matched", string] | ["waiting"] | ["gone"] | ["left"];

declare module "ioredis" {
  interface RedisCommander<Context> {
    matchOrWait(numKeys: number, ...args: string[]): Promise<ScriptResult>;
  }
}

redis.defineCommand("matchOrWait", {
  lua: readFileSync(join(__dirname, "matchOrWait.lua"), "utf8"),
});

export class Matchmaker {
  /** Widening timers for users connected to this server instance. */
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private io: Server, private roomManager: RoomManager) {}

  /** Start (or restart) a search from the most specific stage. */
  async find(userId: string, prefs: MatchPrefs) {
    await this.search(userId, prefs, 0, "join");
  }

  /** Remove the user from every queue. */
  async leave(userId: string) {
    this.clearTimer(userId);
    await redis.matchOrWait(0, userId, "leave");
  }

  private async search(userId: string, prefs: MatchPrefs, stageIndex: number, action: "join" | "widen") {
    this.clearTimer(userId);
    const stages = searchStages(prefs);
    const stage = stages[Math.min(stageIndex, stages.length - 1)];

    for (let attempt = 0; attempt < MAX_STALE_PARTNERS; attempt++) {
      const result = await redis.matchOrWait(stage.queues.length, ...stage.queues, userId, action);

      if (result[0] === "gone") return; // matched by someone else in the meantime

      if (result[0] === "matched") {
        const partnerId = result[1];
        if (await this.isConnected(partnerId)) {
          // The partner has been waiting longer, so they become user1 (impolite peer).
          await this.roomManager.createRoom(partnerId, userId);
          return;
        }
        // Partner disconnected without being cleaned up: try the next one.
        // The script already removed both of us from all queues, so "join" again.
        action = "join";
        continue;
      }

      break; // waiting
    }

    this.io.to(userId).emit("queue-status", { scope: stage.scope });

    if (stageIndex < stages.length - 1) {
      this.timers.set(
        userId,
        setTimeout(() => {
          this.timers.delete(userId);
          this.search(userId, prefs, stageIndex + 1, "widen").catch((err) =>
            console.error("widen failed", err)
          );
        }, envConfig.matchWidenMs)
      );
    }
  }

  private async isConnected(userId: string) {
    // fetchSockets() asks every server instance through the Redis adapter.
    const sockets = await this.io.in(userId).fetchSockets();
    return sockets.length > 0;
  }

  private clearTimer(userId: string) {
    const timer = this.timers.get(userId);
    if (timer) clearTimeout(timer);
    this.timers.delete(userId);
  }
}
