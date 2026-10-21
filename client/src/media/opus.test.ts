import { describe, expect, it } from "vitest";
import { tuneOpus } from "./opus";

const sdp = [
  "v=0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111 63",
  "a=rtpmap:111 opus/48000/2",
  "a=fmtp:111 minptime=10;useinbandfec=1",
  "a=rtpmap:63 red/48000/2",
  "a=fmtp:63 111/111",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=rtpmap:96 VP8/90000",
  "",
].join("\r\n");

describe("tuneOpus", () => {
  it("adds usedtx and keeps existing parameters", () => {
    const out = tuneOpus(sdp, { fec: true, dtx: true });
    expect(out).toContain("a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1\r\n");
  });

  it("can turn both off", () => {
    expect(tuneOpus(sdp, { fec: false, dtx: false })).toContain("a=fmtp:111 minptime=10;useinbandfec=0;usedtx=0");
  });

  it("leaves other codecs' fmtp lines alone", () => {
    expect(tuneOpus(sdp, { fec: true, dtx: true })).toContain("a=fmtp:63 111/111\r\n");
  });

  it("adds an fmtp line when Opus has none", () => {
    const bare = "m=audio 9 UDP/TLS/RTP/SAVPF 111\na=rtpmap:111 opus/48000/2\na=sendrecv\n";
    expect(tuneOpus(bare, { fec: true, dtx: true })).toBe(
      "m=audio 9 UDP/TLS/RTP/SAVPF 111\na=rtpmap:111 opus/48000/2\na=fmtp:111 useinbandfec=1;usedtx=1\na=sendrecv\n"
    );
  });

  it("returns SDP without Opus unchanged", () => {
    const dataOnly = "v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
    expect(tuneOpus(dataOnly, { fec: true, dtx: true })).toBe(dataOnly);
  });
});
