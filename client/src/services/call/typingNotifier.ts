export interface TypingNotifierOptions {
  /** While the user keeps typing, repeat "typing" at most this often. */
  refreshMs: number;
  /** Send "stopped typing" after this long without a change. */
  idleMs: number;
}

const DEFAULTS: TypingNotifierOptions = { refreshMs: 2000, idleMs: 3000 };

/**
 * Turns draft changes into a few "typing" / "stopped typing" signals instead
 * of one per keystroke.
 */
export class TypingNotifier {
  private lastSentAt = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly send: (active: boolean) => void;
  private readonly options: TypingNotifierOptions;
  private readonly now: () => number;

  constructor(send: (active: boolean) => void, options: TypingNotifierOptions = DEFAULTS, now: () => number = Date.now) {
    this.send = send;
    this.options = options;
    this.now = now;
  }

  /** Call on every draft change. */
  update(draft: string) {
    if (!draft.trim()) {
      this.stop();
      return;
    }
    const now = this.now();
    if (now - this.lastSentAt > this.options.refreshMs) {
      this.lastSentAt = now;
      this.send(true);
    }
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.stop(), this.options.idleMs);
  }

  /** The user sent the message, cleared the draft, or left the input. */
  stop() {
    this.clearIdleTimer();
    if (this.lastSentAt) {
      this.lastSentAt = 0;
      this.send(false);
    }
  }

  /** Forget any typing state without notifying, e.g. when the chat ends. */
  reset() {
    this.clearIdleTimer();
    this.lastSentAt = 0;
  }

  private clearIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
