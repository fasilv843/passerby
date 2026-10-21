/**
 * Media settings, overridable from the URL so you can compare behaviour
 * without changing code, e.g. /room?codec=vp8&dtx=0&adapt=0&stats=1
 *
 *   codec  av1 | vp9 | vp8 | h264   video codec to prefer (default order below)
 *   fec    0 | 1                    Opus in-band forward error correction (default 1)
 *   dtx    0 | 1                    Opus discontinuous transmission (default 1)
 *   adapt  0 | 1                    adaptive bitrate/resolution (default 1)
 *   stats  0 | 1                    open the stats panel by default (default 0)
 */
export interface MediaSettings {
  preferredVideoCodec: string | null;
  opusFec: boolean;
  opusDtx: boolean;
  adaptiveQuality: boolean;
  showStats: boolean;
}

const CODECS: Record<string, string> = {
  av1: "video/AV1",
  vp9: "video/VP9",
  vp8: "video/VP8",
  h264: "video/H264",
};

export function readMediaSettings(search: string = window.location.search): MediaSettings {
  const params = new URLSearchParams(search);
  const flag = (name: string, fallback: boolean) => {
    const value = params.get(name);
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return fallback;
  };
  return {
    preferredVideoCodec: CODECS[params.get("codec")?.toLowerCase() ?? ""] ?? null,
    opusFec: flag("fec", true),
    opusDtx: flag("dtx", true),
    adaptiveQuality: flag("adapt", true),
    showStats: flag("stats", false),
  };
}
