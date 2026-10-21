import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import { redis } from "../configs/redisClient";
import { Matchmaker } from "../matching/matchmaker";
import { MatchPrefs } from "../matching/prefs";

export class UserManager {
    private roomManager: RoomManager;
    private matchmaker: Matchmaker;

    constructor(private io: Server) {
        this.roomManager = new RoomManager(io);
        this.matchmaker = new Matchmaker(io, this.roomManager);
    }

    addUser(socket: Socket) {
        // The client asks to be matched with "find" once its listeners are ready.
        this.initListeners(socket);
    }

    async removeUser(socketId: string) {
        console.log('removing user', socketId);
        await this.matchmaker.leave(socketId);
        await this.leaveRoom(socketId);
    }

    /**
     * Close the user's room, if any, and send the other person back to the lobby.
     * Their client then asks to be matched again.
     */
    private async leaveRoom(socketId: string, roomId?: string) {
        const currentRoomId = roomId ?? await redis.get(`userRoom:${socketId}`);
        if (!currentRoomId) return;

        const roommateId = await this.roomManager.getRoommate(currentRoomId, socketId);
        if (!roommateId) return; // not this user's room

        await this.roomManager.deleteRoom(currentRoomId);
        this.io.to(roommateId).emit("lobby");
    }

    initListeners(socket: Socket) {
        const prefs = socket.data.prefs as MatchPrefs;

        socket.on("signal", (data: unknown) => {
            this.roomManager.onSignal(data, socket.id);
        });

        socket.on("find", async () => {
            try {
                if (await redis.get(`userRoom:${socket.id}`)) return; // already in a room
                await this.matchmaker.find(socket.id, prefs);
            } catch (err) {
                console.error("find failed", err);
            }
        });

        socket.on("pass", async ({ roomId }: { roomId?: string } = {}) => {
            if (typeof roomId !== "string") return;
            try {
                await this.leaveRoom(socket.id, roomId);
                await this.matchmaker.find(socket.id, prefs);
            } catch (err) {
                console.error("pass failed", err);
            }
        });
    }
}
