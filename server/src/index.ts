import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import dotenv from 'dotenv'
import { createSocketAdapter } from "./configs/socketAdapter";
import { envConfig } from "./configs/environments";
import { parsePrefs } from "./matching/prefs";

dotenv.config()

const io = new Server(Number(envConfig.port), {
    cors: {
        origin: envConfig.clientUrl
    }
});


async function start() {

  io.adapter(await createSocketAdapter());

  const userManager = new UserManager(io);

  // Matching preferences come with the connection: { mode, language, country }.
  io.use((socket, next) => {
    socket.data.prefs = parsePrefs(socket.handshake.auth?.prefs);
    next();
  });

  io.on("connection", (socket) => {
    console.log("user connected", socket.id);
    userManager.addUser(socket);

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
      userManager.removeUser(socket.id);
    });
  });

  console.log(`Server running on port ${envConfig.port}`);
}

start();

// const userManager = new UserManager();

// io.on('connection', (socket) => {
//     console.log('a user connected', socket.id);
//     userManager.addUser(socket);
//     socket.on('disconnect', () => {
//         console.log('a user disconnected', socket.id);
//         userManager.removeUser(socket.id);
//     });
// });

