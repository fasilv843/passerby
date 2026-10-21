import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { MAX_CHAT_LENGTH } from "../types/chat";
import type { ChatEntry } from "../types/chat";

interface ChatPanelProps {
  entries: ChatEntry[];
  /** True once the data channel is open. */
  canSend: boolean;
  strangerTyping: boolean;
  onSend: (text: string) => boolean;
  onTyping: (active: boolean) => void;
  className?: string;
}

/** Send "typing" at most this often while the user keeps typing. */
const TYPING_REFRESH_MS = 2000;
/** Send "stopped typing" after this long without a keystroke. */
const TYPING_IDLE_MS = 3000;

export default function ChatPanel({
  entries,
  canSend,
  strangerTyping,
  onSend,
  onTyping,
  className = "",
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, strangerTyping]);

  // Clear the draft and typing state when the chat ends or a new one starts.
  useEffect(() => {
    if (!canSend) setDraft("");
    lastTypingSentRef.current = 0;
  }, [canSend]);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const stopTyping = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    if (lastTypingSentRef.current) {
      lastTypingSentRef.current = 0;
      onTyping(false);
    }
  };

  const handleChange = (value: string) => {
    setDraft(value);
    if (!canSend) return;
    if (!value.trim()) {
      stopTyping();
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_REFRESH_MS) {
      lastTypingSentRef.current = now;
      onTyping(true);
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || !canSend) return;
    if (onSend(draft)) {
      setDraft("");
      stopTyping();
    }
  };

  // Enter sends; Shift+Enter adds a new line.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className={`flex flex-col min-h-0 rounded-lg border bg-white ${className}`} aria-label="Chat">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" aria-live="polite">
        {entries.map((entry) =>
          entry.from === "system" ? (
            <p key={entry.id} className="text-center text-xs text-gray-500 py-1">
              {entry.text}
            </p>
          ) : (
            <div key={entry.id} className={`flex ${entry.from === "me" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  entry.from === "me"
                    ? "bg-brand text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-900 rounded-bl-sm"
                }`}
              >
                <span className="sr-only">{entry.from === "me" ? "You: " : "Stranger: "}</span>
                {entry.text}
              </p>
            </div>
          )
        )}
        {strangerTyping && (
          <p className="text-xs text-gray-500 italic px-1">Stranger is typing…</p>
        )}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t p-2">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea
          id="chat-input"
          rows={1}
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          disabled={!canSend}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          placeholder={canSend ? "Type a message" : "Chat opens when you're connected"}
          className="flex-1 resize-none rounded-md border px-3 py-2 text-sm max-h-28 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:bg-gray-50"
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
