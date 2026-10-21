import type { CallStats } from "../media/stats";
import { buildStatsRows } from "../lib/statsRows";

interface StatsPanelProps {
  stats: CallStats | null;
  className?: string;
}

/**
 * Live call statistics from getStats(), refreshed every few seconds.
 * Open chrome://webrtc-internals alongside it for the full picture.
 */
export default function StatsPanel({ stats, className = "" }: StatsPanelProps) {
  const rows = stats ? buildStatsRows(stats) : [];

  return (
    <div className={`rounded-md bg-black/75 px-3 py-2 text-[11px] leading-5 text-white font-mono tabular-nums ${className}`}>
      {rows.length === 0 ? (
        <p>Waiting for stats…</p>
      ) : (
        <dl className="space-y-0.5" aria-label="Call statistics">
          {rows.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-x-2">
              <dt className="text-white/60">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
