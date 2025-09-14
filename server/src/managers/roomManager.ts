import { Room, User } from "../types";

let GLOBAL_ROOM_ID = 1;

export class RoomManager {
    private rooms: Map<string, Room>
    private userRoom: Map<string, string>;
    constructor() {
        this.rooms = new Map<string, Room>()
        this.userRoom = new Map<string, string>();
    }

    createRoom(user1: User, user2: User) {
        const roomId = this.generate().toString();
        console.log({ roomId });

        const room: Room = {
            id: roomId,
            user1,
            user2,
        }
        
        this.rooms.set(roomId, room)
        this.userRoom.set(user1.socket.id, roomId);
        this.userRoom.set(user2.socket.id, roomId);

        // user1.socket.emit("send-offer", { roomId });
        user2.socket.emit("send-offer", { roomId });
    }

    deleteRoom(roomId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            this.userRoom.delete(room.user1.socket.id);
            this.userRoom.delete(room.user2.socket.id);
        }
        return this.rooms.delete(roomId);
    }

    getRoomByUser(socketId: string) {
        const roomId = this.userRoom.get(socketId);
        if (!roomId) return;
        return this.rooms.get(roomId);
    }

    onOffer(roomId: string, offer: string, senderSocketid: string) {
        const receivingUser = this.getRoommate(roomId, senderSocketid);
        if (!receivingUser)  return;
        receivingUser.socket.emit("offer", { offer, roomId })
    }
    
    onAnswer(roomId: string, answer: string, senderSocketid: string) {
        const receivingUser = this.getRoommate(roomId, senderSocketid);
        if (!receivingUser)  return;
        receivingUser.socket.emit("answer", { answer, roomId });
    }

    onIceCandidates(roomId: string, senderSocketid: string, candidate: any) {
        const receivingUser = this.getRoommate(roomId, senderSocketid);
        if (!receivingUser)  return;
        receivingUser.socket.emit("add-ice-candidate", ({ candidate }));
    }

    getRoommate (roomId: string, socketId: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        return room.user1.socket.id === socketId ? room.user2: room.user1;
    }

    generate() {
        return GLOBAL_ROOM_ID++;
    }

}