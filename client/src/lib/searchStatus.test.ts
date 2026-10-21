import { describe, expect, it } from "vitest";
import { describeSearch } from "./searchStatus";

describe("describeSearch", () => {
  const ml = { mode: "video" as const, language: "ml", country: "IN" };

  it("explains each stage of a widening search", () => {
    expect(describeSearch(ml, "exact")).toBe("Looking for Malayalam speakers in India…");
    expect(describeSearch(ml, "language")).toBe("Nobody in India yet. Looking for Malayalam speakers anywhere…");
    expect(describeSearch(ml, "anyone")).toBe("No exact match yet. Looking for anyone…");
  });

  it("handles partial and no preferences", () => {
    expect(describeSearch({ mode: "text", language: "*", country: "IN" }, "exact")).toBe("Looking for someone in India…");
    expect(describeSearch({ mode: "text", language: "*", country: "*" }, "anyone")).toBe("Looking for someone…");
    expect(describeSearch(ml, null)).toBe("Looking for someone…");
  });
});
