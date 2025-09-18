import Redis from "ioredis";
import { envConfig } from "./environments";
import { logger } from "../utils/logger";

export const redis = new Redis(envConfig.redisUrl);


redis.on("connect", () => {
  logger.info("Connected to Redis");
});

redis.on("ready", () => {
  logger.info("Redis is ready to use");
});

redis.on("error", (err) => {
  logger.error("Redis error:", err);
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

redis.on("reconnecting", (time: number) => {
  logger.info(`Redis reconnecting in ${time}ms`);
});
