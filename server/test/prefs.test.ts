import { describe, expect, it } from "vitest";
import { parsePrefs, searchStages } from "../src/matching/prefs";

describe("searchStages", () => {
  it("widens from language + country, to language, to anyone", () => {
    const stages = searchStages({ mode: "video", language: "ml", country: "IN" });
    expect(stages).toEqual([
      { scope: "exact", queues: ["q:video:ml:IN"] },
      { scope: "language", queues: ["q:video:ml:IN", "q:video:ml:*"] },
      { scope: "anyone", queues: ["q:video:ml:IN", "q:video:ml:*", "q:video:*:*"] },
    ]);
  });

  it("starts at 'language' when no country is chosen", () => {
    const stages = searchStages({ mode: "text", language: "hi", country: "*" });
    expect(stages.map((s) => s.scope)).toEqual(["language", "anyone"]);
  });

  it("goes from country straight to anyone when no language is chosen", () => {
    const stages = searchStages({ mode: "video", language: "*", country: "IN" });
    expect(stages).toEqual([
      { scope: "exact", queues: ["q:video:*:IN"] },
      { scope: "anyone", queues: ["q:video:*:IN", "q:video:*:*"] },
    ]);
  });

  it("has a single stage with no preferences", () => {
    expect(searchStages({ mode: "video", language: "*", country: "*" })).toEqual([
      { scope: "anyone", queues: ["q:video:*:*"] },
    ]);
  });
});

describe("parsePrefs", () => {
  it("accepts valid preferences", () => {
    expect(parsePrefs({ mode: "text", language: "ta", country: "LK" })).toEqual({ mode: "text", language: "ta", country: "LK" });
  });

  it("falls back to anyone for invalid or missing values", () => {
    const fallback = { mode: "video", language: "*", country: "*" };
    expect(parsePrefs(undefined)).toEqual(fallback);
    expect(parsePrefs({ mode: "audio" })).toEqual(fallback);
    expect(parsePrefs({ language: "malayalam" })).toEqual(fallback);
    expect(parsePrefs({ country: "in" })).toEqual(fallback);
  });
});
