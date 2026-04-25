import type {
  Player,
  PlayerId,
  PublicRoom,
  Room,
  RoomId,
  RoomSettings,
} from "./types";
import { SETTINGS_BOUNDS } from "./types";

export function defaultSettings(): RoomSettings {
  return {
    countdownSeconds: SETTINGS_BOUNDS.countdownSeconds.default,
    pickTimeoutSeconds: SETTINGS_BOUNDS.pickTimeoutSeconds.default,
    scoreboardSeconds: SETTINGS_BOUNDS.scoreboardSeconds.default,
    roundMaxSeconds: SETTINGS_BOUNDS.roundMaxSeconds.default,
  };
}

export function clampSettings(
  current: RoomSettings,
  patch: Partial<RoomSettings>,
): RoomSettings {
  const next: RoomSettings = { ...current };
  for (const key of Object.keys(SETTINGS_BOUNDS) as (keyof RoomSettings)[]) {
    const proposed = patch[key];
    if (proposed === undefined) continue;
    const bounds = SETTINGS_BOUNDS[key];
    const numeric = Math.round(Number(proposed));
    if (!Number.isFinite(numeric)) continue;
    next[key] = Math.min(bounds.max, Math.max(bounds.min, numeric));
  }
  return next;
}

const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PICKABLE_LETTERS = "abcdefghijklmnoprstuvwy".split("");

export function generateRoomId(existing: Set<RoomId>): RoomId {
  for (let attempt = 0; attempt < 50; attempt++) {
    let id = "";
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * ROOM_ID_ALPHABET.length);
      id += ROOM_ID_ALPHABET[idx];
    }
    if (!existing.has(id)) return id;
  }
  throw new Error("Failed to allocate unique room id");
}

export function createRoom(id: RoomId, host: Player): Room {
  return {
    id,
    hostId: host.id,
    players: [host],
    phase: "lobby",
    round: null,
    roundsPlayed: 0,
    usedWords: new Set<string>(),
    recentPickers: [],
    settings: defaultSettings(),
    pickTimer: null,
    countdownTimer: null,
    scoreboardTimer: null,
    roundTimer: null,
    createdAt: Date.now(),
    emptySinceMs: null,
  };
}

export function toPublicRoom(room: Room): PublicRoom {
  const round = room.round
    ? {
        index: room.round.index,
        pickers: room.round.pickers,
        start:
          room.phase === "active" ||
          room.phase === "scoreboard" ||
          room.phase === "countdown" ||
          room.phase === "pick_end"
            ? room.round.start
            : "",
        end:
          room.phase === "active" || room.phase === "scoreboard" || room.phase === "countdown"
            ? room.round.end
            : "",
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        winner: room.round.winner,
        timedOut: room.round.timedOut,
      }
    : null;

  return {
    id: room.id,
    hostId: room.hostId,
    players: room.players,
    phase: room.phase,
    round,
    roundsPlayed: room.roundsPlayed,
    usedWordsCount: room.usedWords.size,
    settings: room.settings,
  };
}

export function findPlayer(room: Room, playerId: PlayerId): Player | undefined {
  return room.players.find((p) => p.id === playerId);
}

export function removePlayer(room: Room, playerId: PlayerId): Player | undefined {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return undefined;
  const [removed] = room.players.splice(idx, 1);
  if (room.hostId === playerId && room.players.length > 0) {
    const next = room.players[0];
    if (next) {
      room.hostId = next.id;
      next.isHost = true;
    }
  }
  return removed;
}

export function sanitizeName(raw: string): string {
  return raw.trim().slice(0, 20);
}

export function pickRandomLetter(): string {
  const idx = Math.floor(Math.random() * PICKABLE_LETTERS.length);
  return PICKABLE_LETTERS[idx] ?? "a";
}

export function selectPickers(room: Room): { start: Player; end: Player } {
  const eligible = room.players.filter((p) => p.ready || room.players.every((q) => !q.ready));
  const pool = eligible.length >= 2 ? eligible : room.players;
  if (pool.length < 2) throw new Error("Not enough players to pick");

  const recent = new Set(room.recentPickers);
  const preferred = pool.filter((p) => !recent.has(p.id));
  const candidates = preferred.length >= 2 ? preferred : pool;

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const startPicker = shuffled[0];
  let endPicker = shuffled.find((p) => p.id !== startPicker?.id);
  if (!endPicker) {
    const remaining = pool.filter((p) => p.id !== startPicker?.id);
    endPicker = remaining[Math.floor(Math.random() * remaining.length)];
  }
  if (!startPicker || !endPicker) throw new Error("Not enough players to pick");

  const window = Math.max(2, pool.length - 1);
  room.recentPickers = [...room.recentPickers, startPicker.id, endPicker.id].slice(-window);
  return { start: startPicker, end: endPicker };
}

export function clearAllTimers(room: Room): void {
  if (room.pickTimer) {
    clearTimeout(room.pickTimer);
    room.pickTimer = null;
  }
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
  if (room.scoreboardTimer) {
    clearTimeout(room.scoreboardTimer);
    room.scoreboardTimer = null;
  }
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
}
