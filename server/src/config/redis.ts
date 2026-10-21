import Redis from "ioredis";
import { env } from "./env";
import { createLogger } from "../logger";

const log = createLogger("redis");

/** Shared connection for app data (rooms, queues). */
export const redis = new Redis(env.redisUrl);

redis.on("ready", () => log.info("connected"));
redis.on("error", (err) => log.error("connection error", err.message));
redis.on("reconnecting", (delayMs: number) => log.warn(`reconnecting in ${delayMs}ms`));

/**
 * The Socket.IO Redis adapter needs its own publish and subscribe connections:
 * a connection in subscribe mode can't run normal commands.
 */
export function createAdapterClients() {
  return { pubClient: redis.duplicate(), subClient: redis.duplicate() };
}
