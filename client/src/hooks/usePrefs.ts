import { useEffect, useState } from "react";
import { loadPrefs, savePrefs } from "../services/prefsStorage";
import type { MatchPrefs } from "../types/signaling";

/** Lobby preferences, remembered between visits. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<MatchPrefs>(() => loadPrefs());
  useEffect(() => savePrefs(prefs), [prefs]);
  return [prefs, setPrefs] as const;
}
