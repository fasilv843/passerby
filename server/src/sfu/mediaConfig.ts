import type { types } from "mediasoup";
import { env } from "../config/env";

/**
 * Codecs every group room supports. The router only forwards packets, so all
 * participants must share a codec; mediasoup-client picks the first one in
 * this list that the browser supports.
 *
 * VP8 comes first because simulcast (three quality layers per sender) is best
 * supported with VP8. This differs from 1:1 calls, which prefer VP9: there the
 * two browsers talk directly and there's no layer switching.
 */
export const ROUTER_MEDIA_CODECS: types.RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    parameters: { useinbandfec: 1, usedtx: 1 },
  },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: { "x-google-start-bitrate": 1000 } },
  { kind: "video", mimeType: "video/VP9", clockRate: 90000, parameters: { "profile-id": 2, "x-google-start-bitrate": 1000 } },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];

/** Most a single participant may send to the SFU (three simulcast layers plus audio). */
export const MAX_INCOMING_BITRATE = 3_000_000;

/** How the SFU listens for one browser's media connection: UDP preferred, TCP as a fallback. */
export function webRtcTransportOptions(): types.WebRtcTransportOptions {
  const { listenIp, announcedAddress, minPort, maxPort } = env.sfu;
  const listen = (protocol: "udp" | "tcp"): types.TransportListenInfo => ({
    protocol,
    ip: listenIp,
    announcedAddress,
    portRange: { min: minPort, max: maxPort },
  });

  return {
    listenInfos: [listen("udp"), listen("tcp")],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  };
}
