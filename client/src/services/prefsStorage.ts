import type { MatchPrefs } from "../types/signaling";
import { ANY, COUNTRY_CODES, LANGUAGE_CODES } from "../lib/locales";

/** Versioned so a future change to the stored shape can't break old saved values. */
const STORAGE_KEY = "passerby:prefs:v1";

export const DEFAULT_PREFS: MatchPrefs = { mode: "video", language: ANY, country: ANY };

/** Reads saved lobby preferences, dropping anything no longer offered. */
export function loadPrefs(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): MatchPrefs {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return DEFAULT_PREFS;
    const { mode, language, country } = saved as Record<string, unknown>;
    return {
      mode: mode === "text" ? "text" : "video",
      language: typeof language === "string" && LANGUAGE_CODES.includes(language) ? language : ANY,
      country: typeof country === "string" && COUNTRY_CODES.includes(country) ? country : ANY,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: MatchPrefs, storage: Pick<Storage, "setItem"> | undefined = safeStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: preferences just won't be remembered.
  }
}

/** localStorage throws on access in some private-browsing modes. */
function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const NAME_KEY = "passerby:displayName:v1";

/** The name used in group rooms, remembered between visits. */
export function loadDisplayName(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): string {
  try {
    return storage?.getItem(NAME_KEY)?.slice(0, 30) ?? "";
  } catch {
    return "";
  }
}

export function saveDisplayName(name: string, storage: Pick<Storage, "setItem"> | undefined = safeStorage()) {
  try {
    storage?.setItem(NAME_KEY, name.trim().slice(0, 30));
  } catch {
    // Not remembered; nothing else breaks.
  }
}
