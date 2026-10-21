import { describe, expect, it } from "vitest";
import { initialAdaptationState, nextAdaptationState, QUALITY_LEVELS } from "./adaptation";
import type { AdaptationState, NetworkSample } from "./adaptation";

const run = (samples: NetworkSample[], start: AdaptationState = initialAdaptationState) =>
  samples.reduce(nextAdaptationState, start);
const repeat = (sample: NetworkSample, n: number) => Array.from({ length: n }, () => sample);

const lossy = { lossPct: 12, rttMs: 120 };
const slow = { lossPct: 0, rttMs: 600 };
const healthy = { lossPct: 0.5, rttMs: 60, availableKbps: 3000 };

describe("nextAdaptationState", () => {
  it("ignores a single bad sample", () => {
    expect(run([lossy]).level).toBe(0);
  });

  it("steps down after two bad samples, one level at a time", () => {
    expect(run(repeat(lossy, 2)).level).toBe(1);
    expect(run(repeat(lossy, 4)).level).toBe(2);
  });

  it("treats high round-trip time as bad", () => {
    expect(run(repeat(slow, 2)).level).toBe(1);
  });

  it("never goes below the lowest level", () => {
    expect(run(repeat(lossy, 50)).level).toBe(QUALITY_LEVELS.length - 1);
  });

  it("recovers slowly: five good samples per step up", () => {
    const degraded = run(repeat(lossy, 4)); // level 2
    expect(run(repeat(healthy, 4), degraded).level).toBe(2);
    expect(run(repeat(healthy, 5), degraded).level).toBe(1);
    expect(run(repeat(healthy, 10), degraded).level).toBe(0);
  });

  it("doesn't step up without enough estimated bandwidth", () => {
    const degraded = run(repeat(lossy, 2)); // level 1, next up needs 1500 * 1.2
    expect(run(repeat({ ...healthy, availableKbps: 1200 }, 10), degraded).level).toBe(1);
  });

  it("resets streaks on mixed or missing feedback", () => {
    const state = run([lossy, { lossPct: 4, rttMs: 300 }, lossy]);
    expect(state.level).toBe(0);
    expect(run([lossy, {}, lossy]).level).toBe(0);
  });
});
