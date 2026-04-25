import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { Server, type Socket } from "socket.io";
import {
  PICKABLE_LETTERS,
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
} from "./rooms";
import { validateWord } from "./validate";
import { countMatching, dictionarySize, loadDictionary } from "./dictionary";
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

function pickPeekMessage(name: string, kind: "tab" | "mouse"): string {
  const pool = kind === "tab" ? PEEK_MESSAGES_TAB : PEEK_MESSAGES_MOUSE;
  const idx = Math.floor(Math.random() * pool.length);
  const template = pool[idx] ?? pool[0] ?? "👀 welcome back, {name}";
  return template.replace("{name}", name);
}

loadDictionary();
// eslint-disable-next-line no-console
console.log(`[word-bridge-race] dictionary loaded: ${dictionarySize()} words`);

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
      }
    }
    if (mutated) {
      markEmptyState(room);
      const connectedCount = room.players.filter((q) => q.connected).length;
      if (room.phase !== "lobby" && connectedCount < 2) {
        returnToLobby(room);
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
  if (room.players.length < 2) {
    returnToLobby(room, "Need at least 2 players");
    return;
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
  };

  schedulePickTimeout(room, "start");
  broadcastRoom(room);
}

function schedulePickTimeout(room: Room, slot: "start" | "end"): void {
  if (room.pickTimer) clearTimeout(room.pickTimer);
  room.pickTimer = setTimeout(
    () => {
      if (!room.round) return;
      const letter = pickRandomLetter();
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
  if (!PICKABLE_LETTERS.includes(normalized)) return;

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
    broadcastRoom(room);
    return;
  }

  room.round.end = normalized;

  const possible = countMatching(room.round.start, room.round.end);
  room.round.possibleWordCount = possible;

  if (possible === 0) {
    room.round.skipped = true;
    room.round.skipReason = "no_words";
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
    broadcastRoom(room);

    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(
      () => {
        room.roundTimer = null;
        if (!room.round || room.round.winner) return;
        room.round.timedOut = true;
        for (const p of room.players) p.streak = 0;
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
  room.phase = "scoreboard";
  room.roundsPlayed += 1;
  if (room.scoreboardTimer) clearTimeout(room.scoreboardTimer);
  broadcastRoom(room);

  room.scoreboardTimer = setTimeout(
    () => {
      room.scoreboardTimer = null;
      if (!rooms.has(room.id)) return;
      if (room.players.length < 2) {
        returnToLobby(room);
        return;
      }
      beginPickPhase(room);
    },
    room.settings.scoreboardSeconds * 1000,
  );
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
    };
    const room = createRoom(roomId, player);
    rooms.set(roomId, room);

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

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
      if (room.phase !== "lobby")
        return ack({ ok: false, error: "Round already in progress" });

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
      };
      room.players.push(player);
      room.emptySinceMs = null;
    } else {
      if (existing.name !== name) existing.name = name;
      existing.connected = true;
      existing.disconnectedAt = null;
    }

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

    ack({
      ok: true,
      data: { playerId: socket.data.playerId, room: toPublicRoom(room) },
    });
    broadcastRoom(room);
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
    const connected = room.players.filter((p) => p.connected);
    if (connected.length < 2)
      return ack({ ok: false, error: "Need at least 2 connected players" });
    if (!connected.every((p) => p.ready))
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

    const letter = (payload.letter ?? "").trim().toLowerCase();
    if (!PICKABLE_LETTERS.includes(letter))
      return ack({ ok: false, error: "Pick a valid letter" });

    ack({ ok: true, data: null });
    applyPick(room, slot, letter, false);
  });

  socket.on("submit_word", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Not in this room" });
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
      io.to(room.id).emit("invalid_attempt", {
        playerId: player.id,
        name: player.name,
        word: rawWord,
        reason: result.reason ?? "invalid",
      });
      return ack({
        ok: true,
        data: { accepted: false, reason: result.reason ?? "invalid" },
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

    const kind = payload.kind === "mouse" ? "mouse" : "tab";
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
    if (room.phase !== "active" || !room.round)
      return ack({ ok: false, error: "Round is not active" });
    if (room.round.winner)
      return ack({ ok: false, error: "Round already won" });

    room.round.skipVotes.add(player.id);
    const total = room.players.length;
    const votes = room.round.skipVotes.size;

    io.to(room.id).emit("skip_vote", {
      playerId: player.id,
      name: player.name,
      votes,
      total,
    });
    broadcastRoom(room);
    ack({ ok: true, data: { votes, total } });

    if (votes >= total && total >= 1) {
      room.round.skipped = true;
      room.round.skipReason = "voted";
      io.to(room.id).emit("round_skipped", {
        roundIndex: room.round.index,
        start: room.round.start,
        end: room.round.end,
        reason: "voted",
      });
      finishRound(room);
    }
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

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = findPlayer(room, socket.data.playerId);
    if (room.phase === "lobby") {
      removePlayer(room, socket.data.playerId);
    } else if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
      player.ready = false;
    }

    markEmptyState(room);
    const connectedCount = room.players.filter((p) => p.connected).length;
    if (room.phase !== "lobby" && connectedCount < 1) {
      returnToLobby(room, "Everyone disconnected — back to lobby");
    } else {
      broadcastRoom(room);
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[word-bridge-race] server listening on :${PORT}`);
});
