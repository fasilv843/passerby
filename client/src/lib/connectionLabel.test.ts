import { describe, expect, it } from "vitest";
import { describeConnection } from "./connectionLabel";

describe("describeConnection", () => {
  it("describes a direct path with RTT", () => {
    expect(describeConnection("connected", { kind: "direct", localType: "srflx", remoteType: "host", rttMs: 42 })).toEqual({
      label: "Direct",
      detail: "via STUN · 42 ms",
      tone: "good",
    });
  });

  it("describes a relayed path with its transport", () => {
    expect(
      describeConnection("connected", { kind: "relay", localType: "relay", remoteType: "srflx", relayProtocol: "udp" })
    ).toMatchObject({ label: "Relayed", detail: "TURN over UDP", tone: "warning" });
  });

  it("describes in-between states", () => {
    expect(describeConnection("new", null).label).toBe("Connecting…");
    expect(describeConnection("disconnected", null).tone).toBe("warning");
    expect(describeConnection("failed", null).tone).toBe("bad");
  });
});
