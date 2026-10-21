import { randomBytes } from "crypto";
import { createLogger } from "../logger";
import { GroupError } from "./groupError";
import { GroupRoom } from "./groupRoom";
import type { GroupNotifier } from "./groupRoom";
import type { WorkerPool } from "./workerPool";

const log = createLogger("sfu");

/** An empty room (just created, or everyone left) is closed after this long. */
const EMPTY_ROOM_TTL_MS = 60_000;

/**
 * Group rooms on this server instance. Rooms live in memory because the media
 * (the mediasoup router) lives in this process, so everyone in a room must be
 * connected to the same instance. See docs/group-rooms.md for scaling.
 */
export class GroupRoomRegistry {
  private readonly rooms = new Map<string, GroupRoom>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly workers: WorkerPool,
    private readonly maxPeersPerRoom: number,
    private readonly notifier: GroupNotifier,
    private readonly emptyRoomTtlMs = EMPTY_ROOM_TTL_MS
  ) {}

  async create(): Promise<GroupRoom> {
    const id = randomBytes(8).toString("base64url"); // 11 characters, hard to guess
    const room = await GroupRoom.create(id, this.workers.next(), this.maxPeersPerRoom, this.notifier);
    this.rooms.set(id, room);
    this.closeIfStillEmpty(room); // nobody may ever join
    log.info(`room ${id} created`);
    return room;
  }

  get(roomId: string): GroupRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new GroupError("This room doesn't exist or has ended");
    return room;
  }

  /** Call after someone joins, so a pending empty-room cleanup doesn't close it. */
  keepOpen(room: GroupRoom) {
    clearTimeout(this.cleanupTimers.get(room.id));
    this.cleanupTimers.delete(room.id);
  }

  /** Call after someone leaves. */
  closeIfStillEmpty(room: GroupRoom) {
    if (room.size > 0) return;
    clearTimeout(this.cleanupTimers.get(room.id));
    this.cleanupTimers.set(
      room.id,
      setTimeout(() => {
        this.cleanupTimers.delete(room.id);
        if (room.size > 0) return;
        room.close();
        this.rooms.delete(room.id);
        log.info(`room ${room.id} closed (empty)`);
      }, this.emptyRoomTtlMs)
    );
  }

  closeAll() {
    this.cleanupTimers.forEach(clearTimeout);
    this.cleanupTimers.clear();
    this.rooms.forEach((room) => room.close());
    this.rooms.clear();
  }
}
