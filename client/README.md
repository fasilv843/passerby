# Passerby client

React + TypeScript + Vite.

- **Stranger chat** (`/room`): 1:1 video or text with a random person, peer to peer.
- **Group rooms** (`/group`): invite-link calls for up to 6 people through the mediasoup SFU.
  Loaded lazily, so the stranger chat never downloads mediasoup-client.

## Layout

Logic lives outside components, so components only render state and forward clicks.

```
src/
  pages/            screens: Home, RoomPage (lobby ↔ room), Lobby, Room,
                    GroupPage (start / lobby ↔ room), GroupLobby, GroupRoom
  components/       presentational pieces: VideoView, VideoFrame, ChatPanel, StatsPanel,
                    ConnectionBadge, MatchPreferences, ActionBar, ...
  hooks/            React adapters: useCall, useGroupCall, useStore, useLocalMedia, usePrefs, ...

  services/         stateful, browser APIs, no React
    store.ts              observable state shared by both controllers
    call/
      callController.ts   one stranger-chat session: signaling, matching, peer, chat state
      typingNotifier.ts   throttles "typing…" signals
    peer/
      peerSession.ts      RTCPeerConnection: perfect negotiation, ICE restart
      chatChannel.ts      chat over an RTCDataChannel
      qualityMonitor.ts   getStats() polling and adaptive video quality
    group/
      groupCallController.ts  mediasoup-client: join, send (simulcast), receive, mute
      groupSignaling.ts       request/ack client for the "/group" namespace
    socketClient.ts       typed Socket.IO connection
    prefsStorage.ts       remembers lobby choices

  media/            pure WebRTC helpers: codec order, Opus SDP edits, stats math, adaptation,
                    simulcast layers, URL settings
  lib/              pure helpers: chat protocol, labels and formatting, locales, ids
  types/            server contracts (signaling.ts, group.ts) and chat types
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

Group rooms are explained in `../docs/group-rooms.md`.
