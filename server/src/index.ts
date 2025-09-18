import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import { createSocketAdapter } from "./configs/socketAdapter";
import { envConfig } from "./configs/environments";
import http from "http";
import { connectionDurationHistogram, register, startMetricsUpdater } from "./metrics";
import { logger } from "./utils/logger";

const httpServer = http.createServer();

const io = new Server(httpServer, {
    cors: {
        origin: envConfig.clientUrl
    }
});

const connectionStartTimes = new Map<string, number>();

(async function start() {

  io.adapter(await createSocketAdapter());

  const userManager = new UserManager(io);

  io.on("connection", (socket) => {
    connectionStartTimes.set(socket.id, Date.now());
    logger.info(`user connected, socket_id: ${socket.id}`);
    userManager.addUser(socket);

    socket.on("disconnect", async () => {
      logger.info(`user disconnected, socket_id: ${socket.id}`);
      const start = connectionStartTimes.get(socket.id);
      if (start) {
        const duration = (Date.now() - start) / 1000; // seconds
        connectionDurationHistogram.observe(duration);
        connectionStartTimes.delete(socket.id);
      }

      userManager.removeUser(socket.id);
    });
  });
})();


// Start Prometheus metrics updater
startMetricsUpdater(io);


httpServer.on("request", async (req, res) => {
  if (req.url === "/metrics") {
    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
  } else {
    res.statusCode = 404;
    res.end("Not Found");
  }
});


httpServer.listen(envConfig.port, () => {
  logger.info(`Server running on port ${envConfig.port}, metrics at /metrics`);
});

