import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { buildIceServers } from "../src/config/iceServers";

const base = { stunUrls: ["stun:stun.example.com:3478"], turnUrls: [], turnTtlSeconds: 3600 };

describe("buildIceServers", () => {
  it("returns only STUN when TURN isn't configured", () => {
    expect(buildIceServers("user-1", base)).toEqual([{ urls: ["stun:stun.example.com:3478"] }]);
  });

  it("signs a time-limited TURN credential coturn can verify", () => {
    const now = Date.UTC(2026, 9, 21);
    const [, turn] = buildIceServers(
      "user-1",
      { ...base, turnUrls: ["turn:turn.example.com:3478"], turnSecret: "0123456789abcdef" },
      now
    );

    const expiry = now / 1000 + 3600;
    expect(turn.username).toBe(`${expiry}:user-1`);
    expect(turn.credential).toBe(
      createHmac("sha1", "0123456789abcdef").update(`${expiry}:user-1`).digest("base64")
    );
  });

  it("skips TURN when the secret is missing", () => {
    expect(buildIceServers("u", { ...base, turnUrls: ["turn:x"] })).toHaveLength(1);
  });
});
