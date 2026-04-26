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
    maxRounds: SETTINGS_BOUNDS.maxRounds.default,
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

export const PICKABLE_START_LETTERS = "abcdefghijklmnoprstuvwy".split("");
export const PICKABLE_END_LETTERS = "abcdefghiklmnoprstuvwy".split("");
export const PICKABLE_LETTERS = PICKABLE_START_LETTERS;

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
    name: null,
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
    roundHistory: [],
    gameStartedAt: null,
    gameEndedAt: null,
  };
}

export function toPublicRoom(room: Room): PublicRoom {
  const round = room.round
    ? {
        index: room.round.index,
        pickers: room.round.pickers,
        start:
          room.phase === "countdown" ||
          room.phase === "active" ||
          room.phase === "scoreboard"
            ? room.round.start
            : "",
        end:
          room.phase === "countdown" ||
          room.phase === "active" ||
          room.phase === "scoreboard"
            ? room.round.end
            : "",
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        winner: room.round.winner,
        timedOut: room.round.timedOut,
        skipped: room.round.skipped,
        skipReason: room.round.skipReason,
        possibleWordCount: room.round.possibleWordCount,
        skipVoteIds: [...room.round.skipVotes],
      }
    : null;

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    players: room.players,
    phase: room.phase,
    round,
    roundsPlayed: room.roundsPlayed,
    usedWordsCount: room.usedWords.size,
    settings: room.settings,
    roundHistory: room.roundHistory,
    gameStartedAt: room.gameStartedAt,
    gameEndedAt: room.gameEndedAt,
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

const NAME_ALLOWED = /^[\p{L}\p{N} _.\-]+$/u;
const ROOM_CODE_RE = /^[A-Z2-9]{6}$/;

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = sanitizeName(raw);
  if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters" };
  if (name.length > 20) return { ok: false, error: "Name must be 20 characters or less" };
  if (!NAME_ALLOWED.test(name))
    return { ok: false, error: "Name has invalid characters" };
  return { ok: true, name };
}

export function validateRoomCode(raw: string): string | null {
  const cleaned = (raw ?? "").trim().toUpperCase();
  return ROOM_CODE_RE.test(cleaned) ? cleaned : null;
}

const ROOM_NAME_RE = /^[\p{L}\p{N} _.\-!?'&]+$/u;

export function sanitizeRoomName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 30);
}

export function validateRoomName(
  raw: string,
): { ok: true; name: string | null } | { ok: false; error: string } {
  const cleaned = sanitizeRoomName(raw);
  if (cleaned.length === 0) return { ok: true, name: null };
  if (cleaned.length < 1 || cleaned.length > 30)
    return { ok: false, error: "Room name 1-30 chars" };
  if (!ROOM_NAME_RE.test(cleaned))
    return { ok: false, error: "Room name has invalid characters" };
  return { ok: true, name: cleaned };
}

export function isNameTaken(room: Room, name: string, exceptPlayerId?: PlayerId): boolean {
  const lower = name.trim().toLowerCase();
  return room.players.some(
    (p) => p.id !== exceptPlayerId && p.name.trim().toLowerCase() === lower,
  );
}

export function pickRandomLetter(slot: "start" | "end" = "start"): string {
  const letters = slot === "end" ? PICKABLE_END_LETTERS : PICKABLE_START_LETTERS;
  const idx = Math.floor(Math.random() * letters.length);
  return letters[idx] ?? "a";
}

export function selectPickers(room: Room): { start: Player; end: Player } {
  const active = room.players.filter((p) => p.connected && !p.spectator);
  const eligible = active.filter(
    (p) => p.ready || active.every((q) => !q.ready),
  );
  const pool = eligible.length >= 2 ? eligible : active;
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
