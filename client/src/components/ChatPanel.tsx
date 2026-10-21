import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { MAX_CHAT_LENGTH } from "../types/chat";
import type { ChatEntry } from "../types/chat";

interface ChatPanelProps {
  entries: ChatEntry[];
  /** True once the chat connection is open. */
  canSend: boolean;
  strangerTyping: boolean;
  /** Returns true if the message was sent, so the draft can be cleared. */
  onSend: (text: string) => boolean;
  onDraftChange: (text: string) => void;
  onDraftBlur: () => void;
  className?: string;
}

/**
 * Message list and composer. Typing signals and sending are handled by the caller.
 * Give it a `key` per conversation so the draft resets for each new chat.
 */
export default function ChatPanel({
  entries,
  canSend,
  strangerTyping,
  onSend,
  onDraftChange,
  onDraftBlur,
  className = "",
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, strangerTyping]);

  const changeDraft = (text: string) => {
    setDraft(text);
    onDraftChange(text);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canSend && draft.trim() && onSend(draft)) setDraft("");
  };

  // Enter sends; Shift+Enter adds a new line. Ignore Enter while an IME is composing.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className={`flex flex-col min-h-0 rounded-lg border bg-white ${className}`} aria-label="Chat">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" aria-live="polite">
        {entries.map((entry) => (
          <ChatLine key={entry.id} entry={entry} />
        ))}
        {strangerTyping ? <p className="text-xs text-gray-500 italic px-1">Stranger is typing…</p> : null}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t p-2">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea
          id="chat-input"
          rows={1}
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          disabled={!canSend}
          onChange={(e) => changeDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onDraftBlur}
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

function ChatLine({ entry }: { entry: ChatEntry }) {
  if (entry.from === "system") {
    return <p className="text-center text-xs text-gray-500 py-1">{entry.text}</p>;
  }

  const mine = entry.from === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
          mine ? "bg-brand text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        <span className="sr-only">{mine ? "You: " : "Stranger: "}</span>
        {entry.text}
      </p>
    </div>
  );
}
