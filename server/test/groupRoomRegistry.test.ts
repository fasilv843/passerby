import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GroupRoomRegistry } from "../src/sfu/groupRoomRegistry";
import { WorkerPool } from "../src/sfu/workerPool";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("GroupRoomRegistry", () => {
  let workers: WorkerPool;
  beforeAll(async () => (workers = await WorkerPool.create(1)));
  afterAll(() => workers.close());

  const registry = () => new GroupRoomRegistry(workers, 2, { consumerClosed: () => {} }, 100);

  it("closes a room nobody joins", async () => {
    const rooms = registry();
    const room = await rooms.create();
    expect(rooms.get(room.id)).toBe(room);
    await wait(150);
    expect(() => rooms.get(room.id)).toThrow("doesn't exist");
  });

  it("keeps an occupied room, and closes it once everyone has left", async () => {
    const rooms = registry();
    const room = await rooms.create();
    room.addPeer("p1", "One");
    rooms.keepOpen(room);
    await wait(150);
    expect(rooms.get(room.id)).toBe(room);

    room.removePeer("p1");
    rooms.closeIfStillEmpty(room);
    await wait(150);
    expect(() => rooms.get(room.id)).toThrow("doesn't exist");
  });

  it("enforces the room size limit", async () => {
    const room = await registry().create();
    room.addPeer("a", "A");
    room.addPeer("b", "B");
    expect(() => room.addPeer("c", "C")).toThrow("full");
    expect(() => room.addPeer("a", "A again")).toThrow("Already in this room");
  });
});
