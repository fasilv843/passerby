import { describe, expect, it } from "vitest";
import { sortCodecs, videoCodecOrder } from "./codecs";

const caps = [
  { mimeType: "video/VP8" },
  { mimeType: "video/rtx" },
  { mimeType: "video/H264", sdpFmtpLine: "profile-level-id=42001f" },
  { mimeType: "video/VP9" },
  { mimeType: "video/H264", sdpFmtpLine: "profile-level-id=42e01f" },
  { mimeType: "video/AV1" },
  { mimeType: "video/red" },
  { mimeType: "video/ulpfec" },
];

describe("sortCodecs", () => {
  it("puts codecs in the default order and keeps helpers last", () => {
    const sorted = sortCodecs(caps, videoCodecOrder(null)).map((c) => c.mimeType);
    expect(sorted).toEqual([
      "video/VP9", "video/H264", "video/H264", "video/VP8", "video/AV1",
      "video/rtx", "video/red", "video/ulpfec",
    ]);
  });

  it("keeps the relative order of H.264 profiles", () => {
    const h264 = sortCodecs(caps, videoCodecOrder(null)).filter((c) => c.mimeType === "video/H264");
    expect(h264.map((c) => c.sdpFmtpLine)).toEqual(["profile-level-id=42001f", "profile-level-id=42e01f"]);
  });

  it("moves a preferred codec to the front without dropping others", () => {
    const sorted = sortCodecs(caps, videoCodecOrder("video/AV1"));
    expect(sorted[0].mimeType).toBe("video/AV1");
    expect(sorted).toHaveLength(caps.length);
  });

  it("matches mime types case-insensitively", () => {
    expect(sortCodecs([{ mimeType: "video/vp8" }, { mimeType: "video/vp9" }], videoCodecOrder(null))[0].mimeType).toBe("video/vp9");
  });
});
