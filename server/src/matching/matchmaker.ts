import type Redis from "ioredis";
import { createLogger } from "../logger";
import type { RoomService } from "../rooms/roomService";
import type { AppServer } from "../socket/types";
import { runMatchScript } from "./matchScript";
import type { MatchAction } from "./matchScript";
import { searchStages } from "./prefs";
import type { MatchPrefs } from "./prefs";

const log = createLogger("matching");

/** Give up after this many disconnected partners in a row and just wait. */
const MAX_STALE_PARTNERS = 10;

/**
 * Pairs users, widening each user's search over time:
 * same language and country → same language → anyone.
 */
export class Matchmaker {
  /** Widening timers for users connected to this server instance. */
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly io: AppServer,
    private readonly redis: Redis,
    private readonly rooms: RoomService,
    private readonly widenAfterMs: number
  ) {}

  /** Start (or restart) a search from the most specific stage. */
  async find(userId: string, prefs: MatchPrefs): Promise<void> {
    await this.search(userId, prefs, 0, "join");
  }

  /** Remove the user from every queue. */
  async leave(userId: string): Promise<void> {
    this.clearTimer(userId);
    await runMatchScript(this.redis, [], userId, "leave");
  }

  private async search(userId: string, prefs: MatchPrefs, stageIndex: number, action: MatchAction) {
    this.clearTimer(userId);
    const stages = searchStages(prefs);
    const stage = stages[Math.min(stageIndex, stages.length - 1)];

    for (let attempt = 0; attempt < MAX_STALE_PARTNERS; attempt++) {
      const result = await runMatchScript(this.redis, stage.queues, userId, action);

      if (result.status === "gone") return; // someone else matched this user meanwhile
      if (result.status !== "matched") break; // now waiting

      if (await this.isConnected(result.partnerId)) {
        // The partner has waited longer, so they become user1 (the impolite peer).
        await this.rooms.open(result.partnerId, userId);
        return;
      }
      // The partner disconnected without being cleaned up. The script already took
      // both users out of every queue, so search again from scratch.
      log.warn(`skipping disconnected partner ${result.partnerId}`);
      action = "join";
    }

    this.io.to(userId).emit("queue-status", { scope: stage.scope });

    const hasWiderStage = stageIndex < stages.length - 1;
    if (hasWiderStage) this.scheduleWiden(userId, prefs, stageIndex + 1);
  }

  private scheduleWiden(userId: string, prefs: MatchPrefs, nextStage: number) {
    const timer = setTimeout(() => {
      this.timers.delete(userId);
      this.search(userId, prefs, nextStage, "widen").catch((err) => log.error("widening failed", err));
    }, this.widenAfterMs);
    this.timers.set(userId, timer);
  }

  /** Asks every server instance (through the Redis adapter) whether the user is still connected. */
  private async isConnected(userId: string) {
    const sockets = await this.io.in(userId).fetchSockets();
    return sockets.length > 0;
  }

  private clearTimer(userId: string) {
    clearTimeout(this.timers.get(userId));
    this.timers.delete(userId);
  }
}
