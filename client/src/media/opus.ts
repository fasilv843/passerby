/**
 * Sets Opus FEC and DTX in an SDP's `a=fmtp` line for Opus.
 *
 * We apply this to the *remote* description before setRemoteDescription().
 * Opus parameters in a description tell the other side how to encode, so
 * editing the description we received changes how *our* encoder sends:
 *   useinbandfec=1  each packet carries a low-bitrate copy of the previous one,
 *                   so a single lost packet can be rebuilt (costs a little bitrate)
 *   usedtx=1        send almost nothing during silence (saves bandwidth;
 *                   the receiver fills the gap with comfort noise)
 * This keeps the parameterless setLocalDescription() that perfect negotiation relies on.
 */
export function tuneOpus(sdp: string, { fec, dtx }: { fec: boolean; dtx: boolean }): string {
  const eol = sdp.includes("\r\n") ? "\r\n" : "\n";
  const lines = sdp.split(eol);

  const opusPayloadTypes = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+) opus\/48000/i);
    if (match) opusPayloadTypes.add(match[1]);
  }
  if (opusPayloadTypes.size === 0) return sdp;

  const withParams = (params: Map<string, string>) => {
    params.set("useinbandfec", fec ? "1" : "0");
    params.set("usedtx", dtx ? "1" : "0");
    return [...params].map(([k, v]) => `${k}=${v}`).join(";");
  };

  const out: string[] = [];
  for (const line of lines) {
    const fmtp = line.match(/^a=fmtp:(\d+) (.*)$/);
    if (fmtp && opusPayloadTypes.has(fmtp[1])) {
      const params = new Map<string, string>();
      for (const part of fmtp[2].split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key) params.set(key, rest.join("="));
      }
      out.push(`a=fmtp:${fmtp[1]} ${withParams(params)}`);
      continue;
    }
    out.push(line);
    // No fmtp line for this Opus payload type: add one right after its rtpmap.
    const rtpmap = line.match(/^a=rtpmap:(\d+) opus\/48000/i);
    if (rtpmap && !lines.some((l) => l.startsWith(`a=fmtp:${rtpmap[1]} `))) {
      out.push(`a=fmtp:${rtpmap[1]} ${withParams(new Map())}`);
    }
  }
  return out.join(eol);
}
