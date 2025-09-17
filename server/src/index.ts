import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import { createSocketAdapter } from "./configs/socketAdapter";
import { envConfig } from "./configs/environments";
import http from "http";
import { register, startMetricsUpdater } from "./metrics";

const httpServer = http.createServer();

const io = new Server(httpServer, {
    cors: {
        origin: envConfig.clientUrl
    }
});


(async function start() {

  io.adapter(await createSocketAdapter());

  const userManager = new UserManager(io);

  io.on("connection", (socket) => {
    console.log("user connected", socket.id);
    userManager.addUser(socket);

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
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
  console.log(`Server running on port ${envConfig.port}, metrics at /metrics`);
});

