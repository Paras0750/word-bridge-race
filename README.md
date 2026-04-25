# Word Bridge Race

Real-time multiplayer word game. Two random players each pick a letter, everyone else races
to type the first dictionary word that starts with one and ends with the other.

```
┌──────────┐                  ┌──────────┐
│  client  │ ←─── WebSocket ──→  server   │
│ Next 14  │                  │  Bun + IO │
└──────────┘                  └──────────┘
     │                              │
     │ HTTP (SSR + middleware)      │ HTTP (/healthz)
     ▼                              ▼
   browser                      Dokploy host
```

---

## How to play

You and your friends open a link, pick a name, and one of you creates a room.
You get a 6-character code (`X4P9KM`). Share it. Up to ten people can join.

Once everyone clicks "I'm ready", the host hits start. Two players are randomly
chosen — one picks a starting letter, the other picks an ending letter. Then a
3-second countdown reveals the pair to everyone.

Now you race. Type a real English word that starts with one letter and ends with
the other. First valid answer wins ten points and the round. Win three rounds in
a row and you bag a five-point bonus.

A few rules of decorum the game enforces on its own:

- Pasting your answer gets you publicly outed in the round log and docked points.
- Tabbing away mid-round gets you a cheeky shout-out when you return.
- If the picked letters are so cursed no English word bridges them, the round
  auto-skips. You can also vote to skip if everyone agrees.
- Tab close, app switch, or phone lock for under two minutes? You keep your
  seat, your score, and your streak. Come back, you're in.

That's the whole game. The complexity below is for the people maintaining it.

---

## How it works

A two-service real-time game. The Next.js app serves the UI; all game state
lives on the Socket.IO server. Clients are thin: they emit intent
(`submit_word`, `pick_letter`, `vote_skip`) and render whatever `room_update`
arrives. The server is the single source of truth for round phase, scores,
timers, dictionary validation, picker rotation, and cheater state.

Identity is client-generated and persisted in `localStorage` so a brief socket
disconnect (iOS suspending Safari, a hotel-WiFi blip) doesn't lose your seat.
The server keeps disconnected players in the room for two minutes; the same
`playerId` on reconnect restores them.

Every round-affecting decision happens server-side. Clients can only nudge.
That includes word validity (server holds the 369k-word in-memory `Set`),
duplicate-word detection (per-room `Set`), picker selection (rotating via a
recent-pickers window), and round timeouts (server-owned `setTimeout`s).

Hard-coded state machine: `lobby → pick_start → pick_end → countdown → active
→ scoreboard → (loop or back to lobby)`. Each transition is a single function
on the server that updates `room.phase` and broadcasts. The client renders the
phase and never tries to compute it.

---

## Tech stack

- **Server** — Bun, TypeScript, Express, Socket.IO 4
- **Client** — Next.js 14 (App Router), React 18, Tailwind 3, shadcn/ui, Geist
- **Deploy** — Docker, Dokploy

Both apps in TypeScript strict mode. State lives in-process on the server
(no DB). Dictionary is `dwyl/english-words` filtered to 3–20 char lowercase,
~369k entries, loaded once into a `Set` at boot.

---

## System design

### Topology

```
         ┌───────────────────────────────┐
         │   Browser (any device)        │
         │                               │
         │   Next.js client (React 18)   │
         │   ├─ /             (lobby)    │
         │   ├─ /room/[id]    (game)     │
         │   └─ socket.io-client         │
         └─────────────┬─────────────────┘
                       │ wss://
                       │
    ┌──────────────────┴─────────────────┐
    │  Traefik / reverse proxy (Dokploy) │
    └──────────────────┬─────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
  ┌──────────────┐          ┌──────────────────┐
  │ Next server  │          │ Socket.IO server │
  │ (port 3000)  │          │ (port 3001)      │
  │              │          │                  │
  │ SSR pages    │          │ Rooms in memory  │
  │ Middleware   │          │ Dictionary in    │
  │ (req logs)   │          │   memory (Set)   │
  └──────────────┘          └──────────────────┘
```

Two stateless processes from the deployment standpoint, but the **socket
server is single-instance**. All room state is in-process maps; nothing is
persisted. Restart the server = all rooms gone. Acceptable for a party game,
not acceptable for anything that needs durability.

### Why no database

For a casual game this is a feature, not an oversight. There's nothing worth
persisting between sessions:

- Player identity is per-browser (localStorage UUID), not an account.
- Scores reset between games.
- Used-words list is room-scoped.
- Dictionary is a static asset, baked into the image.

Adding a DB would buy you cross-room leaderboards or persistent player profiles.
Both are reasonable v2 features; both would push the architecture toward
something with horizontal-scaling complexity (sticky sessions, Redis adapter
for Socket.IO, a stateless app tier). Don't do that until you need it.

### Server data shape

A `Room` is the unit of game state:

```ts
interface Room {
  id: RoomId;                  // 6-char base32, e.g. "X4P9KM"
  hostId: PlayerId;
  players: Player[];
  phase: "lobby" | "pick_start" | "pick_end" | "countdown" | "active" | "scoreboard";
  round: Round | null;
  roundsPlayed: number;
  usedWords: Set<string>;      // dedup across all rounds in this room
  recentPickers: PlayerId[];   // rolling window for picker fairness
  settings: RoomSettings;      // pace knobs (pick time, countdown, round limit, pause)
  pickTimer:       Timeout | null;
  countdownTimer:  Interval | null;
  scoreboardTimer: Timeout | null;
  roundTimer:      Timeout | null;
  createdAt: number;
  emptySinceMs: number | null;
}

interface Player {
  id: PlayerId;                // client-supplied UUID, persisted in localStorage
  name: string;
  isHost: boolean;
  ready: boolean;
  score: number;
  streak: number;              // consecutive wins
  bestMs: number | null;       // fastest winning answer
  connected: boolean;          // false during disconnect grace window
  disconnectedAt: number | null;
}

interface Round {
  index: number;
  pickers: { start: PickerSlot; end: PickerSlot };
  start: string;               // single letter
  end: string;
  startedAt: number | null;    // server timestamp; client computes elapsed from this
  endsAt: number | null;       // server-anchored deadline
  winner: RoundWinner | null;
  timedOut: boolean;
  skipped: boolean;
  skipReason: "no_words" | "voted" | null;
  possibleWordCount: number;   // dictionary count for these letters
  cheaters: Set<PlayerId>;     // pasters; can no longer win this round
  skipVotes: Set<PlayerId>;    // unanimous = round dies
}
```

A `PublicRoom` is the same shape with internal sets (`usedWords`, `cheaters`,
`skipVotes`) replaced by counts/IDs. That's what gets broadcast.

---

## Game flow

```
        ┌─────────┐
        │  LOBBY  │  ← players join, toggle ready, host configures pace
        └────┬────┘
             │ host clicks Start (≥2 connected, all ready)
             ▼
        ┌────────────┐
        │ PICK_START │  picker A chooses a letter (timer = pickTimeoutSeconds)
        └────┬───────┘  on timeout: random letter
             │
             ▼
        ┌──────────┐
        │ PICK_END │  picker B chooses a letter, blind to A's pick
        └────┬─────┘  on lock: server runs countMatching(start, end)
             │
             │ if possible == 0 → SKIP straight to SCOREBOARD
             │ else
             ▼
        ┌──────────────┐
        │  COUNTDOWN   │  reveal both letters; tick countdownSeconds → 0
        └────┬─────────┘
             ▼
        ┌──────────┐
        │  ACTIVE  │  players type words; server validates each submission
        └────┬─────┘  ends on: (a) first valid word, (b) roundMaxSeconds, (c) unanimous skip
             ▼
        ┌────────────┐
        │ SCOREBOARD │  show winner / no-winner; pause scoreboardSeconds
        └────┬───────┘  then loop to PICK_START or back to LOBBY if <2 players
             │
             └─────► (next round)
```

### Round timing (host-tunable)

| Setting | Range | Default | Controls |
|---|---|---|---|
| `pickTimeoutSeconds` | 5–60 | 15 | How long each picker has |
| `countdownSeconds` | 1–10 | 5 | Length of the 5-4-3-2-1 reveal |
| `roundMaxSeconds` | 15–300 | 90 | Auto-end if no one solves |
| `scoreboardSeconds` | 3–30 | 10 | Pause between rounds |

Three presets ship: **Fast** (8/3/30/5), **Standard** (15/5/90/10), **Chill**
(30/5/180/15). Custom values are clamped on the server, not just on the client.

### Word validation pipeline

When a client emits `submit_word { word, pasted }`:

1. **Phase check** — must be `active`, no winner yet, player must be in room.
2. **Paste flag** — if `pasted: true` and player isn't already flagged, add
   them to `round.cheaters`, dock score, broadcast `cheater_caught`. End the
   submission early. They can't win this round.
3. **Length cap** — server trims word to 30 chars.
4. **Format** — letters only (`/^[a-z]+$/`).
5. **Constraint** — starts with `round.start`, ends with `round.end`.
6. **Length min** — must be at least `start.length + end.length` (with a
   1-char overlap allowed for single-letter constraints, so `s=p, e=p, w=pop`
   is fine).
7. **Used-words check** — not in `room.usedWords`.
8. **Dictionary** — `Set.has(word)`. O(1) on a 369k-word set.

Pass all → `winner` event, +10 points, +5 bonus if `streak >= 3`, `usedWords.add(word)`.
Fail any → `invalid_attempt` event with reason; round continues.

### Picker fairness

`selectPickers` filters to connected players only. Prefers players who aren't
in `recentPickers` (a rolling window of length `max(2, players-1)`). Falls back
to anyone if not enough fresh candidates. Two distinct players guaranteed.

This means in a 4-player room you'll see every player picker once before
anyone repeats. In a 2-player room both pick every round (which is correct).

---

## Rooms

### Lifecycle

- **Created** when a player calls `create_room`. Gets a unique base32 6-char
  ID (`A-Z minus O minus I` and `2-9 minus 0,1` — visually unambiguous).
- **Idle cleanup** — empty rooms (`emptySinceMs` set, no one connected) are
  destroyed after 60 seconds.
- **Hard idle** — rooms in lobby with zero players for 30 minutes are also
  destroyed.

A "soft" cleanup pass runs every 15 seconds to evict players whose disconnect
grace window expired (>2 minutes offline).

### Capacity

Hard cap: 10 players per room. Joining a full room is rejected at the join
step. Room creation has no per-host limit (but check your server's RAM if
you're running thousands of rooms).

### Codes

Room codes are 6 chars, base32 with confusing letters/digits removed
(`A-Z` minus `O`, `I`; `2-9`, no `0`, no `1`). Roughly 1 billion possible
codes; collision check is in-memory at creation.

The home page input filter strips anything outside this alphabet so users
can't even type a code that won't match the server's `validateRoomCode`
regex. Sharing a URL like `/room/X4P9KM` works too — if the user has no name
yet, the room page redirects to `/?room=X4P9KM` and prefills the join input.

---

## Identity, online/offline, reconnect

### Why identity is client-generated

Socket.IO assigns a new `socket.id` on every connection. If we used that as
the player ID, every reconnect would create a "new" player. Instead, the
client mints a UUID once and stores it in `localStorage` under
`wbr.playerId`. Every `create_room` and `join_room` payload carries this ID.
The server validates the format and adopts it as the canonical identity for
that socket.

```
First visit → crypto.randomUUID() → localStorage.setItem("wbr.playerId", id)
Every later visit → localStorage.getItem("wbr.playerId") → same id forever
```

This survives tab refreshes, app suspensions, browser restarts, OS reboots
(as long as localStorage isn't cleared).

### Disconnect grace window

When a socket disconnects, the server has two paths:

- **In lobby**: remove the player immediately. They haven't bought into a
  game; no state to preserve.
- **Mid-game** (any phase except lobby): mark `connected: false`, set
  `disconnectedAt: Date.now()`, set `ready: false`, **but keep them in
  `room.players`**. Their score, streak, best time, and seat are preserved.

The disconnected player shows in the lobby/standings with an "offline" badge
and dimmed text. They don't count toward "all ready" checks. They're skipped
in `selectPickers`.

If they reconnect within 2 minutes via `join_room` (with the same persisted
`playerId`), the server flips them back to `connected: true` and they slide
into whatever phase the room is currently in. If it's mid-active and someone
else has already won → they wait for scoreboard → next round they're back in.

If they don't reconnect in 2 minutes, the cleanup pass evicts them, transfers
host if needed, and broadcasts the new room state.

### iOS Safari background quirks

iOS suspends Safari's JS and WebSocket when you switch apps for ~30 seconds
or more. The disconnect grace window is the fix: Safari resumes, socket.io
auto-reconnects with the persisted `playerId`, server restores the seat. A
"Back online" toast confirms the reconnect.

The timing UI is robust to this because every deadline is a server-set
**absolute timestamp** (`endsAt = startedAt + roundMaxMs`). When the client
wakes up, it just computes `endsAt - Date.now()` again — no drift.

### Detection events

Three signals fire on the client during active rounds, only used for fun
shame mechanics, not for blocking gameplay:

- `visibilitychange` (hidden→visible) and `pageshow` — tab switch / app
  switch. iOS-friendly.
- `window.blur` — covers desktop alt-tab and some iOS edge cases. Filtered to
  ignore input focus.
- `mouseleave` on `documentElement` — desktop only (iPhone has no cursor;
  this listener is registered but never fires there).

All three throttle to one event per 4 seconds and are server-side
rate-limited too. The server picks a random funny line from a pool and
broadcasts it; the cheater's own browser doesn't show the toast (only others
see "👀 caught you peeking, Paras").

### Anti-cheat

The honest 95% gets caught; the dishonest 5% who edit JS in DevTools win
hollow rounds. That's intentional — this isn't a security perimeter, it's
party-game theater.

| Vector | Detection | Penalty |
|---|---|---|
| Cmd+V into the answer input | `onPaste`, `onChange` with `inputType: insertFromPaste`, `onDrop` | −5 points, can't win this round, public callout |
| Tab away mid-round | `visibilitychange` / `pageshow` / `blur` | None. Funny callout only. |
| Mouse leaves window | `mouseleave` (desktop only) | None. Funny callout only. |
| Word not in dictionary | server `Set.has(word)` | Round continues |
| Word reused in this room | `room.usedWords.has(word)` | Round continues |
| Submission before round active | server phase check | Reject |
| Submission after winner locked | server `round.winner != null` check | Reject |

The pasted **word itself** is never broadcast — only "this player got caught
pasting" + penalty. Otherwise a paste of a real answer would leak the answer
to everyone via the round log.

---

## Local development

```bash
# Server (port 3001)
cd server
bun install
bun run dev          # tsx watch

# Client (port 3000)
cd client
bun install
bun run dev          # next dev

# Open http://localhost:3000
```

Two terminals, two `bun run dev` commands. The client's `getSocket()` reads
`NEXT_PUBLIC_SERVER_URL` and falls back to `http://localhost:3001` if unset
— matches what the server defaults to. No `.env` needed for local.

To test multiplayer locally, open the app in two browsers (or one + an
incognito window) and join the same room code.

To play with timings, change presets via the in-lobby Settings panel —
they're host-only and apply immediately to the next round.

### Type check

Both repos:
```bash
cd server && bun run typecheck
cd client && bun run typecheck
```

Both use `tsc --noEmit` with strict flags including
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

### Production build

```bash
cd client && bun run build      # next build, standalone output
cd server                       # no build step — Bun runs TS directly
```

---

## Deployment (Dokploy)

Two Dokploy **Applications**, both Dockerfile-based, both auto-deploy on push:

| App | Build Path | Port | Domain | Build Args | Runtime Env |
|---|---|---|---|---|---|
| `wbr-server` | `/server` | 3001 | `wbr-api.your-domain` | none | `PORT=3001`, `CORS_ORIGIN=https://wbr.your-domain` |
| `wbr-client` | `/client` | 3000 | `wbr.your-domain` | `NEXT_PUBLIC_SERVER_URL=https://wbr-api.your-domain` | same as build arg, plus `PORT=3000`, `HOSTNAME=0.0.0.0` |

`NEXT_PUBLIC_SERVER_URL` **must** be set as a Build Arg, not just a runtime
env var. Next.js inlines `NEXT_PUBLIC_*` at compile time. Setting it at
runtime is too late.

`CORS_ORIGIN` must match the client domain exactly — protocol, host, no
trailing slash. Mismatch and the WebSocket upgrade fails with a CORS error.

Healthcheck for the server: `GET /healthz` returns
`{ ok: true, rooms, words, ts }`. Use it as Dokploy's container healthcheck.

### Scaling notes

The current architecture is single-instance for the socket server. To scale
horizontally:

1. Add the [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/)
   so events fan out across replicas.
2. Move room state out of in-process maps. Two options:
   - All state in Redis (simpler, latency cost).
   - Sticky sessions by `roomId` so a room always lands on the same node
     (cheap, but rebalancing is hard if a node dies).
3. Watch for memory: each room holds a copy of the player list and a
   used-words `Set`. At 1000 active rooms the dictionary `Set` (shared) is
   negligible but the per-room state grows linearly.

Don't do any of this until you have actual users. Single-node Bun on a
modest VPS comfortably handles thousands of concurrent players.

---

## Observability

Both services emit structured logs. **Dev**: pretty colored output. **Prod**
(`NODE_ENV=production`): one JSON object per line, ready for `jq` /
log-aggregation tools.

### Server log levels

```
debug  socket.connected, socket.disconnect (with reason)
info   room.created, room.destroyed, player.joined, player.rejoined,
       player.offline, player.kicked.timeout, round.pick.start,
       round.pick.locked, round.active, round.winner, round.vote_skip,
       settings.changed, stats (every 60s)
warn   round.timeout, round.skipped, cheat.paste
error  uncaughtException, unhandledRejection
```

Tune with `LOG_LEVEL=warn` (or `error`) in production env. The `stats`
heartbeat every 60s gives you `{rooms, totalPlayers, connectedPlayers,
uptimeSec}` for at-a-glance load.

### Next.js terminal logs

The Next.js process logs three things to its terminal (never the browser
console):

- **Boot** (via `instrumentation.ts`): `next.boot { serverUrl, env, port, node }`
- **Each request** (via `src/middleware.ts`): JSON line per request with
  method, path, ip, user-agent, duration. Static assets filtered out.
- **Crashes**: process-level `uncaughtException` / `unhandledRejection` are
  logged with stack traces.

### Useful queries

```bash
# All round outcomes for a specific room
docker logs wbr-server | jq 'select(.roomId == "X4P9KM")'

# Cheaters caught today
docker logs wbr-server | jq 'select(.event == "cheat.paste")'

# How many active rooms over time
docker logs wbr-server | jq 'select(.event == "stats") | {ts, rooms}'

# Slow requests
docker logs wbr-client | jq 'select(.durationMs > 200)'
```

---

## Project layout

```
word-bridge-race/
├── server/
│   ├── src/
│   │   ├── index.ts            # Express + Socket.IO bootstrap, all event handlers
│   │   ├── rooms.ts            # Room CRUD, picker selection, settings clamping
│   │   ├── validate.ts         # Word validation pipeline
│   │   ├── dictionary.ts       # Dictionary load + countMatching index
│   │   ├── dictionary.txt      # 369k words, 4.1MB
│   │   ├── logger.ts           # Structured logger
│   │   └── types.ts            # All shared event/state types
│   ├── Dockerfile
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Home: create / join
│   │   │   ├── layout.tsx              # Root layout, fonts, toaster
│   │   │   ├── globals.css             # Theme tokens + radius scale
│   │   │   └── room/[roomId]/page.tsx  # Phase router, socket lifecycle
│   │   ├── components/
│   │   │   ├── Lobby.tsx              # Player list, ready, settings, rules
│   │   │   ├── PickPhase.tsx          # 23-letter grid picker
│   │   │   ├── Countdown.tsx          # 5-4-3-2-1 reveal
│   │   │   ├── ActiveRound.tsx       # Constraint tiles, input, skip-vote
│   │   │   ├── Scoreboard.tsx         # Winner + standings
│   │   │   ├── AttemptsLog.tsx        # Round log: guess/peek/cheat/skip
│   │   │   ├── SettingsPanel.tsx      # Pace presets + steppers
│   │   │   ├── HouseRules.tsx         # The vibe doc
│   │   │   └── ui/                    # shadcn primitives
│   │   ├── lib/
│   │   │   ├── socket.ts              # Singleton socket.io client
│   │   │   ├── identity.ts            # Stable playerId in localStorage
│   │   │   ├── useSocketStatus.ts     # Connection state hook
│   │   │   ├── server-logger.ts       # Next.js terminal logger
│   │   │   ├── types.ts               # Mirrors server event types
│   │   │   └── utils.ts               # cn()
│   │   └── middleware.ts              # Request logger
│   ├── instrumentation.ts             # Boot log, process error handlers
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Future work

Not promises, just ideas worth their weight:

- **Persistent player profiles** — needs an account system. Big change.
- **Cross-room leaderboard** — needs a DB. Medium change.
- **Custom dictionaries** — Spanish, French, themed (Tolkien, sci-fi).
  Easy: it's just a different `dictionary.txt` per room setting.
- **Word-of-the-day mode** — daily fixed letters, players race for best time.
- **Difficulty modes** — "no Q/X/Z", "min length 6", "no proper nouns".
- **Spectator mode** — late joiners watch, queue for next round.
- **Admin panel** — see active rooms, kick players, end games. Useful at
  scale.

---

## License

MIT. Do whatever.
