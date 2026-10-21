/** Display formatters for numbers that may be missing. Each returns null when there's nothing to show. */

export const formatBitrate = (kbps?: number) =>
  kbps === undefined ? null : kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;

export const formatPercent = (value?: number) => (value === undefined ? null : `${value}%`);

export const formatMs = (value?: number) => (value === undefined ? null : `${value} ms`);

export const formatResolution = (width?: number, height?: number) =>
  width && height ? `${width}×${height}` : null;

export const formatFps = (value?: number) => (value === undefined ? null : `${value} fps`);
