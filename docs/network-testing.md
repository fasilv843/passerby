# Testing call quality on a bad network

Phase 3 added codec preferences, Opus FEC/DTX, adaptive video quality and a stats panel.
This guide shows how to make a network bad on purpose and what to look for.

## Important: DevTools throttling does not affect calls

Chrome DevTools' network throttling only applies to HTTP requests. WebRTC media goes over UDP
outside that path, so throttling there changes nothing in a call. Use an operating-system tool instead.

## Tools that do work

| OS | Tool | Notes |
| --- | --- | --- |
| Linux | `tc netem` | Built in. Applies to outgoing traffic on one interface. |
| macOS | Network Link Conditioner | In "Additional Tools for Xcode" from developer.apple.com. Has presets like "3G" and "Very Bad Network". Doesn't affect localhost. |
| Windows | [clumsy](https://jagt.github.io/clumsy/) | Use the filter `udp` and enable Lag and Drop. |

### Linux examples

```bash
# Find your interface (e.g. wlan0, eth0)
ip route get 1.1.1.1

# 10% packet loss, 150 ms delay with 30 ms jitter
sudo tc qdisc add dev wlan0 root netem loss 10% delay 150ms 30ms

# Change it while a call is running
sudo tc qdisc change dev wlan0 root netem loss 20% delay 300ms 50ms

# Limit bandwidth to 500 kbit/s
sudo tc qdisc change dev wlan0 root netem rate 500kbit

# Remove it
sudo tc qdisc del dev wlan0 root
```

`netem` shapes outgoing packets only. Running it on one laptop affects what *that* laptop sends,
which is what the other person's "Video in" and "Audio in" rows will show.

Two tabs on one machine talk over localhost, so throttle `lo` instead of your Wi-Fi interface
(this also slows the dev server). Two devices on different networks is closer to real use.

## URL switches

Add these to the room URL to compare behaviour without changing code:

| Switch | Values | Default |
| --- | --- | --- |
| `codec` | `vp9`, `h264`, `vp8`, `av1` | VP9 → H.264 → VP8 → AV1 |
| `fec` | `0`, `1` | `1` |
| `dtx` | `0`, `1` | `1` |
| `adapt` | `0`, `1` | `1` |
| `stats` | `0`, `1` | `0` (opens the stats panel) |

Example: `http://localhost:5173/room?stats=1&codec=vp8&adapt=0`

The codec you *receive* is decided by your own preference order, so to force a codec in both
directions, open both tabs with the same `codec` value.

## Experiments to run

Open the stats panel on both sides, and `chrome://webrtc-internals` (or `about:webrtc` in Firefox)
for graphs.

1. **Codec.** Join with `?codec=vp8`, then `?codec=vp9`. Compare "Video in" bitrate at the same
   resolution. VP9 should need noticeably less for similar quality.
2. **DTX.** Stay silent and watch "Audio out" bitrate. With DTX on it drops from about 30 kbps to a
   few kbps; with `?dtx=0` it stays flat.
3. **FEC.** Add 10% loss on one side. On the other side, compare "Audio in → concealed" with `?fec=1`
   and `?fec=0`. FEC should lower the concealed share and make speech sound less choppy.
4. **Adaptive quality.** Add 12% loss. Within about 6 seconds, "Quality" should step from High to
   Medium, then lower if loss continues, and "Video out" resolution should drop at the Low level.
   Remove the loss: it steps back up one level every ~15 seconds. Repeat with `?adapt=0` and compare
   freezes on the receiving side.
5. **Latency.** Add `delay 500ms`. Watch RTT rise and the receiver's jitter buffer grow.

Write down numbers before and after each change. A small table of results is good README and
interview material.
