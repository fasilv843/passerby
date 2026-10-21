import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./prefsStorage";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("prefsStorage", () => {
  it("round-trips saved preferences", () => {
    const storage = memoryStorage();
    savePrefs({ mode: "text", language: "ml", country: "IN" }, storage);
    expect(loadPrefs(storage)).toEqual({ mode: "text", language: "ml", country: "IN" });
  });

  it("falls back to defaults for missing, corrupt or unknown values", () => {
    expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
    expect(loadPrefs({ getItem: () => "{oops" })).toEqual(DEFAULT_PREFS);
    expect(loadPrefs({ getItem: () => JSON.stringify({ mode: "audio", language: "xx", country: "ZZ" }) })).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
  });
});
