import { describe, expect, it } from "vitest";
import { gridColumnsClass } from "./gridLayout";
import { groupRoomUrl, isValidRoomId } from "./groupLinks";

describe("group links", () => {
  it("builds the invite link", () => {
    expect(groupRoomUrl("abcDEF12_-x", "https://passerby.example")).toBe("https://passerby.example/group/abcDEF12_-x");
  });

  it("accepts real room ids only", () => {
    expect(isValidRoomId("abcDEF12_-x")).toBe(true);
    expect(isValidRoomId("short")).toBe(false);
    expect(isValidRoomId("has spaces in it")).toBe(false);
    expect(isValidRoomId(undefined)).toBe(false);
  });
});

describe("gridColumnsClass", () => {
  it("adds columns as people join", () => {
    expect(gridColumnsClass(1)).toBe("grid-cols-1");
    expect(gridColumnsClass(3)).toContain("sm:grid-cols-2");
    expect(gridColumnsClass(6)).toContain("lg:grid-cols-3");
  });
});
