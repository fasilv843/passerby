import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";


// // Setup Redis pub/sub for socket.io
// const pubClient = createClient({ url: process.env.REDIS_URL });
// const subClient = pubClient.duplicate();

//   await pubClient.connect();
//   await subClient.connect();

// const socketAdapter = createAdapter(pubClient, subClient);

// export default socketAdapter

export async function createSocketAdapter() {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  await pubClient.connect();
  await subClient.connect();

  return createAdapter(pubClient, subClient);
}