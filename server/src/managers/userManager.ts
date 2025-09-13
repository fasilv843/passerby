import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";


export interface User {
    socket: Socket;
    // name: string;
    id: string;
}

export class UserManager {
    private users: User[];
    private queue: string[];
    private roomManager: RoomManager;
    
    constructor() {
        this.users = [];
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(socket: Socket) {
        this.users.push({
            // name, socket
            socket, id: socket.id
        })
        this.queue.push(socket.id);
        // socket.emit("lobby");
        this.clearQueue()
        this.initListeners(socket);
    }

    removeUser(socketId: string) {
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x !== socketId);
    }

    clearQueue() {
        console.log("inside clear queues")
        console.log(this.queue.length, 'queue length');
        if (this.queue.length < 2) {
            return;
        }

        const id1 = this.queue.pop();
        const id2 = this.queue.pop();
        console.log("id is " + id1 + " " + id2);
        const user1 = this.users.find(x => x.socket.id === id1);
        const user2 = this.users.find(x => x.socket.id === id2);

        if (!user1 || !user2) {
            return;
        }
        console.log("creating roonm");

        this.roomManager.createRoom(user1, user2);
        this.clearQueue();
    }

    initListeners(socket: Socket) {
        socket.on("offer", ({offer, roomId}: {offer: string, roomId: string}) => {
            this.roomManager.onOffer(roomId, offer, socket.id);
        })

        socket.on("answer",({ roomId, answer }: {roomId: string, answer: string }) => {
            this.roomManager.onAnswer(roomId, answer, socket.id);
        })

        socket.on("add-ice-candidate", ({candidate, roomId, type}) => {
            console.log('add-ice-candidate', { candidate, roomId, type });
            
            this.roomManager.onIceCandidates(roomId, socket.id, candidate, type);
        });
    }

}