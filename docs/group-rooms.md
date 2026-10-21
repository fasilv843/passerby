# Group rooms (mediasoup SFU)

Group rooms let up to `GROUP_MAX_PEERS` people (default 6) talk through an invite link.
They are a separate section from the 1:1 stranger chat:

| | Stranger chat (1:1) | Group rooms |
| --- | --- | --- |
| Route | `/room` | `/group`, `/group/:roomId` |
| Socket.IO namespace | `/` | `/group` |
| Media path | browser ↔ browser (P2P) | browser → SFU → browsers |
| Server code | `server/src/matching`, `rooms`, `signaling` | `server/src/sfu` |
| Client code | `services/call` | `services/group` |

## Why an SFU

In a P2P mesh, each person uploads their video once per other person: 5 people means 4 uploads each.
With an SFU (Selective Forwarding Unit), each person uploads once and the server forwards copies.
It never decodes or re-encodes, so it's cheap to run.

## mediasoup objects

```
Worker (C++ process, one per core)
└── Router (one per room; decides the room's codecs)
    └── per person:
        ├── send WebRtcTransport ── Producers (mic, camera)
        └── recv WebRtcTransport ── Consumers (one per other person's track)
```

A 3-person room has 6 producers (mic + camera each) and 12 consumers.

## Joining, step by step

```
browser                                   server (/group)
  │ createRoom ───────────────────────────► roomId               (host only)
  │ join {roomId, displayName} ───────────► router capabilities, peers, their producers
  │ device.load(capabilities)
  │ createTransport {send} ───────────────► ICE + DTLS parameters
  │ sendTransport.produce(mic, camera)
  │   └─ "connect" → connectTransport ────► DTLS fingerprint
  │   └─ "produce" → produce ─────────────► producerId    (others get newProducer)
  │ createTransport {recv} ───────────────►
  │ for each producer: consume ───────────► consumer params (starts paused)
  │   recvTransport.consume(...) → resumeConsumer
  │ ◄──── peerJoined / newProducer / producerPaused / consumerClosed / peerLeft
```

Every request uses a Socket.IO acknowledgement and answers `{ ok: true, data }` or `{ ok: false, error }`.

## Simulcast

Each camera is sent as three layers: about 1/4 resolution at 150 kbps, 1/2 at 500 kbps, and full at 1.2 Mbps.
The SFU forwards one layer per viewer:

- The client asks for a layer based on how big each tile is (`setPreferredLayer`): the more people, the smaller the tiles, the lower the layer.
- mediasoup drops to a lower layer by itself when a viewer's bandwidth is short, and goes back up when it recovers.

Rooms prefer **VP8** because simulcast is best supported with it. (1:1 calls prefer VP9; there's no layer switching there.)

## Running locally

Defaults work when every browser is on the same machine (`SFU_ANNOUNCED_ADDRESS=127.0.0.1`).
To join from your phone on the same Wi-Fi, set it to your laptop's LAN IP, e.g. `192.168.1.20`.

## Deploying

- Open **UDP and TCP `SFU_MIN_PORT`–`SFU_MAX_PORT`** (default 40000–40100) in the firewall.
- Set `SFU_ANNOUNCED_ADDRESS` to the server's public IP or hostname. Behind NAT (most cloud VMs), keep `SFU_LISTEN_IP=0.0.0.0`.
- One port is used per transport, and each person uses two, so 100 ports ≈ 50 people at once. Widen the range for more.
- Set `SFU_WORKERS` to the number of CPU cores.
- TURN (coturn) is still offered for networks that block direct UDP to the SFU.

## Known limitation: one server instance per room

A room's router lives in one Node process, so everyone in a room must connect to the same instance.
With more than one instance, joining fails with "doesn't exist" on the wrong one. Options when it matters:

1. **Sticky routing:** store `roomId → instance` in Redis and point the client at that instance.
2. **Router piping:** mediasoup's `pipeToRouter` links routers across processes and hosts.

## Not done yet (Phase 4 follow-ups)

- End-to-end encryption with `RTCRtpScriptTransform`, so the SFU can't read the media.
- Recording a room by piping RTP to FFmpeg through a `PlainTransport`.
