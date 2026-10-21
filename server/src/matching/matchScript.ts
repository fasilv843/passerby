import { readFileSync } from "fs";
import { join } from "path";
import type Redis from "ioredis";
import { redisKeys } from "../redis/keys";

/**
 * Typed wrapper around matchOrWait.lua. See that file for how the script works;
 * the point of running it in Redis is that search + pair + enqueue is atomic.
 */

export type MatchAction = "join" | "widen" | "leave";

export type MatchResult =
  | { status: "matched"; partnerId: string }
  | { status: "waiting" }
  /** "widen" found the user already matched by someone else. */
  | { status: "gone" }
  | { status: "left" };

type RawResult = ["matched", string] | ["waiting"] | ["gone"] | ["left"];

declare module "ioredis" {
  interface RedisCommander<Context> {
    matchOrWait(numKeys: number, ...args: string[]): Promise<RawResult>;
  }
}

const script = readFileSync(join(__dirname, "matchOrWait.lua"), "utf8");
const registered = new WeakSet<Redis>();

export async function runMatchScript(
  redis: Redis,
  queues: string[],
  userId: string,
  action: MatchAction
): Promise<MatchResult> {
  if (!registered.has(redis)) {
    // defineCommand loads the script once with SCRIPT LOAD and then calls it by hash.
    redis.defineCommand("matchOrWait", { lua: script });
    registered.add(redis);
  }

  const [status, partnerId] = await redis.matchOrWait(
    queues.length,
    ...queues,
    userId,
    action,
    redisKeys.waitingPrefix
  );
  return status === "matched" ? { status, partnerId: partnerId! } : { status };
}
