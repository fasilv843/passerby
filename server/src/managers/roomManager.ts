import { Server } from "socket.io";
import { z } from "zod";
import { MatchedPayload, Room } from "../types";
import { redis } from "../configs/redisClient";
import { getIceServers } from "../configs/iceServers";
import { randomUUID } from 'crypto'

/**
 * One message type carries all WebRTC signaling: either an SDP description
 * (offer or answer) or an ICE candidate. The server only relays it to the roommate.
 */
const signalSchema = z.object({
    roomId: z.string().min(1),
    description: z.object({
        type: z.enum(["offer", "answer", "pranswer", "rollback"]),
        sdp: z.string().optional(),
    }).optional(),
    candidate: z.object({
        candidate: z.string(),
        sdpMid: z.string().nullable().optional(),
        sdpMLineIndex: z.number().nullable().optional(),
        usernameFragment: z.string().nullable().optional(),
    }).nullable().optional(),
});

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

        // Both peers add their tracks and may offer at the same time.
        // Perfect negotiation resolves the collision: user2 is the polite peer.
        const forUser1: MatchedPayload = { roomId, polite: false, iceServers: getIceServers(user1Id) };
        const forUser2: MatchedPayload = { roomId, polite: true, iceServers: getIceServers(user2Id) };
        this.io.to(user1Id).emit("matched", forUser1);
        this.io.to(user2Id).emit("matched", forUser2);
    }

    async deleteRoom(roomId: string) {
        const room = await this.getRoom(roomId)
        console.log(room, 'room in delete room');
        if (room.user1Id) await redis.del(`userRoom:${room.user1Id}`);
        if (room.user2Id) await redis.del(`userRoom:${room.user2Id}`);
        return await redis.del(roomId);
    }

    async onSignal(data: unknown, senderSocketId: string) {
        const parsed = signalSchema.safeParse(data);
        if (!parsed.success) {
            console.warn("dropping invalid signal from", senderSocketId);
            return;
        }
        const { roomId, description, candidate } = parsed.data;
        if (!description && candidate === undefined) return;

        const receiverId = await this.getRoommate(roomId, senderSocketId);
        if (!receiverId) return;
        this.io.to(receiverId).emit("signal", { roomId, description, candidate });
    }

    /** Returns the other user in the room, or null if the room is gone or the sender isn't in it. */
    async getRoommate (roomId: string, userId: string): Promise<string | null> {
        const room = await this.getRoom(roomId)
        if (!room.id) return null;
        if (room.user1Id === userId) return room.user2Id;
        if (room.user2Id === userId) return room.user1Id;
        return null;
    }

    async getRoom(roomId: string): Promise<Room> {
        return await redis.hgetall(roomId) as unknown as Room;
    }

}
