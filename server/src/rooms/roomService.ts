import { getIceServers } from "../config/iceServers";
import type { AppServer } from "../socket/types";
import { roommateOf, RoomStore } from "./roomStore";
import type { Room } from "./roomStore";

/** Opens and closes rooms, and tells the users involved. */
export class RoomService {
  constructor(private readonly io: AppServer, private readonly store: RoomStore) {}

  /**
   * Puts two users in a room and sends each of them "matched".
   * Both peers add their tracks and may offer at the same time; perfect
   * negotiation resolves the collision, with user2 as the polite peer.
   */
  async open(user1Id: string, user2Id: string): Promise<Room> {
    const room = await this.store.create(user1Id, user2Id);
    this.io.to(user1Id).emit("matched", { roomId: room.id, polite: false, iceServers: getIceServers(user1Id) });
    this.io.to(user2Id).emit("matched", { roomId: room.id, polite: true, iceServers: getIceServers(user2Id) });
    return room;
  }

  async isInRoom(userId: string): Promise<boolean> {
    return (await this.store.findRoomIdFor(userId)) !== null;
  }

  /** The other user in a room, only if `userId` is in it. */
  async roommate(roomId: string, userId: string): Promise<string | null> {
    const room = await this.store.get(roomId);
    return room ? roommateOf(room, userId) : null;
  }

  /**
   * Closes the user's room and sends the other person back to the lobby.
   * `roomId` defaults to the room the user is currently in.
   */
  async leave(userId: string, roomId?: string): Promise<void> {
    const id = roomId ?? (await this.store.findRoomIdFor(userId));
    if (!id) return;

    const room = await this.store.get(id);
    const partnerId = room && roommateOf(room, userId);
    if (!room || !partnerId) return; // not this user's room

    await this.store.delete(room);
    this.io.to(partnerId).emit("lobby");
  }
}
