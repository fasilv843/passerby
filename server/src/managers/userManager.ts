import { Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { AddIceCandidateData, AnswerData, OfferData, User } from "../types";
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
            socket, id: socket.id
        })
        this.queue.push(socket.id);
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
        console.log("creating room");

        this.roomManager.createRoom(user1, user2);
        this.clearQueue();
    }

    initListeners(socket: Socket) {
        socket.on("offer", ({ roomId, offer }: OfferData) => {
            this.roomManager.onOffer(roomId, offer, socket.id);
        })

        socket.on("answer",({ roomId, answer }: AnswerData) => {
            this.roomManager.onAnswer(roomId, answer, socket.id);
        })

        socket.on("add-ice-candidate", ({ roomId, candidate }: AddIceCandidateData) => {
            this.roomManager.onIceCandidates(roomId, socket.id, candidate);
        });
    }

}