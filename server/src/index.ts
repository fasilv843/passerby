import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import dotenv from 'dotenv'
import { createSocketAdapter } from "./configs/socketAdapter";

dotenv.config()

const PORT = process.env.PORT || 3000;

const io = new Server(Number(PORT), {
    cors: {
        origin: process.env.CLIENT_URL
    }
});


async function start() {

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

  console.log(`Server running on port ${PORT}`);
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

