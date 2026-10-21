import { useState } from "react";

/** The room's link with a copy button. */
export default function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still visible and selectable.
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate select-all" title={url}>{url}</span>
      <button type="button" className="btn btn-ghost py-1" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
