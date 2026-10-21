/**
 * End-to-end matching against a real Redis, with real Socket.IO clients.
 * Skipped when Redis isn't reachable at REDIS_URL (default redis://localhost:6379).
 *
 *   docker run --rm -p 6379:6379 redis:7   # then: npm test
 */
import { createServer } from "http";
import type { AddressInfo } from "net";
import { connect as tcpConnect } from "net";
import { io as connectClient, type Socket } from "socket.io-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

function redisReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tcpConnect(Number(redisUrl.port || 6379), redisUrl.hostname);
    socket.setTimeout(500);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

const available = await redisReachable();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TestUser {
  socket: Socket;
  rooms: string[];
  scopes: string[];
  lobbyCount: number;
}

describe.skipIf(!available)("matchmaking (needs Redis)", () => {
  type App = ReturnType<typeof import("../src/app").createApp>;
  const apps: App[] = [];
  const urls: string[] = [];
  let users: TestUser[] = [];
  let redis: typeof import("../src/config/redis").redis;

  /** Connects a client that behaves like the real one: "find" on connect and after "lobby". */
  function join(prefs: object, server = 0): TestUser {
    const socket = connectClient(urls[server], { transports: ["websocket"], forceNew: true, auth: { prefs } });
    const user: TestUser = { socket, rooms: [], scopes: [], lobbyCount: 0 };
    socket.on("matched", ({ roomId }) => user.rooms.push(roomId));
    socket.on("queue-status", ({ scope }) => user.scopes.push(scope));
    socket.on("lobby", () => { user.lobbyCount++; socket.emit("find"); });
    socket.on("connect", () => socket.emit("find"));
    users.push(user);
    return user;
  }

  beforeAll(async () => {
    const { createApp } = await import("../src/app");
    ({ redis } = await import("../src/config/redis"));
    await redis.flushdb();
    // Two server instances sharing Redis, like a scaled deployment.
    for (let i = 0; i < 2; i++) {
      const app = await createApp();
      const http = createServer();
      app.io.attach(http);
      await new Promise<void>((resolve) => http.listen(0, resolve));
      apps.push(app);
      urls.push(`http://localhost:${(http.address() as AddressInfo).port}`);
    }
  });

  beforeEach(async () => {
    users.forEach((u) => u.socket.disconnect());
    users = [];
    await wait(200);
  });

  afterAll(async () => {
    users.forEach((u) => u.socket.disconnect());
    await wait(300); // let the server's disconnect handlers finish their Redis calls
    await Promise.all(apps.map((app) => app.close()));
    await redis.flushdb();
    await redis.quit();
  });

  it("pairs users with the same language and country immediately", async () => {
    const a = join({ mode: "video", language: "ml", country: "IN" });
    await wait(200);
    const b = join({ mode: "video", language: "ml", country: "IN" });
    await wait(300);
    expect(a.scopes).toEqual(["exact"]);
    expect(a.rooms).toHaveLength(1);
    expect(b.rooms).toEqual(a.rooms);
  });

  it("widens to the same language when countries differ", async () => {
    const c = join({ mode: "video", language: "ta", country: "IN" });
    const d = join({ mode: "video", language: "ta", country: "LK" });
    await wait(400);
    expect(c.rooms).toHaveLength(0);
    await wait(900);
    expect(c.scopes).toEqual(["exact", "language"]);
    expect(c.rooms).toHaveLength(1);
    expect(d.rooms).toEqual(c.rooms);
  });

  it("never pairs video users with text users", async () => {
    const video = join({ mode: "video" });
    const text = join({ mode: "text" });
    await wait(500);
    expect(video.rooms).toHaveLength(0);
    expect(text.rooms).toHaveLength(0);
  });

  it("sends the partner back to the lobby on pass, and both find someone again", async () => {
    const a = join({ mode: "text", language: "en", country: "US" });
    const b = join({ mode: "text", language: "en", country: "US" });
    await wait(400);
    a.socket.emit("pass", { roomId: a.rooms[0] });
    await wait(500);
    expect(b.lobbyCount).toBe(1);
    expect(a.rooms).toHaveLength(2);
    expect(b.rooms[1]).toBe(a.rooms[1]);
  });

  it("never hands out a user who disconnected while waiting", async () => {
    const gone = join({ mode: "video", language: "fr", country: "FR" });
    await wait(200);
    gone.socket.disconnect();
    await wait(200);
    const next = join({ mode: "video", language: "fr", country: "FR" });
    await wait(400);
    expect(next.rooms).toHaveLength(0);
  });

  it("pairs 200 users across two server instances with nobody matched twice", async () => {
    const crowd = Array.from({ length: 200 }, (_, i) => join({ mode: "video", language: "en", country: "GB" }, i % 2));
    await wait(3000);

    const roomSizes = new Map<string, number>();
    for (const user of crowd) for (const room of user.rooms) roomSizes.set(room, (roomSizes.get(room) ?? 0) + 1);

    expect(roomSizes.size).toBe(100);
    expect([...roomSizes.values()].every((size) => size === 2)).toBe(true);
    expect(crowd.every((user) => user.rooms.length === 1)).toBe(true);
  }, 10_000);
});
