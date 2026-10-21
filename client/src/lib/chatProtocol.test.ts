import { describe, expect, it } from "vitest";
import { createTextMessage, parseChatMessage } from "./chatProtocol";

const json = (value: unknown) => JSON.stringify(value);

describe("parseChatMessage", () => {
  it("accepts the three message types", () => {
    expect(parseChatMessage(json({ type: "message", id: "a", text: "hi", sentAt: 1 }))?.type).toBe("message");
    expect(parseChatMessage(json({ type: "typing", active: true }))).toEqual({ type: "typing", active: true });
    expect(parseChatMessage(json({ type: "bye" }))).toEqual({ type: "bye" });
  });

  it("drops anything malformed", () => {
    expect(parseChatMessage("{nope")).toBeNull();
    expect(parseChatMessage(new ArrayBuffer(4))).toBeNull();
    expect(parseChatMessage(json({ type: "html", body: "<b>" }))).toBeNull();
    expect(parseChatMessage(json({ type: "message", id: "a", text: "   ", sentAt: 1 }))).toBeNull();
    expect(parseChatMessage(json({ type: "message", id: "a", text: "x".repeat(1001), sentAt: 1 }))).toBeNull();
    expect(parseChatMessage(json({ type: "typing", active: "yes" }))).toBeNull();
  });
});

describe("createTextMessage", () => {
  it("trims and caps the text", () => {
    expect(createTextMessage("  hi  ", 5)).toMatchObject({ type: "message", text: "hi", sentAt: 5 });
    expect(createTextMessage("x".repeat(1200))?.text).toHaveLength(1000);
  });

  it("returns null for blank text", () => {
    expect(createTextMessage("   ")).toBeNull();
  });
});
