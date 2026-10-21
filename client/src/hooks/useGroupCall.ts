import { useEffect, useMemo } from "react";
import { GroupCallController } from "../services/group/groupCallController";
import { useStore } from "./useStore";

/** Joins a group room while mounted and re-renders on every change. */
export function useGroupCall(roomId: string, displayName: string, localStream: MediaStream | null) {
  // Creating the controller has no side effects; joining happens in the effect.
  const controller = useMemo(
    () => new GroupCallController({ roomId, displayName, localStream }),
    [roomId, displayName, localStream]
  );

  useEffect(() => {
    void controller.start();
    return () => controller.stop();
  }, [controller]);

  return { state: useStore(controller), controller };
}
