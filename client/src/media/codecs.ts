/**
 * Default video codec order.
 *
 * - VP9: roughly 30–40% less bitrate than VP8 for the same quality, supported
 *   by Chrome, Firefox and Safari.
 * - H.264: hardware encoders on most phones (better battery), and the safest
 *   choice for older iPhones.
 * - VP8: the baseline every WebRTC browser must support.
 * - AV1: best compression, but software encoding is heavy on low-end phones,
 *   so it's opt-in with ?codec=av1.
 *
 * Each side's order decides what it would like to *receive*: the sender
 * encodes with the first codec in the remote description it also supports.
 */
export const DEFAULT_VIDEO_CODEC_ORDER = ["video/VP9", "video/H264", "video/VP8", "video/AV1"];

export function videoCodecOrder(preferred: string | null): string[] {
  if (!preferred) return DEFAULT_VIDEO_CODEC_ORDER;
  return [preferred, ...DEFAULT_VIDEO_CODEC_ORDER.filter((c) => c.toLowerCase() !== preferred.toLowerCase())];
}

/**
 * Reorders codec capabilities by mime type. Codecs not in `order`
 * (rtx, red, ulpfec, flexfec) keep their relative order and go last.
 * Nothing is removed, so the other peer can always fall back.
 */
export function sortCodecs<T extends { mimeType: string }>(codecs: T[], order: string[]): T[] {
  const rank = (codec: T) => {
    const index = order.findIndex((m) => m.toLowerCase() === codec.mimeType.toLowerCase());
    return index === -1 ? order.length : index;
  };
  return codecs
    .map((codec, position) => ({ codec, position, rank: rank(codec) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map(({ codec }) => codec);
}
