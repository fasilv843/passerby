import type { ConnectionPath } from "../types/signaling";

interface ConnectionBadgeProps {
  state: RTCPeerConnectionState | null;
  path: ConnectionPath | null;
}

const CANDIDATE_LABELS: Record<string, string> = {
  host: "local network",
  srflx: "via STUN",
  prflx: "peer reflexive",
  relay: "via TURN",
};

/**
 * Small overlay on the remote video showing how the call is connected:
 * direct peer-to-peer or relayed through TURN, plus round-trip time.
 */
export default function ConnectionBadge({ state, path }: ConnectionBadgeProps) {
  let label: string;
  let detail: string | null = null;
  let tone = "bg-gray-900/70";

  if (state === "connected" && path) {
    if (path.kind === "relay") {
      label = "Relayed";
      detail = `TURN${path.relayProtocol ? ` over ${path.relayProtocol.toUpperCase()}` : ""}`;
      tone = "bg-amber-600/85";
    } else {
      label = "Direct";
      detail = CANDIDATE_LABELS[path.localType] ?? path.localType;
      tone = "bg-emerald-700/85";
    }
    if (path.rttMs !== undefined) detail = `${detail} · ${path.rttMs} ms`;
  } else if (state === "connected") {
    label = "Connected";
  } else if (state === "disconnected") {
    label = "Reconnecting…";
    tone = "bg-amber-600/85";
  } else if (state === "failed") {
    label = "Connection lost, retrying…";
    tone = "bg-red-700/85";
  } else {
    label = "Connecting…";
  }

  return (
    <div
      className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs text-white ${tone}`}
      title={path ? `local: ${path.localType}, remote: ${path.remoteType}, protocol: ${path.protocol ?? "?"}` : undefined}
      aria-live="polite"
    >
      <span className="font-medium">{label}</span>
      {detail && <span className="opacity-90"> · {detail}</span>}
    </div>
  );
}
