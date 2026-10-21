import { initialAdaptationState, nextAdaptationState, QUALITY_LEVELS } from "../../media/adaptation";
import type { AdaptationState } from "../../media/adaptation";
import { createStatsSummarizer } from "../../media/stats";
import type { CallStats } from "../../media/stats";

const STATS_INTERVAL_MS = 3000;

/**
 * Polls getStats() while the call is connected, reports a summary, and drives
 * adaptive video quality (see media/adaptation.ts) on the video sender.
 */
export class QualityMonitor {
  private readonly summarize = createStatsSummarizer();
  private timer: ReturnType<typeof setInterval> | null = null;
  private adaptation: AdaptationState = initialAdaptationState;
  /** Level currently set on the sender, or -1 before the first apply. */
  private appliedLevel = -1;

  private readonly pc: RTCPeerConnection;
  private readonly videoSender: RTCRtpSender | null;
  private readonly adaptive: boolean;
  private readonly onStats: (stats: CallStats) => void;

  constructor(
    pc: RTCPeerConnection,
    videoSender: RTCRtpSender | null,
    adaptive: boolean,
    onStats: (stats: CallStats) => void
  ) {
    this.pc = pc;
    this.videoSender = videoSender;
    this.adaptive = adaptive;
    this.onStats = onStats;
  }

  start() {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), STATS_INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async poll() {
    try {
      const stats = this.summarize(await this.pc.getStats());
      if (!this.timer) return; // stopped while waiting
      await this.adapt(stats);
      this.onStats(this.withQuality(stats));
    } catch (err) {
      console.warn("[quality] getStats failed", err);
    }
  }

  private withQuality(stats: CallStats): CallStats {
    if (!this.videoSender) return stats;
    const level = QUALITY_LEVELS[this.adaptation.level];
    return { ...stats, quality: { label: level.label, level: this.adaptation.level, adaptive: this.adaptive } };
  }

  private async adapt(stats: CallStats) {
    if (!this.videoSender) return;
    if (this.adaptive) {
      this.adaptation = nextAdaptationState(this.adaptation, {
        lossPct: stats.video.send?.remoteLossPct,
        rttMs: stats.rttMs,
        availableKbps: stats.availableOutgoingKbps,
      });
    }
    if (this.adaptation.level !== this.appliedLevel) {
      await this.applyLevel(this.adaptation.level);
    }
  }

  private async applyLevel(levelIndex: number) {
    const params = this.videoSender!.getParameters();
    if (!params.encodings?.length) return; // not negotiated yet; retried on the next poll

    const level = QUALITY_LEVELS[levelIndex];
    params.encodings[0].maxBitrate = level.maxBitrateKbps * 1000;
    params.encodings[0].scaleResolutionDownBy = level.scaleResolutionDownBy;
    try {
      await this.videoSender!.setParameters(params);
      if (this.appliedLevel !== -1) console.info(`[quality] video → ${level.label}`);
      this.appliedLevel = levelIndex;
    } catch (err) {
      console.warn("[quality] setParameters failed", err);
    }
  }
}
