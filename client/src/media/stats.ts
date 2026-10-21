import type { ConnectionPath } from "../types/signaling";

/**
 * Turns raw getStats() reports into the numbers shown in the stats panel.
 *
 * Most RTCStats fields are running totals (bytes, packets, samples), so rates
 * like bitrate and packet loss come from the difference between two reports.
 */

export interface StreamStats {
  codec?: string;
  kbps?: number;
  /** Lost packets as a share of expected packets since the previous report. */
  packetLossPct?: number;
  jitterMs?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface OutboundVideoStats extends StreamStats {
  /** Why the browser is sending less than it could: "bandwidth", "cpu", "none" (Chrome only). */
  qualityLimitation?: string;
  /** Packet loss the other side reports for our video (RTCP receiver reports). */
  remoteLossPct?: number;
}

export interface InboundVideoStats extends StreamStats {
  /** Average time frames wait in the jitter buffer before being shown. */
  jitterBufferMs?: number;
  freezeCount?: number;
}

export interface InboundAudioStats extends StreamStats {
  /** Share of played audio that was synthesized to hide loss (packet loss concealment). */
  concealedPct?: number;
}

export interface CallStats {
  path: ConnectionPath | null;
  rttMs?: number;
  /** The congestion controller's estimate of how much we can send. */
  availableOutgoingKbps?: number;
  video: { send?: OutboundVideoStats; recv?: InboundVideoStats };
  audio: { send?: StreamStats; recv?: InboundAudioStats };
  /** Our adaptive video quality level (added by PeerSession when sending video). */
  quality?: { label: string; level: number; adaptive: boolean };
}

// getStats() entries are typed loosely across browsers; read fields defensively.
type AnyStats = RTCStats & Record<string, unknown>;
type StatsLike = Pick<RTCStatsReport, "forEach" | "get">;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const round = (value: number | undefined, digits = 0) =>
  value === undefined ? undefined : Math.round(value * 10 ** digits) / 10 ** digits;

interface Counters {
  timestamp: number;
  bytes?: number;
  packetsReceived?: number;
  packetsLost?: number;
  jitterBufferDelay?: number;
  jitterBufferEmittedCount?: number;
  concealedSamples?: number;
  totalSamplesReceived?: number;
}

export function createStatsSummarizer() {
  let previous = new Map<string, Counters>();

  return function summarize(report: StatsLike): CallStats {
    const current = new Map<string, Counters>();
    const result: CallStats = { path: null, video: {}, audio: {} };

    const codecName = (stat: AnyStats) => {
      const codecId = str(stat.codecId);
      const codec = codecId ? (report.get(codecId) as AnyStats | undefined) : undefined;
      return str(codec?.mimeType)?.split("/")[1];
    };

    const delta = (id: string, key: keyof Counters, value: number | undefined) => {
      const before = previous.get(id)?.[key];
      return value !== undefined && before !== undefined ? value - before : undefined;
    };

    const kbpsSince = (id: string, timestamp: number, bytes: number | undefined) => {
      const bytesDelta = delta(id, "bytes", bytes);
      const before = previous.get(id)?.timestamp;
      if (bytesDelta === undefined || before === undefined || timestamp <= before) return undefined;
      return round((bytesDelta * 8) / (timestamp - before)); // bits per ms = kbps
    };

    const lossSince = (id: string, received: number | undefined, lost: number | undefined) => {
      const receivedDelta = delta(id, "packetsReceived", received);
      const lostDelta = delta(id, "packetsLost", lost);
      if (receivedDelta === undefined || lostDelta === undefined) return undefined;
      const expected = receivedDelta + Math.max(lostDelta, 0);
      return expected > 0 ? round((Math.max(lostDelta, 0) / expected) * 100, 1) : 0;
    };

    let selectedPairId: string | undefined;

    report.forEach((raw) => {
      const stat = raw as AnyStats;
      const id = stat.id;
      const timestamp = num(stat.timestamp) ?? 0;
      const kind = str(stat.kind);

      switch (stat.type) {
        case "transport":
          selectedPairId = str(stat.selectedCandidatePairId) ?? selectedPairId;
          break;

        case "outbound-rtp": {
          const bytes = num(stat.bytesSent);
          current.set(id, { timestamp, bytes });
          const base = { codec: codecName(stat), kbps: kbpsSince(id, timestamp, bytes) };
          if (kind === "video") {
            result.video.send = {
              ...result.video.send,
              ...base,
              width: num(stat.frameWidth),
              height: num(stat.frameHeight),
              fps: round(num(stat.framesPerSecond)),
              qualityLimitation: str(stat.qualityLimitationReason),
            };
          } else if (kind === "audio") {
            result.audio.send = { ...result.audio.send, ...base };
          }
          break;
        }

        case "remote-inbound-rtp": {
          // The other side's view of what we send, from RTCP receiver reports.
          const fractionLost = num(stat.fractionLost);
          const rtt = num(stat.roundTripTime);
          if (kind === "video") {
            result.video.send = {
              ...result.video.send,
              remoteLossPct: fractionLost !== undefined ? round(fractionLost * 100, 1) : undefined,
            };
          }
          if (rtt !== undefined && result.rttMs === undefined) result.rttMs = Math.round(rtt * 1000);
          break;
        }

        case "inbound-rtp": {
          const counters: Counters = {
            timestamp,
            bytes: num(stat.bytesReceived),
            packetsReceived: num(stat.packetsReceived),
            packetsLost: num(stat.packetsLost),
            jitterBufferDelay: num(stat.jitterBufferDelay),
            jitterBufferEmittedCount: num(stat.jitterBufferEmittedCount),
            concealedSamples: num(stat.concealedSamples),
            totalSamplesReceived: num(stat.totalSamplesReceived),
          };
          current.set(id, counters);

          const jitter = num(stat.jitter);
          const base: StreamStats = {
            codec: codecName(stat),
            kbps: kbpsSince(id, timestamp, counters.bytes),
            packetLossPct: lossSince(id, counters.packetsReceived, counters.packetsLost),
            jitterMs: jitter !== undefined ? Math.round(jitter * 1000) : undefined,
          };

          if (kind === "video") {
            const delayDelta = delta(id, "jitterBufferDelay", counters.jitterBufferDelay);
            const emittedDelta = delta(id, "jitterBufferEmittedCount", counters.jitterBufferEmittedCount);
            result.video.recv = {
              ...base,
              width: num(stat.frameWidth),
              height: num(stat.frameHeight),
              fps: round(num(stat.framesPerSecond)),
              jitterBufferMs:
                delayDelta !== undefined && emittedDelta ? Math.round((delayDelta / emittedDelta) * 1000) : undefined,
              freezeCount: num(stat.freezeCount),
            };
          } else if (kind === "audio") {
            const concealedDelta = delta(id, "concealedSamples", counters.concealedSamples);
            const samplesDelta = delta(id, "totalSamplesReceived", counters.totalSamplesReceived);
            result.audio.recv = {
              ...base,
              concealedPct:
                concealedDelta !== undefined && samplesDelta ? round((concealedDelta / samplesDelta) * 100, 1) : undefined,
            };
          }
          break;
        }
      }
    });

    // Selected candidate pair: Chrome/Safari point to it from the transport,
    // Firefox marks the pair itself.
    let pair = selectedPairId ? (report.get(selectedPairId) as AnyStats | undefined) : undefined;
    if (!pair) {
      report.forEach((raw) => {
        const stat = raw as AnyStats;
        if (stat.type === "candidate-pair" && (stat.selected || stat.nominated) && stat.state === "succeeded") {
          pair = stat;
        }
      });
    }

    if (pair) {
      const local = report.get(str(pair.localCandidateId) ?? "") as AnyStats | undefined;
      const remote = report.get(str(pair.remoteCandidateId) ?? "") as AnyStats | undefined;
      const rtt = num(pair.currentRoundTripTime);
      const available = num(pair.availableOutgoingBitrate);
      if (rtt !== undefined) result.rttMs = Math.round(rtt * 1000);
      if (available !== undefined) result.availableOutgoingKbps = Math.round(available / 1000);

      if (local && remote) {
        const localType = str(local.candidateType) ?? "unknown";
        const remoteType = str(remote.candidateType) ?? "unknown";
        result.path = {
          kind: localType === "relay" || remoteType === "relay" ? "relay" : "direct",
          localType,
          remoteType,
          protocol: str(local.protocol),
          relayProtocol: str(local.relayProtocol),
          rttMs: result.rttMs,
        };
      }
    }

    previous = current;
    return result;
  };
}
