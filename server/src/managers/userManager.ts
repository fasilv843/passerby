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
        console.log('removing user', socketId);
        
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x !== socketId);
        console.log('updated queue', this.queue);
        console.log('updated queue length', this.queue.length);
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


        socket.on("pass", ({ roomId }) => {
            console.log('on pass, roomId', roomId);
            
            console.log('pushing current user to queue');
            this.queue.push(socket.id);
            console.log('clearing queue, on pass - after pushing current user', this.queue);
            this.clearQueue();
            console.log('queue after clearing', this.queue);
            
            console.log('getting roommate');
            
            const roommate = this.roomManager.getRoommate(roomId, socket.id);
            const deleted = this.roomManager.deleteRoom(roomId);
            console.log('room deleted', deleted);
            
            if (roommate) {
                console.log('pushing room mate to queue');
                roommate.socket.emit('lobby')
                this.queue.push(roommate.socket.id)
                console.log('clearing queue, on pass - after pushing room mate', this.queue);
                this.clearQueue();
                console.log('queue after clearing', this.queue);
            }
        });


        socket.on("exit", ({ roomId }) => {
            console.log('on exit, roomId', roomId);
            
            socket.disconnect();
            const roommate = this.roomManager.getRoommate(roomId, socket.id);
            const deleted = this.roomManager.deleteRoom(roomId);
            console.log('room deleted', deleted);
            
            if (roommate) {
                roommate.socket.emit('lobby')
                console.log('pushing room mate to queue');
                this.queue.push(roommate.socket.id);
            }
            console.log('clearing queue, on exit');
            this.clearQueue()
        });
    }

}