import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypingNotifier } from "./typingNotifier";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TypingNotifier", () => {
  const create = () => {
    const send = vi.fn();
    return { send, notifier: new TypingNotifier(send, { refreshMs: 2000, idleMs: 3000 }, () => Date.now()) };
  };

  it("sends 'typing' once, then refreshes it while typing continues", () => {
    const { send, notifier } = create();
    notifier.update("a");
    vi.advanceTimersByTime(1000);
    notifier.update("ab");
    expect(send.mock.calls).toEqual([[true]]);
    vi.advanceTimersByTime(1500);
    notifier.update("abc");
    expect(send.mock.calls).toEqual([[true], [true]]);
  });

  it("sends 'stopped' after going quiet, or when the draft is cleared", () => {
    const { send, notifier } = create();
    notifier.update("a");
    vi.advanceTimersByTime(3000);
    expect(send.mock.calls.at(-1)).toEqual([false]);

    notifier.update("b");
    notifier.update("");
    expect(send.mock.calls.at(-1)).toEqual([false]);
  });

  it("doesn't send 'stopped' if nothing was typed, or after reset", () => {
    const { send, notifier } = create();
    notifier.stop();
    notifier.update("a");
    notifier.reset();
    vi.advanceTimersByTime(5000);
    expect(send.mock.calls).toEqual([[true]]);
  });
});
