import Redis from "ioredis";
import { envConfig } from "./environments";

export const redis = new Redis(envConfig.redisUrl);


redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("ready", () => {
  console.log("Redis is ready to use");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

redis.on("close", () => {
  console.warn("⚠ Redis connection closed");
});

redis.on("reconnecting", (time: number) => {
  console.log(`🔄 Redis reconnecting in ${time}ms`);
});
