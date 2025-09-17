import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { envConfig } from "./environments";


export async function createSocketAdapter() {
  const pubClient = createClient({ url: envConfig.redisUrl });
  const subClient = pubClient.duplicate();

  await pubClient.connect();
  await subClient.connect();

  return createAdapter(pubClient, subClient);
}
