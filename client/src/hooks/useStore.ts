import { useSyncExternalStore } from "react";
import type { Store } from "../services/store";

/** Re-renders whenever the store's state changes. */
export function useStore<S extends object>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.getState);
}
