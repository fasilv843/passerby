/**
 * Adaptive video quality on top of the browser's own congestion control.
 *
 * The browser (Google Congestion Control in Chrome) already adjusts bitrate
 * second by second. What it does badly on lossy mobile networks is keep the
 * full resolution and starve each frame of bits, which shows up as blur and
 * freezes. This controller sets a ceiling on bitrate and steps resolution down
 * when the other side reports sustained loss or high latency, then steps back
 * up slowly once the network has been healthy for a while.
 *
 * Degrade fast, recover slowly: avoids flapping between levels.
 */

export interface QualityLevel {
  label: string;
  maxBitrateKbps: number;
  /** 1 = full camera resolution, 2 = half width and height, ... */
  scaleResolutionDownBy: number;
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { label: "High", maxBitrateKbps: 1500, scaleResolutionDownBy: 1 },
  { label: "Medium", maxBitrateKbps: 800, scaleResolutionDownBy: 1 },
  { label: "Low", maxBitrateKbps: 450, scaleResolutionDownBy: 1.5 },
  { label: "Very low", maxBitrateKbps: 250, scaleResolutionDownBy: 2 },
  { label: "Minimal", maxBitrateKbps: 120, scaleResolutionDownBy: 3 },
];

/** Thresholds, per stats sample (one sample every few seconds). */
export const ADAPTATION_RULES = {
  badLossPct: 8,
  badRttMs: 450,
  goodLossPct: 2,
  goodRttMs: 250,
  /** Consecutive bad samples before stepping down. */
  degradeAfter: 2,
  /** Consecutive good samples before stepping up. */
  recoverAfter: 5,
  /** Step up only if the estimated bandwidth covers the next level with this margin. */
  headroom: 1.2,
};

export interface AdaptationState {
  level: number;
  badStreak: number;
  goodStreak: number;
}

export interface NetworkSample {
  /** Loss the other side reports for our video. */
  lossPct?: number;
  rttMs?: number;
  availableKbps?: number;
}

export const initialAdaptationState: AdaptationState = { level: 0, badStreak: 0, goodStreak: 0 };

export function nextAdaptationState(state: AdaptationState, sample: NetworkSample): AdaptationState {
  const { lossPct, rttMs, availableKbps } = sample;
  const rules = ADAPTATION_RULES;

  if (lossPct === undefined && rttMs === undefined) {
    // No feedback yet: don't count this sample either way.
    return { ...state, badStreak: 0, goodStreak: 0 };
  }

  const bad = (lossPct ?? 0) >= rules.badLossPct || (rttMs ?? 0) >= rules.badRttMs;
  const higher = QUALITY_LEVELS[state.level - 1];
  const good =
    (lossPct ?? 0) < rules.goodLossPct &&
    (rttMs ?? 0) < rules.goodRttMs &&
    (availableKbps === undefined || !higher || availableKbps >= higher.maxBitrateKbps * rules.headroom);

  if (bad) {
    const badStreak = state.badStreak + 1;
    if (badStreak >= rules.degradeAfter && state.level < QUALITY_LEVELS.length - 1) {
      return { level: state.level + 1, badStreak: 0, goodStreak: 0 };
    }
    return { ...state, badStreak, goodStreak: 0 };
  }

  if (good) {
    const goodStreak = state.goodStreak + 1;
    if (goodStreak >= rules.recoverAfter && state.level > 0) {
      return { level: state.level - 1, badStreak: 0, goodStreak: 0 };
    }
    return { ...state, badStreak: 0, goodStreak };
  }

  // In between: hold the current level.
  return { ...state, badStreak: 0, goodStreak: 0 };
}
