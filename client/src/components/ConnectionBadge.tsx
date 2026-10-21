import { describeConnection } from "../lib/connectionLabel";
import type { ConnectionTone } from "../lib/connectionLabel";
import type { ConnectionPath } from "../types/signaling";

interface ConnectionBadgeProps {
  state: RTCPeerConnectionState | null;
  path: ConnectionPath | null;
}

const TONE_CLASSES: Record<ConnectionTone, string> = {
  neutral: "bg-gray-900/70",
  good: "bg-emerald-700/85",
  warning: "bg-amber-600/85",
  bad: "bg-red-700/85",
};

/** Overlay on the remote video: direct or relayed, plus round-trip time. */
export default function ConnectionBadge({ state, path }: ConnectionBadgeProps) {
  const { label, detail, tone } = describeConnection(state, path);
  return (
    <div className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs text-white ${TONE_CLASSES[tone]}`} aria-live="polite">
      <span className="font-medium">{label}</span>
      {detail ? <span className="opacity-90"> · {detail}</span> : null}
    </div>
  );
}
