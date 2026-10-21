import { describe, expect, it } from "vitest";
import { passSchema, signalSchema } from "../src/contracts/schemas";

describe("signalSchema", () => {
  it("accepts a description or a candidate", () => {
    expect(signalSchema.safeParse({ roomId: "room:1", description: { type: "offer", sdp: "v=0" } }).success).toBe(true);
    expect(signalSchema.safeParse({ roomId: "room:1", candidate: { candidate: "candidate:1 1 udp ..." } }).success).toBe(true);
  });

  it("rejects messages with neither, unknown types or no room", () => {
    expect(signalSchema.safeParse({ roomId: "room:1" }).success).toBe(false);
    expect(signalSchema.safeParse({ roomId: "room:1", description: { type: "hello" } }).success).toBe(false);
    expect(signalSchema.safeParse({ description: { type: "offer" } }).success).toBe(false);
  });

  it("rejects oversized SDP", () => {
    expect(signalSchema.safeParse({ roomId: "r", description: { type: "offer", sdp: "x".repeat(100_001) } }).success).toBe(false);
  });
});

describe("passSchema", () => {
  it("needs a room id", () => {
    expect(passSchema.safeParse({ roomId: "room:1" }).success).toBe(true);
    expect(passSchema.safeParse({}).success).toBe(false);
    expect(passSchema.safeParse(null).success).toBe(false);
  });
});
