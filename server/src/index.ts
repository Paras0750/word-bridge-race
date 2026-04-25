import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { Server, type Socket } from "socket.io";
import {
  createRoom,
  findPlayer,
  generateRoomId,
  removePlayer,
  sanitizeConstraint,
  sanitizeName,
  toPublicRoom,
} from "./rooms";
import { validateWord } from "./validate";
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
const COUNTDOWN_SECONDS = 3;
const ROOM_IDLE_MS = 1000 * 60 * 30;
const ROOM_EMPTY_GRACE_MS = 1000 * 60;
const MAX_PLAYERS = 10;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, ts: Date.now() });
});

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  server,
  {
    cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
    pingInterval: 20000,
    pingTimeout: 25000,
  },
);

const rooms = new Map<RoomId, Room>();

type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function broadcastRoom(room: Room): void {
  io.to(room.id).emit("room_update", toPublicRoom(room));
}

function clearCountdown(room: Room): void {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function destroyRoom(room: Room): void {
  clearCountdown(room);
  rooms.delete(room.id);
}

function markEmptyState(room: Room): void {
  room.emptySinceMs = room.players.length === 0 ? Date.now() : null;
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.emptySinceMs !== null && now - room.emptySinceMs > ROOM_EMPTY_GRACE_MS) {
      destroyRoom(room);
      continue;
    }
    if (now - room.createdAt > ROOM_IDLE_MS && room.phase === "lobby" && room.players.length === 0) {
      destroyRoom(room);
    }
  }
}, 30_000).unref();

io.on("connection", (socket: IOSocket) => {
  socket.data.playerId = randomUUID();
  socket.data.roomId = null;
  socket.data.name = "";

  socket.on("create_room", (payload, ack) => {
    const name = sanitizeName(payload?.name ?? "");
    if (!name) return ack({ ok: false, error: "Name is required" });

    const roomId = generateRoomId(new Set(rooms.keys()));
    const player: Player = { id: socket.data.playerId, name, isHost: true };
    const room = createRoom(roomId, player);
    rooms.set(roomId, room);

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

    ack({ ok: true, data: { roomId, playerId: player.id } });
    broadcastRoom(room);
  });

  socket.on("join_room", (payload, ack) => {
    const roomId = (payload?.roomId ?? "").trim().toUpperCase();
    const name = sanitizeName(payload?.name ?? "");
    if (!roomId) return ack({ ok: false, error: "Room code is required" });
    if (!name) return ack({ ok: false, error: "Name is required" });

    const room = rooms.get(roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.players.length >= MAX_PLAYERS)
      return ack({ ok: false, error: "Room is full" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Round already in progress" });

    const player: Player = { id: socket.data.playerId, name, isHost: false };
    room.players.push(player);
    room.emptySinceMs = null;

    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.join(roomId);

    ack({ ok: true, data: { playerId: player.id, room: toPublicRoom(room) } });
    broadcastRoom(room);
  });

  socket.on("leave_room", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });

    removePlayer(room, socket.data.playerId);
    socket.leave(room.id);
    socket.data.roomId = null;
    markEmptyState(room);

    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("set_constraints", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can set constraints" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Round already in progress" });

    const start = sanitizeConstraint(payload.start);
    const end = sanitizeConstraint(payload.end);
    if (!start || !end) return ack({ ok: false, error: "Both start and end are required" });
    if (!/^[a-z]+$/.test(start) || !/^[a-z]+$/.test(end))
      return ack({ ok: false, error: "Letters only" });

    room.constraints = { start, end };
    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("start_round", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can start the round" });
    if (room.phase !== "lobby")
      return ack({ ok: false, error: "Round already in progress" });
    if (!room.constraints.start || !room.constraints.end)
      return ack({ ok: false, error: "Set the start and end first" });
    if (room.players.length < 1)
      return ack({ ok: false, error: "Need at least 1 player" });

    room.phase = "countdown";
    room.round = {
      start: room.constraints.start,
      end: room.constraints.end,
      startedAt: null,
      winner: null,
      attempts: [],
    };

    ack({ ok: true, data: null });
    broadcastRoom(room);

    let n = COUNTDOWN_SECONDS;
    io.to(room.id).emit("countdown", n);
    clearCountdown(room);
    room.countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        io.to(room.id).emit("countdown", n);
        return;
      }
      clearCountdown(room);
      if (!room.round) return;
      room.phase = "active";
      room.round.startedAt = Date.now();
      io.to(room.id).emit("countdown", 0);
      io.to(room.id).emit("reveal_constraints", {
        start: room.round.start,
        end: room.round.end,
        startedAt: room.round.startedAt,
      });
      io.to(room.id).emit("round_active");
      broadcastRoom(room);
    }, 1000);
  });

  socket.on("submit_word", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (!findPlayer(room, socket.data.playerId))
      return ack({ ok: false, error: "Not in this room" });
    if (room.phase !== "active" || !room.round)
      return ack({ ok: false, error: "Round is not active" });
    if (room.round.winner) return ack({ ok: false, error: "Round already won" });

    const rawWord = (payload.word ?? "").trim().toLowerCase();
    const result = validateWord(rawWord, room.round.start, room.round.end);

    const player = findPlayer(room, socket.data.playerId);
    if (!player) return ack({ ok: false, error: "Player not found" });

    room.round.attempts.push({
      playerId: player.id,
      name: player.name,
      word: rawWord,
      valid: result.valid,
      at: Date.now(),
    });

    if (!result.valid) {
      io.to(room.id).emit("invalid_attempt", {
        playerId: player.id,
        name: player.name,
        word: rawWord,
        reason: result.reason ?? "invalid",
      });
      return ack({ ok: true, data: { accepted: false, reason: result.reason ?? "invalid" } });
    }

    const tookMs = Date.now() - (room.round.startedAt ?? Date.now());
    room.round.winner = { playerId: player.id, name: player.name, word: rawWord, tookMs };
    room.phase = "finished";

    io.to(room.id).emit("winner", room.round.winner);
    broadcastRoom(room);
    ack({ ok: true, data: { accepted: true } });
  });

  socket.on("reset_round", (payload, ack) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack({ ok: false, error: "Room not found" });
    if (room.hostId !== socket.data.playerId)
      return ack({ ok: false, error: "Only the host can reset" });

    clearCountdown(room);
    room.phase = "lobby";
    room.round = null;
    room.constraints = { start: "", end: "" };

    ack({ ok: true, data: null });
    broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    removePlayer(room, socket.data.playerId);
    markEmptyState(room);
    if (room.phase === "countdown") {
      clearCountdown(room);
      room.phase = "lobby";
      room.round = null;
    }
    broadcastRoom(room);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[word-bridge-race] server listening on :${PORT}`);
});
