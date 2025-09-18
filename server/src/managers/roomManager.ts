import { Server } from "socket.io";
import { Room } from "../types";
import { redis } from "../configs/redisClient";
import { randomUUID } from 'crypto'
import { logger } from "../utils/logger";
import { roomDurationHistogram } from "../metrics";

export class RoomManager {

    constructor(private io: Server) {}

    async createRoom(user1Id: string, user2Id: string) {
        const roomId = `room:${randomUUID()}`;
        logger.info(`Creating room ${roomId} for users ${user1Id} and ${user2Id}`);

        const room: Room = { 
            id: roomId, 
            user1Id, 
            user2Id,
            createdAt: Date.now()
        };
        
        try {
            await redis.hset("rooms", roomId, JSON.stringify(room));
            await redis.set(`userRoom:${user1Id}`, roomId);
            await redis.set(`userRoom:${user2Id}`, roomId);
            await redis.incr(`roomCount:${user1Id}`);
            await redis.incr(`roomCount:${user2Id}`);

            logger.info(`Room ${roomId} persisted in Redis`);
            this.io.to(user2Id).emit("send-offer", { roomId });
            logger.info(`Sent "send-offer" to user ${user2Id}`);
        } catch (err) {
            logger.error(`Failed to create room ${roomId}: ${(err as Error).message}`);
        }
    }

    async deleteRoom(roomId: string): Promise<boolean> {
        logger.info(`Deleting room ${roomId}`);
        const room = await this.getRoom(roomId);

        if (!room) {
            logger.warn(`Room ${roomId} not found in deleteRoom`);
            return false;
        }

        try {
            if (room.user1Id) {
                await redis.del(`userRoom:${room.user1Id}`);
                logger.info(`Removed mapping userRoom:${room.user1Id}`);
            }
            if (room.user2Id) {
                await redis.del(`userRoom:${room.user2Id}`);
                logger.info(`Removed mapping userRoom:${room.user2Id}`);
            }

            const { createdAt } = room;
            const duration = (Date.now() - createdAt) / 1000;
            roomDurationHistogram.observe(duration);

            await redis.hdel("rooms", roomId);
            logger.info(`Room ${roomId} deleted from Redis`);
            return true;
        } catch (err) {
            logger.error(`Error deleting room ${roomId}: ${(err as Error).message}`);
            return false;
        }
    }

    async onOffer(roomId: string, offer: string, senderSocketid: string) {
        logger.info(`Offer from ${senderSocketid} in room ${roomId}`);

        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("offer", { offer, roomId });

        logger.info(`Forwarded offer from ${senderSocketid} to ${receiverId} in room ${roomId}`);
    }
    
    async onAnswer(roomId: string, answer: string, senderSocketid: string) {
        logger.info(`Answer from ${senderSocketid} in room ${roomId}`);
        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("answer", { answer, roomId });
        logger.info(`Forwarded answer from ${senderSocketid} to ${receiverId} in room ${roomId}`);
    }

    async onIceCandidates(roomId: string, senderSocketid: string, candidate: any) {
        logger.info(`ICE candidate from ${senderSocketid} in room ${roomId}`);
        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("add-ice-candidate", ({ candidate }));
        logger.info(`Forwarded ICE candidate from ${senderSocketid} to ${receiverId} in room ${roomId}`);
    }

    async getRoommate (roomId: string, userId: string): Promise<string | null> {
        const room = await this.getRoom(roomId)
        if (!room) {
            logger.warn(`Room ${roomId} not found when looking for roommate of ${userId}`);
            return null;
        }
        const roommateId = room.user1Id === userId ? room.user2Id : room.user1Id;
        logger.info(`Roommate of ${userId} in room ${roomId} is ${roommateId}`);
        return roommateId;
    }

    async getRoom(roomId: string): Promise<Room | null> {
        try {
            const roomString = await redis.hget("rooms", roomId);
            if (!roomString) {
                logger.warn(`Room ${roomId} not found in getRoom`);
                return null;
            }
            const room = JSON.parse(roomString) as Room;
            logger.info(`Fetched room ${roomId} from Redis`);
            return room;
        } catch (err) {
            logger.error(`Error fetching room ${roomId}: ${(err as Error).message}`);
            return null;
        }
    }

}