import { Gauge, Histogram, Counter, register, collectDefaultMetrics } from "prom-client";
import { redis } from "../configs/redisClient";
import { Server } from "socket.io";

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


// How long users stay connected to WebSocket (seconds)
export const connectionDurationHistogram = new Histogram({
  name: "connection_duration_seconds",
  help: "WebSocket connection duration in seconds",
  buckets: [5, 10, 30, 60, 120, 300, 600, 1800, 3600],
});

// How long users stay in a room (seconds)
export const roomDurationHistogram = new Histogram({
  name: "room_duration_seconds",
  help: "Room participation duration in seconds",
  buckets: [5, 10, 30, 60, 120, 300, 600, 1800, 3600],
});

export const roomsPerConnectionHistogram = new Histogram({
  name: "rooms_per_connection",
  help: "Number of rooms engaged per connection",
  buckets: [1, 2, 5, 10, 20, 50] // you decide the ranges
});

// Update metrics periodically
export function startMetricsUpdater(io: Server, interval = 5000) {
  setInterval(async () => {
    try {
      activeUsersGauge.set(io.of("/").sockets.size);

      const roomCount = await redis.hlen("rooms");
      roomCountGauge.set(roomCount);

      const queueLength = await redis.llen("queue");
      queueLengthGauge.set(queueLength);
    } catch (err) {
      console.error("Error updating metrics:", err);
    }
  }, interval);
}

// Expose Prometheus register for /metrics endpoint
export { register };
