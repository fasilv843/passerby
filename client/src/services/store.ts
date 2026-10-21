/**
 * Minimal observable state for services, read by React through useStore().
 * State is replaced on every change (never mutated), so React can compare snapshots.
 */
export class Store<S extends object> {
  private state: S;
  private readonly listeners = new Set<() => void>();

  constructor(initial: S) {
    this.state = initial;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): S => this.state;

  protected setState(patch: Partial<S>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
