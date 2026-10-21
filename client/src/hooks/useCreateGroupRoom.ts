import { useState } from "react";
import { createGroupRoom, GroupRequestError } from "../services/group/groupSignaling";

/** Creates a group room on demand and reports progress for the button. */
export function useCreateGroupRoom(onCreated: (roomId: string) => void) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      onCreated(await createGroupRoom());
    } catch (err) {
      setError(err instanceof GroupRequestError ? err.message : "Couldn't create a room. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return { create, creating, error };
}
