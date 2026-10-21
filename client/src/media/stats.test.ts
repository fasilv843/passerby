import { describe, expect, it } from "vitest";
import { createStatsSummarizer } from "./stats";

/** Builds an object that looks like an RTCStatsReport. */
const report = (entries: Record<string, unknown>[]) => {
  const map = new Map(entries.map((e) => [e.id as string, e]));
  return map as unknown as RTCStatsReport;
};

const snapshot = (t: number, extra: { bytesIn: number; recv: number; lost: number; bytesOut: number }) =>
  report([
    { id: "T", type: "transport", timestamp: t, selectedCandidatePairId: "P" },
    { id: "P", type: "candidate-pair", timestamp: t, localCandidateId: "L", remoteCandidateId: "R",
      currentRoundTripTime: 0.042, availableOutgoingBitrate: 2_400_000, state: "succeeded" },
    { id: "L", type: "local-candidate", timestamp: t, candidateType: "relay", protocol: "udp", relayProtocol: "tcp" },
    { id: "R", type: "remote-candidate", timestamp: t, candidateType: "srflx" },
    { id: "CV", type: "codec", timestamp: t, mimeType: "video/VP9" },
    { id: "CA", type: "codec", timestamp: t, mimeType: "audio/opus" },
    { id: "OV", type: "outbound-rtp", kind: "video", timestamp: t, codecId: "CV", bytesSent: extra.bytesOut,
      frameWidth: 1280, frameHeight: 720, framesPerSecond: 29.97, qualityLimitationReason: "bandwidth" },
    { id: "RV", type: "remote-inbound-rtp", kind: "video", timestamp: t, fractionLost: 0.031, roundTripTime: 0.05 },
    { id: "IV", type: "inbound-rtp", kind: "video", timestamp: t, codecId: "CV", bytesReceived: extra.bytesIn,
      packetsReceived: extra.recv, packetsLost: extra.lost, jitter: 0.012, frameWidth: 640, frameHeight: 480,
      framesPerSecond: 24, jitterBufferDelay: t / 100, jitterBufferEmittedCount: t / 10, freezeCount: 1 },
    { id: "IA", type: "inbound-rtp", kind: "audio", timestamp: t, codecId: "CA", bytesReceived: extra.bytesIn / 20,
      packetsReceived: extra.recv, packetsLost: 0, jitter: 0.008, concealedSamples: t, totalSamplesReceived: t * 48 },
  ]);

describe("createStatsSummarizer", () => {
  it("reports the path and static fields on the first sample, rates from the second", () => {
    const summarize = createStatsSummarizer();
    const first = summarize(snapshot(1000, { bytesIn: 0, recv: 0, lost: 0, bytesOut: 0 }));

    expect(first.path).toEqual({
      kind: "relay", localType: "relay", remoteType: "srflx", protocol: "udp", relayProtocol: "tcp", rttMs: 42,
    });
    expect(first.availableOutgoingKbps).toBe(2400);
    expect(first.video.send).toMatchObject({ codec: "VP9", width: 1280, height: 720, fps: 30, qualityLimitation: "bandwidth", remoteLossPct: 3.1 });
    expect(first.video.recv?.kbps).toBeUndefined();

    // 3 seconds later: 300 KB in, 95 packets received and 5 lost.
    const second = summarize(snapshot(4000, { bytesIn: 300_000, recv: 95, lost: 5, bytesOut: 450_000 }));
    expect(second.video.recv).toMatchObject({ codec: "VP9", kbps: 800, packetLossPct: 5, jitterMs: 12, freezeCount: 1 });
    expect(second.video.send?.kbps).toBe(1200);
    // jitter buffer: delay delta 30s over 300 emitted frames = 100 ms
    expect(second.video.recv?.jitterBufferMs).toBe(100);
    expect(second.audio.recv).toMatchObject({ codec: "opus", kbps: 40, packetLossPct: 0, jitterMs: 8 });
    // 3000 concealed of 144000 samples
    expect(second.audio.recv?.concealedPct).toBe(2.1);
  });

  it("finds Firefox's selected pair without a transport entry", () => {
    const summarize = createStatsSummarizer();
    const stats = summarize(report([
      { id: "P", type: "candidate-pair", timestamp: 1, localCandidateId: "L", remoteCandidateId: "R", selected: true, state: "succeeded" },
      { id: "L", type: "local-candidate", timestamp: 1, candidateType: "host", protocol: "udp" },
      { id: "R", type: "remote-candidate", timestamp: 1, candidateType: "host" },
    ]));
    expect(stats.path?.kind).toBe("direct");
  });
});
