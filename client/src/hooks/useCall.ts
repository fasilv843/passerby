import { useEffect, useMemo } from "react";
import type { MediaSettings } from "../media/settings";
import { CallController } from "../services/call/callController";
import type { MatchPrefs } from "../types/signaling";
import { useStore } from "./useStore";

/**
 * Runs a CallController for as long as the component is mounted and
 * re-renders on every state change. Returns the state and the controller
 * (for actions like pass and sendMessage).
 */
export function useCall(prefs: MatchPrefs, localStream: MediaStream | null, settings: MediaSettings) {
  // Creating the controller has no side effects; connecting happens in the effect.
  const controller = useMemo(
    () => new CallController({ prefs, localStream, settings }),
    [prefs, localStream, settings]
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const state = useStore(controller);
  return { state, controller };
}
