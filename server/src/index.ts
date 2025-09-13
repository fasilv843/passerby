import { Server } from "socket.io";
import { UserManager } from "./managers/userManager";

const io = new Server(3000, {
    cors: {
        origin: "*"
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
    // socket.on('message', (message) => {
    //     console.log('message: ', message);
    // });
    // socket.on('chat message', (message) => {
    //     io.emit('chat message', message);
    // });
});

