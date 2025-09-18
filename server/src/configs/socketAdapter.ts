import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { envConfig } from "./environments";

export async function createSocketAdapter() {
  const pubClient = new Redis(envConfig.redisUrl);
  const subClient = pubClient.duplicate();

  return createAdapter(pubClient, subClient);
}

