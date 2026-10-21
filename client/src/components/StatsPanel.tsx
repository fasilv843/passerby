import type { CallStats, StreamStats } from "../media/stats";

interface StatsPanelProps {
  stats: CallStats | null;
  className?: string;
}

const kbps = (value?: number) =>
  value === undefined ? null : value >= 1000 ? `${(value / 1000).toFixed(1)} Mbps` : `${value} kbps`;
const pct = (value?: number) => (value === undefined ? null : `${value}%`);
const ms = (value?: number) => (value === undefined ? null : `${value} ms`);
const res = (s?: StreamStats) => (s?.width && s?.height ? `${s.width}×${s.height}` : null);
const fps = (value?: number) => (value === undefined ? null : `${value} fps`);

const LIMITATION_LABELS: Record<string, string> = {
  bandwidth: "limited by bandwidth",
  cpu: "limited by CPU",
  other: "limited",
};

/** One labelled row; parts that are null are skipped. */
function Row({ label, parts }: { label: string; parts: (string | null | undefined)[] }) {
  const shown = parts.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-2">
      <dt className="text-white/60">{label}</dt>
      <dd className="min-w-0 break-words">{shown.join(" · ")}</dd>
    </div>
  );
}

/**
 * Live call statistics from getStats(), refreshed every few seconds.
 * Open chrome://webrtc-internals alongside it for the full picture.
 */
export default function StatsPanel({ stats, className = "" }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className={`rounded-md bg-black/75 px-3 py-2 text-xs text-white ${className}`}>
        Waiting for stats…
      </div>
    );
  }

  const { video, audio, path, quality } = stats;
  const pathLabel = path
    ? path.kind === "relay"
      ? `relayed (TURN over ${path.relayProtocol ?? path.protocol ?? "?"})`
      : `direct (${path.localType} ↔ ${path.remoteType}, ${path.protocol ?? "?"})`
    : null;

  return (
    <dl
      className={`rounded-md bg-black/75 px-3 py-2 text-[11px] leading-5 text-white font-mono tabular-nums space-y-0.5 ${className}`}
      aria-label="Call statistics"
    >
      <Row label="Network" parts={[pathLabel, stats.rttMs !== undefined ? `RTT ${ms(stats.rttMs)}` : null]} />
      <Row label="Upload est." parts={[kbps(stats.availableOutgoingKbps)]} />
      <Row
        label="Video out"
        parts={[
          video.send?.codec,
          res(video.send),
          fps(video.send?.fps),
          kbps(video.send?.kbps),
          video.send?.remoteLossPct !== undefined ? `peer sees ${pct(video.send.remoteLossPct)} loss` : null,
          video.send?.qualityLimitation && video.send.qualityLimitation !== "none"
            ? LIMITATION_LABELS[video.send.qualityLimitation] ?? video.send.qualityLimitation
            : null,
        ]}
      />
      <Row
        label="Quality"
        parts={quality ? [quality.label, quality.adaptive ? "auto" : "fixed"] : []}
      />
      <Row
        label="Video in"
        parts={[
          video.recv?.codec,
          res(video.recv),
          fps(video.recv?.fps),
          kbps(video.recv?.kbps),
          video.recv?.packetLossPct !== undefined ? `loss ${pct(video.recv.packetLossPct)}` : null,
          video.recv?.jitterMs !== undefined ? `jitter ${ms(video.recv.jitterMs)}` : null,
          video.recv?.jitterBufferMs !== undefined ? `buffer ${ms(video.recv.jitterBufferMs)}` : null,
          video.recv?.freezeCount ? `${video.recv.freezeCount} freezes` : null,
        ]}
      />
      <Row label="Audio out" parts={[audio.send?.codec, kbps(audio.send?.kbps)]} />
      <Row
        label="Audio in"
        parts={[
          audio.recv?.codec,
          kbps(audio.recv?.kbps),
          audio.recv?.packetLossPct !== undefined ? `loss ${pct(audio.recv.packetLossPct)}` : null,
          audio.recv?.jitterMs !== undefined ? `jitter ${ms(audio.recv.jitterMs)}` : null,
          audio.recv?.concealedPct ? `concealed ${pct(audio.recv.concealedPct)}` : null,
        ]}
      />
    </dl>
  );
}
