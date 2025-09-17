import { Server } from "socket.io";
import { Room } from "../types";
import { redis } from "../configs/redisClient";
import { randomUUID } from 'crypto'

export class RoomManager {

    constructor(private io: Server) {}

    async createRoom(user1Id: string, user2Id: string) {
        const roomId = `room:${randomUUID()}`;
        console.log({ roomId });

        const room: Room = {
            id: roomId,
            user1Id,
            user2Id,
        }
        
        await redis.hset(roomId, room);
        await redis.set(`userRoom:${user1Id}`, roomId);
        await redis.set(`userRoom:${user2Id}`, roomId);

        this.io.to(user2Id).emit("send-offer", { roomId });
    }

    async deleteRoom(roomId: string) {
        const room = await this.getRoom(roomId)
        console.log(room, 'room in delete room');
        if (room.user1Id) await redis.del(`userRoom:${room.user1Id}`);
        if (room.user2Id) await redis.del(`userRoom:${room.user2Id}`);
        return await redis.del(roomId);
    }

    async onOffer(roomId: string, offer: string, senderSocketid: string) {
        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("offer", { offer, roomId });
    }
    
    async onAnswer(roomId: string, answer: string, senderSocketid: string) {
        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("answer", { answer, roomId });
    }

    async onIceCandidates(roomId: string, senderSocketid: string, candidate: any) {
        const receiverId = await this.getRoommate(roomId, senderSocketid);
        if (!receiverId)  return;
        this.io.to(receiverId).emit("add-ice-candidate", ({ candidate }));
    }

    async getRoommate (roomId: string, userId: string): Promise<string | null> {
        const room = await this.getRoom(roomId)
        if (!room.id) return null;
        return room.user1Id === userId ? room.user2Id : room.user1Id;
    }

    async getRoom(roomId: string): Promise<Room> {
        return await redis.hgetall(roomId) as unknown as Room;
    }

}