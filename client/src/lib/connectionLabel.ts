import type { ConnectionPath } from "../types/signaling";
import { formatMs } from "./format";

export type ConnectionTone = "neutral" | "good" | "warning" | "bad";

export interface ConnectionLabel {
  label: string;
  detail?: string;
  tone: ConnectionTone;
}

const CANDIDATE_LABELS: Record<string, string> = {
  host: "local network",
  srflx: "via STUN",
  prflx: "peer reflexive",
  relay: "via TURN",
};

/** Short description of the route media takes, e.g. "TURN over UDP" or "via STUN". */
export function describePath(path: ConnectionPath): string {
  if (path.kind === "relay") {
    return `TURN${path.relayProtocol ? ` over ${path.relayProtocol.toUpperCase()}` : ""}`;
  }
  return CANDIDATE_LABELS[path.localType] ?? path.localType;
}

/** What the connection badge on the remote video says. */
export function describeConnection(
  state: RTCPeerConnectionState | null,
  path: ConnectionPath | null
): ConnectionLabel {
  if (state === "connected" && path) {
    const rtt = path.rttMs !== undefined ? ` · ${formatMs(path.rttMs)}` : "";
    return path.kind === "relay"
      ? { label: "Relayed", detail: `${describePath(path)}${rtt}`, tone: "warning" }
      : { label: "Direct", detail: `${describePath(path)}${rtt}`, tone: "good" };
  }

  switch (state) {
    case "connected":
      return { label: "Connected", tone: "good" };
    case "disconnected":
      return { label: "Reconnecting…", tone: "warning" };
    case "failed":
      return { label: "Connection lost, retrying…", tone: "bad" };
    default:
      return { label: "Connecting…", tone: "neutral" };
  }
}
