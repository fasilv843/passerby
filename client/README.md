# Passerby client

React + TypeScript + Vite. Video and text chat with strangers over WebRTC.

## Layout

Logic lives outside components, so components only render state and forward clicks.

```
src/
  pages/            screens: Home, RoomPage (lobby ↔ room), Lobby, Room
  components/       presentational pieces: VideoView, VideoFrame, ChatPanel, StatsPanel,
                    ConnectionBadge, MatchPreferences, ActionBar, ...
  hooks/            React adapters: useCall, useLocalMedia, usePrefs

  services/         stateful, browser APIs, no React
    call/
      callController.ts   one stranger-chat session: signaling, matching, peer, chat state
      typingNotifier.ts   throttles "typing…" signals
    peer/
      peerSession.ts      RTCPeerConnection: perfect negotiation, ICE restart
      chatChannel.ts      chat over an RTCDataChannel
      qualityMonitor.ts   getStats() polling and adaptive video quality
    socketClient.ts       typed Socket.IO connection
    prefsStorage.ts       remembers lobby choices

  media/            pure WebRTC helpers: codec order, Opus SDP edits, stats math, adaptation, URL settings
  lib/              pure helpers: chat protocol, labels and formatting, locales, ids
  types/            the server contract (signaling.ts) and chat types
  config/env.ts     VITE_SERVER_URL
```

Data flows one way: `services` → `useCall` (via `useSyncExternalStore`) → `pages` → `components`.

## Scripts

```bash
cp .env.example .env
npm run dev      # Vite dev server
npm test         # Vitest unit tests
npm run lint
npm run build
```

URL switches for testing call quality (`?stats=1&codec=vp8`, ...) are listed in
`../docs/network-testing.md`.
