/**
 * The three layers each camera sends to the SFU. The SFU forwards one per
 * viewer, so a viewer with a small tile or a slow connection gets a small layer
 * without the sender encoding a separate stream for them.
 */
export const SIMULCAST_ENCODINGS: RTCRtpEncodingParameters[] = [
  { rid: "r0", scaleResolutionDownBy: 4, maxBitrate: 150_000 }, // layer 0: ~320×180
  { rid: "r1", scaleResolutionDownBy: 2, maxBitrate: 500_000 }, // layer 1: ~640×360
  { rid: "r2", scaleResolutionDownBy: 1, maxBitrate: 1_200_000 }, // layer 2: full camera resolution
];

/**
 * Which layer to ask the SFU for, given how many other people are on screen.
 * More people means smaller tiles, which don't need more pixels.
 * The SFU still drops lower on its own when bandwidth is short.
 */
export function preferredSpatialLayer(othersOnScreen: number): number {
  if (othersOnScreen <= 1) return 2;
  if (othersOnScreen <= 3) return 1;
  return 0;
}
