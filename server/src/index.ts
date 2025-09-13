import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 3000;

const io = new Server(Number(PORT), {
    cors: {
        origin: process.env.CLIENT_URL
    }
});

const userManager = new UserManager();

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    userManager.addUser(socket);
    socket.on('disconnect', () => {
        console.log('a user disconnected');
        userManager.removeUser(socket.id);
    });
});

