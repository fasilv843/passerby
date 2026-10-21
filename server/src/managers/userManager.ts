import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { redis } from "../configs/redisClient";

export class UserManager {
    private roomManager: RoomManager;
    
    constructor(private io: Server) {
        this.roomManager = new RoomManager(io);
    }

    async addUser(socket: Socket) {
        // Register listeners first: once paired, this user may send a signal
        // before the queue processing below has finished.
        this.initListeners(socket);
        await redis.lpush('queue', socket.id)
        await this.clearQueue()
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
        socket.on("signal", (data: unknown) => {
            this.roomManager.onSignal(data, socket.id);
        });

        socket.on("pass", async ({ roomId }: { roomId?: string } = {}) => {
            if (typeof roomId !== "string") return;
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