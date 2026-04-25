import type { Player, PlayerId, PublicRoom, Room, RoomId } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomId(existing: Set<RoomId>): RoomId {
  for (let attempt = 0; attempt < 50; attempt++) {
    let id = "";
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * ALPHABET.length);
      id += ALPHABET[idx];
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
    constraints: { start: "", end: "" },
    round: null,
    createdAt: Date.now(),
    countdownTimer: null,
    emptySinceMs: null,
  };
}

export function toPublicRoom(room: Room): PublicRoom {
  const round = room.round
    ? {
        start: room.phase === "active" || room.phase === "finished" ? room.round.start : "",
        end: room.phase === "active" || room.phase === "finished" ? room.round.end : "",
        startedAt: room.round.startedAt,
        winner: room.round.winner,
      }
    : null;

  return {
    id: room.id,
    hostId: room.hostId,
    players: room.players,
    phase: room.phase,
    constraints:
      room.phase === "active" || room.phase === "finished"
        ? room.constraints
        : { start: "", end: "" },
    round,
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

export function sanitizeConstraint(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 10);
}
