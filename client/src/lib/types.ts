export type PlayerId = string;
export type RoomId = string;

export interface Player {
  id: PlayerId;
  name: string;
  isHost: boolean;
}

export type RoomPhase = "lobby" | "countdown" | "active" | "finished";

export interface Constraints {
  start: string;
  end: string;
}

export interface Winner {
  playerId: PlayerId;
  name: string;
  word: string;
  tookMs: number;
}

export interface PublicRoom {
  id: RoomId;
  hostId: PlayerId;
  players: Player[];
  phase: RoomPhase;
  constraints: Constraints;
  round: {
    start: string;
    end: string;
    startedAt: number | null;
    winner: Winner | null;
  } | null;
}

export interface ClientToServerEvents {
  create_room: (
    payload: { name: string },
    ack: (res: AckResult<{ roomId: RoomId; playerId: PlayerId }>) => void,
  ) => void;
  join_room: (
    payload: { roomId: RoomId; name: string },
    ack: (res: AckResult<{ playerId: PlayerId; room: PublicRoom }>) => void,
  ) => void;
  leave_room: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  set_constraints: (
    payload: { roomId: RoomId; start: string; end: string },
    ack: (res: AckResult<null>) => void,
  ) => void;
  start_round: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  reset_round: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  submit_word: (
    payload: { roomId: RoomId; word: string },
    ack: (res: AckResult<{ accepted: boolean; reason?: string }>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  room_update: (room: PublicRoom) => void;
  countdown: (n: number) => void;
  reveal_constraints: (data: { start: string; end: string; startedAt: number }) => void;
  round_active: () => void;
  invalid_attempt: (data: { playerId: PlayerId; name: string; word: string; reason: string }) => void;
  winner: (data: Winner) => void;
  error_msg: (msg: string) => void;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };
