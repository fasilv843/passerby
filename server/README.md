# Passerby server

Socket.IO signaling and matchmaking, with Redis for shared state. The server never touches media:
it pairs users, relays WebRTC signaling between them, and hands out TURN credentials.

## Layout

```
src/
  index.ts                 starts the server and handles shutdown
  app.ts                   wires services together (no listening, so tests can reuse it)
  logger.ts

  config/
    env.ts                 environment variables, validated with zod
    redis.ts               Redis connection (+ adapter clients)
    iceServers.ts          STUN/TURN list with time-limited coturn credentials

  contracts/
    events.ts              every Socket.IO event and payload (client keeps a copy)
    schemas.ts             runtime validation of client payloads

  socket/
    registerHandlers.ts    per-connection events → services
    types.ts               typed Server/Socket

  matching/
    prefs.ts               mode/language/country and how a search widens
    matchOrWait.lua        atomic search + pair + enqueue in Redis
    matchScript.ts         typed wrapper for the Lua script
    matchmaker.ts          search, widening timers, opening rooms

  rooms/
    roomStore.ts           room persistence (Redis only)
    roomService.ts         open/leave rooms and notify both users

  signaling/
    signalRelay.ts         forwards SDP and ICE candidates to the roommate

  redis/keys.ts            every Redis key in one place
```

Each layer only talks downwards: socket handlers → services → stores → Redis.

## Scripts

```bash
npm run dev        # ts-node + nodemon
npm run build      # compile to dist/ (and copy the Lua script)
npm start          # run dist/
npm test           # unit tests; integration tests run too when Redis is reachable at REDIS_URL
```

Copy `.env.example` to `.env` first. TURN setup is in `../deploy/coturn/README.md`.
