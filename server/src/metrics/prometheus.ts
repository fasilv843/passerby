import { Gauge, register, collectDefaultMetrics } from "prom-client";
import { redis } from "../configs/redisClient";

// Collect default Node.js metrics
collectDefaultMetrics();

// WebSocket active users gauge
export const activeUsersGauge = new Gauge({
  name: "active_users",
  help: "Number of active websocket users",
});

// Active rooms gauge
export const roomCountGauge = new Gauge({
  name: "active_rooms",
  help: "Number of active rooms",
});

// Queue length gauge (optional)
export const queueLengthGauge = new Gauge({
  name: "queue_length",
  help: "Number of users in matchmaking queue",
});

// Update metrics periodically
export function startMetricsUpdater(io: any, interval = 5000) {
  setInterval(async () => {
    try {
      activeUsersGauge.set(io.of("/").sockets.size);

      const roomKeys = await redis.keys("room:*");
      roomCountGauge.set(roomKeys.length);

      const queueLength = await redis.llen("queue");
      queueLengthGauge.set(queueLength);
    } catch (err) {
      console.error("Error updating metrics:", err);
    }
  }, interval);
}

// Expose Prometheus register for /metrics endpoint
export { register };
