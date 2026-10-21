import { createApp } from "./app";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { createLogger } from "./logger";

const log = createLogger("server");

const app = createApp();
app.io.listen(env.port);
log.info(`listening on port ${env.port}`);

async function shutdown(signal: string) {
  log.info(`${signal} received, shutting down`);
  await app.close();
  // quit() waits for commands already sent, e.g. from disconnect handlers.
  await redis.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
