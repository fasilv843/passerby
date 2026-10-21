import { describe, expect, it } from "vitest";
import { buildStatsRows } from "./statsRows";

describe("buildStatsRows", () => {
  it("formats available numbers and leaves out empty rows", () => {
    const rows = buildStatsRows({
      path: { kind: "direct", localType: "srflx", remoteType: "host", protocol: "udp" },
      rttMs: 40,
      availableOutgoingKbps: 2400,
      video: {
        send: { codec: "VP9", width: 1280, height: 720, fps: 30, kbps: 1200, remoteLossPct: 0.5, qualityLimitation: "none" },
        recv: { codec: "VP9", kbps: 800, packetLossPct: 1.2, freezeCount: 0 },
      },
      audio: {},
      quality: { label: "High", level: 0, adaptive: true },
    });

    expect(rows).toEqual([
      { label: "Network", value: "direct, via STUN, udp · RTT 40 ms" },
      { label: "Upload est.", value: "2.4 Mbps" },
      { label: "Video out", value: "VP9 · 1280×720 · 30 fps · 1.2 Mbps · peer sees loss 0.5%" },
      { label: "Quality", value: "High · auto" },
      { label: "Video in", value: "VP9 · 800 kbps · loss 1.2%" },
    ]);
  });
});
