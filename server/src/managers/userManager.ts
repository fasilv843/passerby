import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { AddIceCandidateData, AnswerData, OfferData } from "../types";
import { redis } from "../configs/redisClient";
import { logger } from "../utils/logger";
import { roomsPerConnectionHistogram } from "../metrics";

export class UserManager {
    private roomManager: RoomManager;
    
    constructor(private io: Server) {
        this.roomManager = new RoomManager(io);
    }

    async addUser(socket: Socket) {
        logger.info(`Adding user ${socket.id} to queue`);
        await redis.lpush('queue', socket.id)
        await redis.set(`roomCount:${socket.id}`, 0)
        await this.clearQueue()
        this.initListeners(socket);
    }

    async removeUser(socketId: string) {
        logger.info(`Removing user ${socketId}`);
        await redis.lrem("queue", 0, socketId);

        const roomCount = await redis.get(`roomCount:${socketId}`)
        console.log(roomCount, 'roomCount');
        if (roomCount) {
            roomsPerConnectionHistogram.observe(parseInt(roomCount))
            await redis.del(`roomCount:${socketId}`)
        }

        // Check if user was in a room
        const roomId = await redis.get(`userRoom:${socketId}`);
        if (!roomId) {
            logger.info(`User ${socketId} not in any room`);
            return;
        }

        const room = await this.roomManager.getRoom(roomId)
        if (room) {
            logger.info(`User ${socketId} was in room ${room.id}, cleaning up...`);
            const roommateId = await this.roomManager.getRoommate(room.id, socketId);
            this.roomManager.deleteRoom(room.id);

            if (roommateId) {
                logger.info(`Sending roommate ${roommateId} back to lobby`);
                this.io.to(roommateId).emit("lobby");
                await redis.lpush('queue', roommateId)
                await this.clearQueue();
            }
        }
    }

    async clearQueue() {
        logger.info("Starting clearQueue process");

        while (true) {
            const [id1, id2] = await Promise.all([redis.rpop("queue"), redis.rpop("queue")]);
            logger.info(`Pulled from queue -> id1: ${id1}, id2: ${id2}`);

            if (!id1 || !id2) {
                if (id1) {
                    logger.info(`Single user ${id1} left in queue, pushing back`);
                    await redis.lpush("queue", id1);
                }
                logger.info("Exiting clearQueue loop");
                break;
            }

            const sockets = this.io.of("/").sockets; // all connected sockets in default namespace
            const user1Exists = sockets.has(id1);
            const user2Exists = sockets.has(id2);

            if (!user1Exists && !user2Exists) {
                logger.warn(`Both users ${id1}, ${id2} disconnected`);
                continue;
            }

            if (!user1Exists) {
                logger.warn(`User ${id1} not connected, pushing ${id2} back`);
                await redis.lpush("queue", id2);
                continue;
            }

            if (!user2Exists) {
                logger.warn(`User ${id2} not connected, pushing ${id1} back`);
                await redis.lpush("queue", id1);
                continue;
            }

            await this.roomManager.createRoom(id1, id2);
        }
    }

    initListeners(socket: Socket) {
        logger.info(`Initializing listeners for socket ${socket.id}`);

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
            logger.info(`Pass event from user ${socket.id} in room ${roomId}`);
            
            const items = await redis.lrange("queue", 0, -1); // get all items
            const isInQueue = items.includes(socket.id);

            if (isInQueue) {
                logger.info(`User ${socket.id} already in queue, ignoring pass`);
                return;
            }

            logger.info(`Pushing user ${socket.id} to queue`);
            await redis.lpush('queue', socket.id);
            
            const roommateId = await this.roomManager.getRoommate(roomId, socket.id);
            logger.info(`Roommate of ${socket.id} in room ${roomId}: ${roommateId}`);
            
            const deleted = await this.roomManager.deleteRoom(roomId);
            logger.info(`Room ${roomId} deleted: ${deleted}`);
            
            if (roommateId) {
                logger.info(`Sending roommate ${roommateId} back to lobby`);
                this.io.to(roommateId).emit("lobby");
                logger.info(`Pushing roommate ${roommateId} to queue`);
                await redis.lpush("queue", roommateId);
            }

            await this.clearQueue();
        });
    }
}