import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { AddIceCandidateData, AnswerData, OfferData } from "../types";
import { redis } from "../configs/redisClient";

export class UserManager {
    private roomManager: RoomManager;
    
    constructor(private io: Server) {
        this.roomManager = new RoomManager(io);
    }

    async addUser(socket: Socket) {
        await redis.lpush('queue', socket.id)
        await this.clearQueue()
        this.initListeners(socket);
    }

    async removeUser(socketId: string) {
        console.log('removing user', socketId);
        await redis.lrem("queue", 0, socketId);

        // Check if user was in a room
        const roomId = await redis.get(`userRoom:${socketId}`);
        if (!roomId) return

        const room = await this.roomManager.getRoom(roomId)
        if (room) {
            console.log(`User ${socketId} was in room ${room.id}, cleaning up...`);
            const roommateId = await this.roomManager.getRoommate(room.id, socketId);
            this.roomManager.deleteRoom(room.id);

            if (roommateId) {
                this.io.to(roommateId).emit("lobby");
                await redis.lpush('queue', roommateId)
                await this.clearQueue();
            }
        }
    }

    async clearQueue() {
        console.log("inside clear queues")

        while (true) {
            const [id1, id2] = await Promise.all([redis.rpop("queue"), redis.rpop("queue")]);
            console.log("id is " + id1 + " " + id2);

            if (!id1 || !id2) {
                if (id1) await redis.lpush("queue", id1);
                break;
            }

            const sockets = this.io.of("/").sockets; // all connected sockets in default namespace
            const user1Exists = sockets.has(id1);
            const user2Exists = sockets.has(id2);

            if (!user1Exists && !user2Exists) {
                continue;
            }

            if (!user1Exists) {
                await redis.lpush("queue", id2);
                continue;
            }

            if (!user2Exists) {
                await redis.lpush("queue", id1);
                continue;
            }

            console.log("creating room");
            await this.roomManager.createRoom(id1, id2);
        }
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


        socket.on("pass", async ({ roomId }) => {
            console.log('on pass, roomId', roomId);
            
            console.log('pushing current user to queue');
            await redis.lpush('queue', socket.id);
            
            const roommateId = await this.roomManager.getRoommate(roomId, socket.id);
            console.log(roommateId, 'roommateId');
            
            const deleted = await this.roomManager.deleteRoom(roomId);
            console.log('room deleted', deleted);
            
            if (roommateId) {
                this.io.to(roommateId).emit('lobby')
                console.log('pushing roommate to queue');
                await redis.lpush('queue', roommateId)
            }
            await this.clearQueue();
        });
    }
}