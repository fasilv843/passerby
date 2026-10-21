import { randomUUID } from "crypto";
import type Redis from "ioredis";
import { redisKeys } from "../redis/keys";

/** A call between two users. user1 is the impolite peer in perfect negotiation. */
export interface Room {
  id: string;
  user1Id: string;
  user2Id: string;
}

/** Room persistence in Redis. No Socket.IO here: callers decide who to notify. */
export class RoomStore {
  constructor(private readonly redis: Redis) {}

  async create(user1Id: string, user2Id: string): Promise<Room> {
    const room: Room = { id: `${redisKeys.roomPrefix}${randomUUID()}`, user1Id, user2Id };
    await this.redis
      .multi()
      .hset(room.id, room)
      .set(redisKeys.userRoom(user1Id), room.id)
      .set(redisKeys.userRoom(user2Id), room.id)
      .exec();
    return room;
  }

  async get(roomId: string): Promise<Room | null> {
    const data = await this.redis.hgetall(roomId);
    if (!data.id || !data.user1Id || !data.user2Id) return null;
    return { id: data.id, user1Id: data.user1Id, user2Id: data.user2Id };
  }

  /** The room the user is currently in, if any. */
  findRoomIdFor(userId: string): Promise<string | null> {
    return this.redis.get(redisKeys.userRoom(userId));
  }

  async delete(room: Room): Promise<void> {
    await this.redis
      .multi()
      .del(redisKeys.userRoom(room.user1Id))
      .del(redisKeys.userRoom(room.user2Id))
      .del(room.id)
      .exec();
  }
}

/** The other user in the room, or null if `userId` isn't in it. */
export function roommateOf(room: Room, userId: string): string | null {
  if (room.user1Id === userId) return room.user2Id;
  if (room.user2Id === userId) return room.user1Id;
  return null;
}
