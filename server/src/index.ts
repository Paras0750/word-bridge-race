import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { Server, type Socket } from "socket.io";
import {
  PICKABLE_LETTERS,
  PICKABLE_END_LETTERS,
  clampSettings,
  clearAllTimers,
  createRoom,
  findPlayer,
  generateRoomId,
  isNameTaken,
  pickRandomLetter,
  removePlayer,
  selectPickers,
  toPublicRoom,
  validateName,
  validateRoomCode,
  validateRoomName,
} from "./rooms";
import { validateWord } from "./validate";
import {
  countMatching,
  dictionarySize,
  isAlmostMatch,
  loadDictionary,
  sampleMatching,
} from "./dictionary";
import { log, shortId } from "./logger";
import type {
  ClientToServerEvents,
  InterServerEvents,
  Player,
  Room,
  RoomId,
  ServerToClientEvents,
  SocketData,
} from "./types";

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const ROOM_IDLE_MS = 1000 * 60 * 30;
const ROOM_EMPTY_GRACE_MS = 1000 * 60;
const MAX_PLAYERS = 10;
const WIN_POINTS = 10;
const STREAK_BONUS_AT = 3;
const STREAK_BONUS_POINTS = 5;
const PASTE_PENALTY = 5;
const PEEK_THROTTLE_MS = 4_000;
const SKIP_GRACE_MS = 4_000;
const DISCONNECT_GRACE_MS = 2 * 60 * 1000;
const PLAYER_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

function adoptPlayerId(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && PLAYER_ID_RE.test(raw)) return raw;
  return fallback;
}

const PEEK_MESSAGES_TAB: readonly string[] = [
  "👀 welcome back, {name}",
  "🤫 caught you peeking, {name}",
  "📖 {name} just consulted the oracle",
  "🌐 wikipedia called, {name}",
  "🔍 {name} returns from a research trip",
  "👁️ no notes, {name}",
];
const PEEK_MESSAGES_MOUSE: readonly string[] = [
  "🐭 {name}'s cursor escaped the chat",
  "👋 {name}'s mouse went on vacation",
  "🚪 {name} stepped outside for a sec",
];
const PEEK_MESSAGES_RESIZE: readonly string[] = [
  "📏 {name} just resized the window for a better look",
  "🔎 {name} is squinting harder",
  "🪟 {name} adjusted the curtains",
];

function pickPeekMessage(
  name: string,
  kind: "tab" | "mouse" | "resize",
): string {
  const pool =
    kind === "tab"
      ? PEEK_MESSAGES_TAB
      : kind === "mouse"
        ? PEEK_MESSAGES_MOUSE
        : PEEK_MESSAGES_RESIZE;
  const idx = Math.floor(Math.random() * pool.length);
  const template = pool[idx] ?? pool[0] ?? "👀 welcome back, {name}";
  return template.replace("{name}", name);
}

loadDictionary();
log.info("dictionary.loaded", { words: dictionarySize() });

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    words: dictionarySize(),
    ts: Date.now(),
  });
});

const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  pingInterval: 20000,
  pingTimeout: 25000,
});

const rooms = new Map<RoomId, Room>();

type IOSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function broadcastRoom(room: Room): void {
  io.to(room.id).emit("room_update", toPublicRoom(room));
}

function destroyRoom(room: Room): void {
  clearAllTimers(room);
  rooms.delete(room.id);
  log.info("room.destroyed", {
    roomId: room.id,
    rounds: room.roundsPlayed,
    ageSec: Math.floor((Date.now() - room.createdAt) / 1000),
  });
}

function markEmptyState(room: Room): void {
  room.emptySinceMs = room.players.length === 0 ? Date.now() : null;
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    let mutated = false;
    for (const p of [...room.players]) {
      if (
        !p.connected &&
        p.disconnectedAt !== null &&
        now - p.disconnectedAt > DISCONNECT_GRACE_MS
      ) {
        removePlayer(room, p.id);
        mutated = true;
        log.info("player.kicked.timeout", {
          roomId: room.id,
          playerId: shortId(p.id),
          name: p.name,
          offlineMs: now - p.disconnectedAt,
        });
      }
    }
    if (mutated) {
      markEmptyState(room);
      const hostExists = room.players.some((p) => p.id === room.hostId);
      if (!hostExists && room.players.length > 0) {
        const next =
          room.players.find((p) => p.connected) ?? room.players[0];
        if (next) {
          for (const p of room.players) p.isHost = false;
          next.isHost = true;
          room.hostId = next.id;
          log.info("host.promoted_after_cleanup", {
            roomId: room.id,
            newHost: shortId(next.id),
            name: next.name,
          });
        }
      }
      const activeCount = room.players.filter(
        (q) => q.connected && !q.spectator,
      ).length;
      const pauseable =
        room.phase === "pick_start" ||
        room.phase === "pick_end" ||
        room.phase === "countdown" ||
        room.phase === "active" ||
        room.phase === "scoreboard";
      if (pauseable && activeCount < 2) {
        pauseRoom(room, "not_enough_players");
      } else if (room.phase === "paused" && activeCount >= 2) {
        tryResumeRoom(room);
      } else {
        broadcastRoom(room);
      }
    }
    if (
      room.emptySinceMs !== null &&
      now - room.emptySinceMs > ROOM_EMPTY_GRACE_MS
    ) {
      destroyRoom(room);
      continue;
    }
    if (
      now - room.createdAt > ROOM_IDLE_MS &&
      room.phase === "lobby" &&
      room.players.length === 0
    ) {
      destroyRoom(room);
    }
  }
}, 15_000).unref();

function beginPickPhase(room: Room): void {
  const active = room.players.filter((p) => p.connected && !p.spectator);
  if (active.length < 2) {
    if (room.roundsPlayed > 0) {
      pauseRoom(room, "not_enough_players");
    } else {
      returnToLobby(room, "Need at least 2 players");
    }
    return;
  }

  if (room.gameStartedAt === null) {
    room.gameStartedAt = Date.now();
  }

  const pickers = selectPickers(room);
  const now = Date.now();
  const deadline = now + room.settings.pickTimeoutSeconds * 1000;

  room.phase = "pick_start";
  room.round = {
    index: room.roundsPlayed + 1,
    pickers: {
      start: {
        playerId: pickers.start.id,
        name: pickers.start.name,
        deadlineMs: deadline,
      },
      end: { playerId: pickers.end.id, name: pickers.end.name, deadlineMs: 0 },
    },
    start: "",
    end: "",
    startedAt: null,
    endsAt: null,
    winner: null,
    timedOut: false,
    skipped: false,
    skipReason: null,
    possibleWordCount: 0,
    cheaters: new Set<string>(),
    skipVotes: new Set<string>(),
    lastInvalid: null,
  };

  schedulePickTimeout(room, "start");
  log.info("round.pick.start", {
    roomId: room.id,
    roundIndex: room.round.index,
    picker: pickers.start.name,
  });
  broadcastRoom(room);
}

function schedulePickTimeout(room: Room, slot: "start" | "end"): void {
  if (room.pickTimer) clearTimeout(room.pickTimer);
  room.pickTimer = setTimeout(
    () => {
      if (!room.round) return;
      const letter = pickRandomLetter(slot);
      applyPick(room, slot, letter, true);
    },
    room.settings.pickTimeoutSeconds * 1000,
  );
}

function applyPick(
  room: Room,
  slot: "start" | "end",
  letter: string,
  fromTimeout: boolean,
): void {
  if (!room.round) return;
  const normalized = letter.trim().toLowerCase();
  const pickableLetters = slot === "end" ? PICKABLE_END_LETTERS : PICKABLE_LETTERS;
  if (!pickableLetters.includes(normalized)) return;

  if (room.pickTimer) {
    clearTimeout(room.pickTimer);
    room.pickTimer = null;
  }

  if (slot === "start") {
    room.round.start = normalized;
    room.phase = "pick_end";
    if (room.round.pickers.end) {
      room.round.pickers.end.deadlineMs =
        Date.now() + room.settings.pickTimeoutSeconds * 1000;
    }
    schedulePickTimeout(room, "end");
    log.info("round.pick.locked", {
      roomId: room.id,
      roundIndex: room.round.index,
      slot: "start",
      letter: normalized,
      auto: fromTimeout,
    });
    broadcastRoom(room);
    return;
  }

  room.round.end = normalized;

  const possible = countMatching(room.round.start, room.round.end);
  room.round.possibleWordCount = possible;
  log.info("round.pick.locked", {
    roomId: room.id,
    roundIndex: room.round.index,
    slot: "end",
    letter: normalized,
    auto: fromTimeout,
    start: room.round.start,
    possible,
  });

  if (possible === 0) {
    room.round.skipped = true;
    room.round.skipReason = "no_words";
    log.warn("round.skipped", {
      roomId: room.id,
      roundIndex: room.round.index,
      reason: "no_words",
      start: room.round.start,
      end: room.round.end,
    });
    io.to(room.id).emit("round_skipped", {
      roundIndex: room.round.index,
      start: room.round.start,
      end: room.round.end,
      reason: "no_words",
    });
    if (room.scoreboardTimer) clearTimeout(room.scoreboardTimer);
    room.phase = "scoreboard";
    room.roundsPlayed += 1;
    broadcastRoom(room);
    room.scoreboardTimer = setTimeout(() => {
      room.scoreboardTimer = null;
      if (!rooms.has(room.id)) return;
      if (room.players.length < 2) {
        returnToLobby(room);
        return;
      }
      beginPickPhase(room);
    }, SKIP_GRACE_MS);
    return;
  }

  beginCountdown(room);
  if (fromTimeout) broadcastRoom(room);
}

function beginCountdown(room: Room): void {
  if (!room.round) return;
  room.phase = "countdown";
  broadcastRoom(room);

  let n = room.settings.countdownSeconds;
  io.to(room.id).emit("countdown", n);
  if (room.countdownTimer) clearInterval(room.countdownTimer);
  room.countdownTimer = setInterval(() => {
    n -= 1;
    if (n > 0) {
      io.to(room.id).emit("countdown", n);
      return;
    }
    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
    }
    if (!room.round) return;
    room.phase = "active";
    const now = Date.now();
    room.round.startedAt = now;
    room.round.endsAt = now + room.settings.roundMaxSeconds * 1000;
    io.to(room.id).emit("countdown", 0);
    io.to(room.id).emit("reveal_constraints", {
      start: room.round.start,
      end: room.round.end,
      startedAt: room.round.startedAt,
      endsAt: room.round.endsAt,
    });
    io.to(room.id).emit("round_active");
    log.info("round.active", {
      roomId: room.id,
      roundIndex: room.round.index,
      start: room.round.start,
      end: room.round.end,
      possible: room.round.possibleWordCount,
    });
    broadcastRoom(room);

    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(
      () => {
        room.roundTimer = null;
        if (!room.round || room.round.winner) return;
        room.round.timedOut = true;
        for (const p of room.players) p.streak = 0;
        log.warn("round.timeout", {
          roomId: room.id,
          roundIndex: room.round.index,
        });
        io.to(room.id).emit("round_timeout", { roundIndex: room.round.index });
        finishRound(room);
      },
      room.settings.roundMaxSeconds * 1000,
    );
  }, 1000);
}

function finishRound(room: Room): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  if (room.round) {
    const r = room.round;
    room.roundHistory.push({
      index: r.index,
      start: r.start,
      end: r.end,
      winnerId: r.winner?.playerId ?? null,
      winnerName: r.winner?.name ?? null,
      word: r.winner?.word ?? null,
      tookMs: r.winner?.tookMs ?? null,
      cheaterIds: [...r.cheaters],
      skipped: r.skipped,
      skipReason: r.skipReason,
      timedOut: r.timedOut,
      possibleWordCount: r.possibleWordCount,
      scoresAfter: room.players.map((p) => ({ id: p.id, score: p.score })),
    });
  }
  room.phase = "scoreboard";
  room.roundsPlayed += 1;
  if (room.scoreboardTimer) clearTimeout(room.scoreboardTimer);
  broadcastRoom(room);

  if (
    room.round &&
    !room.round.winner &&
    room.round.possibleWordCount > 0
  ) {
    const samples = sampleMatching(
      room.round.start,
      room.round.end,
      room.usedWords,
      3,
    );
    if (samples.length > 0) {
      io.to(room.id).emit("round_words_reveal", {
        roundIndex: room.round.index,
        words: samples,
      });
    }
  }

  const reachedLimit = room.roundsPlayed >= room.settings.maxRounds;
  if (reachedLimit) {
    room.scoreboardTimer = setTimeout(() => {
      room.scoreboardTimer = null;
      if (!rooms.has(room.id)) return;
      enterGameOver(room);
    }, Math.min(room.settings.scoreboardSeconds * 1000, 6000));
    return;
  }

  room.scoreboardTimer = setTimeout(
    () => {
      room.scoreboardTimer = null;
      if (!rooms.has(room.id)) return;
      const active = room.players.filter((p) => p.connected && !p.spectator);
      if (active.length < 2) {
        returnToLobby(room);
        return;
      }
      beginPickPhase(room);
    },
    room.settings.scoreboardSeconds * 1000,
  );
}

function enterGameOver(room: Room): void {
  clearAllTimers(room);
  room.phase = "game_over";
  room.gameEndedAt = Date.now();
  log.info("game.over", {
    roomId: room.id,
    rounds: room.roundsPlayed,
    durationSec:
      room.gameStartedAt !== null
        ? Math.floor((Date.now() - room.gameStartedAt) / 1000)
        : null,
  });
  io.to(room.id).emit("game_over", {
    rounds: room.roundsPlayed,
    history: room.roundHistory,
  });
  broadcastRoom(room);
}

function pauseRoom(room: Room, reason: "not_enough_players"): void {
  if (room.phase === "paused" || room.phase === "lobby" || room.phase === "game_over")
    return;
  clearAllTimers(room);
  // Abandon the in-flight round; don't write it to history (it never finished).
  room.round = null;
  room.phase = "paused";
  log.info("game.paused", { roomId: room.id, reason });
  io.to(room.id).emit("game_paused", { reason });
  broadcastRoom(room);
}

function tryResumeRoom(room: Room): void {
  if (room.phase !== "paused") return;
  const active = room.players.filter((p) => p.connected && !p.spectator);
  if (active.length < 2) return;
  if (room.roundsPlayed >= room.settings.maxRounds) {
    enterGameOver(room);
    return;
  }
  log.info("game.resumed", { roomId: room.id });
  io.to(room.id).emit("game_resumed");
  beginPickPhase(room);
}

function returnToLobby(room: Room, errorMsg?: string): void {
  clearAllTimers(room);
  room.phase = "lobby";
  room.round = null;
  for (const p of room.players) p.ready = false;
  if (errorMsg) io.to(room.id).emit("error_msg", errorMsg);
  broadcastRoom(room);
}

io.on("connection", (socket: IOSocket) => {
  socket.data.playerId = randomUUID();
  socket.data.roomId = null;
  socket.data.name = "";
  log.debug("socket.connected", { sid: socket.id });

  const detachFromCurrentRoom = (): void => {
    const prevRoomId = socket.data.roomId;
    if (!prevRoomId) return;
    const prev = rooms.get(prevRoomId);
    if (prev) {
      removePlayer(prev, socket.data.playerId);
      markEmptyState(prev);
      if (prev.phase !== "lobby" && prev.players.length < 2) {
        returnToLobby(prev, "A player left, returning to lobby");
      } else {
        broadcastRoom(prev);
      }
    }
    socket.leave(prevRoomId);
    socket.data.roomId = null;
  };

  socket.on("create_room", (payload, ack) => {
    const validation = validateName(payload?.name ?? "");
    if (!validation.ok) return ack({ ok: false, error: validation.error });
    const name = validation.name;

    socket.data.playerId = adoptPlayerId(payload?.playerId, socket.data.playerId);
    detachFromCurrentRoom();

    const roomId = generateRoomId(new Set(rooms.keys()));
    const player: Player = {
      id: socket.data.playerId,
      name,
      isHost: true,
      ready: false,
      score: 0,
      streak: 0,
      bestMs: null,
      connected: true,
      disconnectedAt: null,
      spectator: false,
    };
    const room = createRoom(roomId, player);
    rooms.set(roomId, room);

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

    log.info("room.created", {
      roomId,
      hostId: shortId(player.id),
      hostName: name,
    });

    ack({ ok: true, data: { roomId, playerId: player.id } });
    broadcastRoom(room);
  });

  socket.on("join_room", (payload, ack) => {
    const roomId = validateRoomCode(payload?.roomId ?? "");
    if (!roomId) return ack({ ok: false, error: "Invalid room code" });

    const validation = validateName(payload?.name ?? "");
    if (!validation.ok) return ack({ ok: false, error: validation.error });
    const name = validation.name;

    socket.data.playerId = adoptPlayerId(payload?.playerId, socket.data.playerId);

    const room = rooms.get(roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });

    if (socket.data.roomId && socket.data.roomId !== roomId) {
      detachFromCurrentRoom();
    }

    const existing = findPlayer(room, socket.data.playerId);

    if (isNameTaken(room, name, existing?.id))
      return ack({
        ok: false,
        error: "That name is already taken in this room — try another",
      });

    if (!existing) {
      if (room.players.length >= MAX_PLAYERS)
        return ack({ ok: false, error: "Room is full" });

      const isMidRound =
        room.phase === "pick_start" ||
        room.phase === "pick_end" ||
        room.phase === "countdown" ||
        room.phase === "active";
      const player: Player = {
        id: socket.data.playerId,
        name,
        isHost: false,
        ready: false,
        score: 0,
        streak: 0,
        bestMs: null,
        connected: true,
        disconnectedAt: null,
        spectator: isMidRound,
      };
      room.players.push(player);
      room.emptySinceMs = null;
      log.info(isMidRound ? "spectator.joined" : "player.joined", {
        roomId,
        playerId: shortId(player.id),
        name,
        size: room.players.length,
        phase: room.phase,
      });
    } else {
      const wasOffline = !existing.connected;
      if (existing.name !== name) existing.name = name;
      existing.connected = true;
      existing.disconnectedAt = null;
      log.info(wasOffline ? "player.rejoined" : "player.rebound", {
        roomId,
        playerId: shortId(existing.id),
        name,
      });
    }

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

    const hostStillThere = room.players.some(
      (p) => p.id === room.hostId && p.connected,
    );
    if (!hostStillThere) {
      const me = findPlayer(room, socket.data.playerId);
      if (me) {
        for (const p of room.players) p.isHost = false;
        me.isHost = true;
        room.hostId = me.id;
        log.info("host.promoted_orphan", {
          roomId,
          newHost: shortId(me.id),
          name: me.name,
        });
      }
    }

    ack({
      ok: true,
      data: { playerId: socket.data.playerId, room: toPublicRoom(room) },
    });
    broadcastRoom(room);

    if (room.phase === "paused") {
      const active = room.players.filter(
        (p) => p.connected && !p.spectator,
      );
      if (active.length >= 2) tryResumeRoom(room);
    }
  });

  socket.on("leave_room", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });

    removePlayer(room, socket.data.playerId);
    socket.leave(room.id);
    socket.data.roomId = null;
    markEmptyState(room);

    if (room.phase !== "lobby" && room.players.length < 2) {
      returnToLobby(room, "A player left, returning to lobby");
    } else {
      broadcastRoom(room);
    }

    ack({ ok: true, data: null });
  });

  socket.on("set_ready", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Can only change ready in lobby" });

    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });
    if (player.spectator)
      return ack({ ok: false, error: "Spectators don't ready up" });

    player.ready = Boolean(payload.ready);
    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("set_settings", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can change settings" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Settings can only change in lobby" });

    const next = clampSettings(room.settings, payload.settings ?? {});
    room.settings = next;
    log.info("settings.changed", {
      roomId: room.id,
      hostId: shortId(socket.data.playerId),
      settings: next,
    });
    ack({ ok: true, data: { settings: next } });
    broadcastRoom(room);
  });

  socket.on("start_round", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can start" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Round already in progress" });
    const active = room.players.filter((p) => p.connected && !p.spectator);
    if (active.length < 2)
      return ack({ ok: false, error: "Need at least 2 connected players" });
    if (!active.every((p) => p.ready))
      return ack({ ok: false, error: "All players must be ready" });

    ack({ ok: true, data: null });
    beginPickPhase(room);
  });

  socket.on("pick_letter", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room || !room.round)
      return ack({ ok: false, error: "Room not found" });

    const slot = payload.slot;
    if (slot !== "start" && slot !== "end")
      return ack({ ok: false, error: "Invalid slot" });

    if (slot === "start" && room.phase !== "pick_start")
      return ack({ ok: false, error: "Not the pick-start phase" });
    if (slot === "end" && room.phase !== "pick_end")
      return ack({ ok: false, error: "Not the pick-end phase" });

    const expectedPicker =
      slot === "start" ? room.round.pickers.start : room.round.pickers.end;
    if (!expectedPicker || expectedPicker.playerId !== socket.data.playerId)
      return ack({ ok: false, error: "It's not your turn to pick" });

    const me = findPlayer(room, socket.data.playerId);
    if (me?.spectator)
      return ack({ ok: false, error: "Spectators just watch" });

    const letter = (payload.letter ?? "").trim().toLowerCase();
    const pickableLetters = slot === "end" ? PICKABLE_END_LETTERS : PICKABLE_LETTERS;
    if (!pickableLetters.includes(letter))
      return ack({ ok: false, error: "Pick a valid letter" });

    ack({ ok: true, data: null });
    applyPick(room, slot, letter, false);
  });

  socket.on("submit_word", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });
    if (player.spectator)
      return ack({ ok: false, error: "Spectators just watch" });
    if (room.phase !== "active" || !room.round)
      return ack({ ok: false, error: "Round is not active" });
    if (room.round.winner)
      return ack({ ok: false, error: "Round already won" });

    const rawWord = (payload.word ?? "").trim().toLowerCase().slice(0, 30);
    const pasted = payload.pasted === true;
    const wasFlaggedBefore = room.round.cheaters.has(player.id);

    if (pasted && !wasFlaggedBefore) {
      room.round.cheaters.add(player.id);
      const before = player.score;
      player.score = Math.max(0, before - PASTE_PENALTY);
      const taken = before - player.score;
      log.warn("cheat.paste", {
        roomId: room.id,
        roundIndex: room.round.index,
        playerId: shortId(player.id),
        name: player.name,
        penalty: taken,
      });
      io.to(room.id).emit("cheater_caught", {
        playerId: player.id,
        name: player.name,
        penalty: taken,
        scoreAfter: player.score,
      });
      broadcastRoom(room);
      return ack({ ok: true, data: { accepted: false, reason: "pasted" } });
    }

    if (wasFlaggedBefore || pasted) {
      return ack({ ok: true, data: { accepted: false, reason: "pasted" } });
    }

    const result = validateWord(
      rawWord,
      room.round.start,
      room.round.end,
      room.usedWords,
    );

    if (!result.valid) {
      let reason = result.reason ?? "invalid";
      if (
        reason === "not_a_word" &&
        room.round.start &&
        room.round.end &&
        isAlmostMatch(rawWord, room.round.start, room.round.end)
      ) {
        reason = "almost";
      }
      io.to(room.id).emit("invalid_attempt", {
        playerId: player.id,
        name: player.name,
        word: rawWord,
        reason,
      });

      const prev = room.round.lastInvalid;
      const now = Date.now();
      if (
        prev &&
        prev.word === rawWord &&
        prev.playerId !== player.id &&
        now - prev.at < 1500
      ) {
        log.info("hivemind", {
          roomId: room.id,
          word: rawWord,
          a: prev.name,
          b: player.name,
        });
        io.to(room.id).emit("hivemind", {
          word: rawWord,
          names: [prev.name, player.name],
        });
      }
      room.round.lastInvalid = {
        word: rawWord,
        playerId: player.id,
        name: player.name,
        at: now,
      };

      return ack({
        ok: true,
        data: { accepted: false, reason },
      });
    }

    const tookMs = Date.now() - (room.round.startedAt ?? Date.now());
    player.streak += 1;
    const bonus = player.streak >= STREAK_BONUS_AT ? STREAK_BONUS_POINTS : 0;
    player.score += WIN_POINTS + bonus;
    if (player.bestMs === null || tookMs < player.bestMs)
      player.bestMs = tookMs;

    for (const other of room.players) {
      if (other.id !== player.id) other.streak = 0;
    }

    const winnerData = {
      playerId: player.id,
      name: player.name,
      word: rawWord,
      tookMs,
      streak: player.streak,
      bonus,
    };
    room.round.winner = winnerData;
    room.usedWords.add(rawWord);

    log.info("round.winner", {
      roomId: room.id,
      roundIndex: room.round.index,
      playerId: shortId(player.id),
      name: player.name,
      word: rawWord,
      tookMs,
      streak: player.streak,
      bonus,
    });
    io.to(room.id).emit("winner", winnerData);
    ack({ ok: true, data: { accepted: true } });
    finishRound(room);
  });

  let lastPeekAt = 0;
  socket.on("peeked", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });
    if (room.phase !== "active") return ack({ ok: true, data: null });

    const kind: "tab" | "mouse" | "resize" =
      payload.kind === "mouse"
        ? "mouse"
        : payload.kind === "resize"
          ? "resize"
          : "tab";
    const now = Date.now();
    if (now - lastPeekAt < PEEK_THROTTLE_MS) {
      return ack({ ok: true, data: null });
    }
    lastPeekAt = now;

    io.to(room.id).emit("peek_announce", {
      playerId: player.id,
      name: player.name,
      message: pickPeekMessage(player.name, kind),
      kind,
    });
    ack({ ok: true, data: null });
  });

  socket.on("vote_skip", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });
    if (player.spectator)
      return ack({ ok: false, error: "Spectators don't vote" });
    if (room.phase !== "active" || !room.round)
      return ack({ ok: false, error: "Round is not active" });
    if (room.round.winner)
      return ack({ ok: false, error: "Round already won" });

    room.round.skipVotes.add(player.id);
    const total = room.players.filter(
      (p) => p.connected && !p.spectator,
    ).length;
    const votes = room.round.skipVotes.size;

    io.to(room.id).emit("skip_vote", {
      playerId: player.id,
      name: player.name,
      votes,
      total,
    });
    broadcastRoom(room);
    ack({ ok: true, data: { votes, total } });

    log.info("round.vote_skip", {
      roomId: room.id,
      roundIndex: room.round.index,
      voter: player.name,
      votes,
      total,
    });

    if (votes >= total && total >= 1) {
      room.round.skipped = true;
      room.round.skipReason = "voted";
      log.warn("round.skipped", {
        roomId: room.id,
        roundIndex: room.round.index,
        reason: "voted",
      });
      io.to(room.id).emit("round_skipped", {
        roundIndex: room.round.index,
        start: room.round.start,
        end: room.round.end,
        reason: "voted",
      });
      finishRound(room);
    }
  });

  socket.on("set_spectator", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });

    const next = Boolean(payload.spectator);
    if (player.spectator === next) return ack({ ok: true, data: null });

    player.spectator = next;
    if (next) {
      player.ready = false;
    }

    log.info("spectator.toggle", {
      roomId: room.id,
      playerId: shortId(player.id),
      name: player.name,
      spectator: next,
      phase: room.phase,
    });

    ack({ ok: true, data: null });

    const active = room.players.filter((p) => p.connected && !p.spectator);
    const pauseable =
      room.phase === "pick_start" ||
      room.phase === "pick_end" ||
      room.phase === "countdown" ||
      room.phase === "active" ||
      room.phase === "scoreboard";

    if (pauseable && active.length < 2) {
      pauseRoom(room, "not_enough_players");
      return;
    }

    if (room.phase === "paused" && active.length >= 2) {
      tryResumeRoom(room);
      return;
    }

    broadcastRoom(room);
  });

  socket.on("resume_game", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can resume" });
    if (room.phase !== "paused")
      return ack({ ok: false, error: "Game isn't paused" });
    const active = room.players.filter((p) => p.connected && !p.spectator);
    if (active.length < 2)
      return ack({ ok: false, error: "Need at least 2 active players" });

    ack({ ok: true, data: null });
    tryResumeRoom(room);
  });

  socket.on("set_room_name", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can rename the room" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Rename in lobby only" });

    const validation = validateRoomName(payload?.name ?? "");
    if (!validation.ok) return ack({ ok: false, error: validation.error });
    room.name = validation.name;
    log.info("room.renamed", { roomId: room.id, name: room.name });
    ack({ ok: true, data: { name: room.name } });
    broadcastRoom(room);
  });

  socket.on("new_game", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can start a new game" });
    if (room.phase !== "game_over" && room.phase !== "lobby")
      return ack({ ok: false, error: "Wait for the game to end" });

    for (const p of room.players) {
      p.score = 0;
      p.streak = 0;
      p.bestMs = null;
      p.ready = false;
      p.spectator = false;
    }
    room.usedWords.clear();
    room.recentPickers = [];
    room.roundsPlayed = 0;
    room.roundHistory = [];
    room.gameStartedAt = null;
    room.gameEndedAt = null;
    room.round = null;
    clearAllTimers(room);
    room.phase = "lobby";

    log.info("game.new", { roomId: room.id });
    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("transfer_host", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can hand the crown over" });
    const transferable =
      room.phase === "lobby" ||
      room.phase === "paused" ||
      room.phase === "game_over" ||
      room.phase === "scoreboard";
    if (!transferable)
      return ack({ ok: false, error: "Can't transfer host mid-round" });

    const target = findPlayer(room, payload.toPlayerId);
    if (!target) return ack({ ok: false, error: "Player not found" });
    if (!target.connected)
      return ack({ ok: false, error: "That player is offline" });
    if (target.id === room.hostId)
      return ack({ ok: false, error: "They're already the host" });

    for (const p of room.players) p.isHost = false;
    target.isHost = true;
    room.hostId = target.id;

    log.info("host.transferred", {
      roomId: room.id,
      from: shortId(socket.data.playerId),
      to: shortId(target.id),
      name: target.name,
    });

    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("end_game", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can end the game" });

    for (const p of room.players) {
      p.score = 0;
      p.streak = 0;
      p.bestMs = null;
    }
    room.usedWords.clear();
    room.recentPickers = [];
    room.roundsPlayed = 0;
    returnToLobby(room);
    ack({ ok: true, data: null });
  });

  socket.on("disconnect", (reason) => {
    log.debug("socket.disconnect", { sid: socket.id, reason });
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = findPlayer(room, socket.data.playerId);
    const isHost = player?.isHost === true;
    if (room.phase === "lobby" && !isHost) {
      removePlayer(room, socket.data.playerId);
      log.info("player.left", {
        roomId,
        playerId: shortId(socket.data.playerId),
        phase: "lobby",
        reason,
      });
    } else if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
      player.ready = false;
      log.info("player.offline", {
        roomId,
        playerId: shortId(player.id),
        name: player.name,
        phase: room.phase,
        reason,
      });
    }

    markEmptyState(room);
    const connectedCount = room.players.filter((p) => p.connected).length;
    const activeCount = room.players.filter(
      (p) => p.connected && !p.spectator,
    ).length;
    const pauseable =
      room.phase === "pick_start" ||
      room.phase === "pick_end" ||
      room.phase === "countdown" ||
      room.phase === "active" ||
      room.phase === "scoreboard";

    if (room.phase !== "lobby" && connectedCount < 1) {
      log.warn("room.return_to_lobby", {
        roomId,
        cause: "all_disconnected",
      });
      returnToLobby(room, "Everyone disconnected — back to lobby");
    } else if (pauseable && activeCount < 2) {
      pauseRoom(room, "not_enough_players");
    } else {
      broadcastRoom(room);
    }
  });
});

server.listen(PORT, () => {
  log.info("server.listening", {
    port: PORT,
    cors: CORS_ORIGIN,
    env: process.env.NODE_ENV ?? "dev",
    nodeVersion: process.version,
  });
});

setInterval(() => {
  let totalPlayers = 0;
  let connectedPlayers = 0;
  for (const r of rooms.values()) {
    totalPlayers += r.players.length;
    connectedPlayers += r.players.filter((p) => p.connected).length;
  }
  log.info("stats", {
    rooms: rooms.size,
    totalPlayers,
    connectedPlayers,
    uptimeSec: Math.floor(process.uptime()),
  });
}, 60_000).unref();

process.on("uncaughtException", (err) => {
  log.error("uncaughtException", { err: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection", { reason: String(reason) });
});
