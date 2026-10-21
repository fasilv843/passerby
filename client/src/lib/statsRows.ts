import type { CallStats } from "../media/stats";
import { describePath } from "./connectionLabel";
import { formatBitrate, formatFps, formatMs, formatPercent, formatResolution } from "./format";

export interface StatsRow {
  label: string;
  value: string;
}

const LIMITATION_LABELS: Record<string, string> = {
  bandwidth: "limited by bandwidth",
  cpu: "limited by CPU",
  other: "limited",
};

/** Prefixes a formatted value, or returns null when the value is missing. */
const labelled = (prefix: string, value: string | null) => (value ? `${prefix} ${value}` : null);

function row(label: string, parts: (string | null | undefined)[]): StatsRow | null {
  const shown = parts.filter(Boolean);
  return shown.length ? { label, value: shown.join(" · ") } : null;
}

/** Turns call stats into the rows shown in the stats panel. Rows with no data are left out. */
export function buildStatsRows(stats: CallStats): StatsRow[] {
  const { video, audio, path, quality } = stats;
  const limitation = video.send?.qualityLimitation;

  const rows = [
    row("Network", [
      path ? `${path.kind === "relay" ? "relayed" : "direct"}, ${describePath(path)}, ${path.protocol ?? "?"}` : null,
      labelled("RTT", formatMs(stats.rttMs)),
    ]),
    row("Upload est.", [formatBitrate(stats.availableOutgoingKbps)]),
    row("Video out", [
      video.send?.codec,
      formatResolution(video.send?.width, video.send?.height),
      formatFps(video.send?.fps),
      formatBitrate(video.send?.kbps),
      labelled("peer sees loss", formatPercent(video.send?.remoteLossPct)),
      limitation && limitation !== "none" ? LIMITATION_LABELS[limitation] ?? limitation : null,
    ]),
    row("Quality", quality ? [quality.label, quality.adaptive ? "auto" : "fixed"] : []),
    row("Video in", [
      video.recv?.codec,
      formatResolution(video.recv?.width, video.recv?.height),
      formatFps(video.recv?.fps),
      formatBitrate(video.recv?.kbps),
      labelled("loss", formatPercent(video.recv?.packetLossPct)),
      labelled("jitter", formatMs(video.recv?.jitterMs)),
      labelled("buffer", formatMs(video.recv?.jitterBufferMs)),
      video.recv?.freezeCount ? `${video.recv.freezeCount} freezes` : null,
    ]),
    row("Audio out", [audio.send?.codec, formatBitrate(audio.send?.kbps)]),
    row("Audio in", [
      audio.recv?.codec,
      formatBitrate(audio.recv?.kbps),
      labelled("loss", formatPercent(audio.recv?.packetLossPct)),
      labelled("jitter", formatMs(audio.recv?.jitterMs)),
      audio.recv?.concealedPct ? labelled("concealed", formatPercent(audio.recv.concealedPct)) : null,
    ]),
  ];

  return rows.filter((r): r is StatsRow => r !== null);
}
