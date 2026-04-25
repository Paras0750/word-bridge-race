export type PlayerId = string;
export type RoomId = string;

export interface Player {
  id: PlayerId;
  name: string;
  isHost: boolean;
  ready: boolean;
  score: number;
  streak: number;
  bestMs: number | null;
}

export type RoomPhase =
  | "lobby"
  | "pick_start"
  | "pick_end"
  | "countdown"
  | "active"
  | "scoreboard";

export interface PickerSlot {
  playerId: PlayerId;
  name: string;
  deadlineMs: number;
}

export interface Winner {
  playerId: PlayerId;
  name: string;
  word: string;
  tookMs: number;
  streak: number;
  bonus: number;
}

export interface PublicRound {
  index: number;
  pickers: { start: PickerSlot | null; end: PickerSlot | null };
  start: string;
  end: string;
  startedAt: number | null;
  endsAt: number | null;
  winner: Winner | null;
  timedOut: boolean;
  skipped: boolean;
  skipReason: "no_words" | "voted" | null;
  possibleWordCount: number;
  skipVoteIds: PlayerId[];
}

export interface RoomSettings {
  countdownSeconds: number;
  pickTimeoutSeconds: number;
  scoreboardSeconds: number;
  roundMaxSeconds: number;
}

export const SETTINGS_BOUNDS = {
  countdownSeconds: { min: 1, max: 10, default: 5 },
  pickTimeoutSeconds: { min: 5, max: 60, default: 15 },
  scoreboardSeconds: { min: 3, max: 30, default: 10 },
  roundMaxSeconds: { min: 15, max: 300, default: 90 },
} as const;

export interface PublicRoom {
  id: RoomId;
  hostId: PlayerId;
  players: Player[];
  phase: RoomPhase;
  round: PublicRound | null;
  roundsPlayed: number;
  usedWordsCount: number;
  settings: RoomSettings;
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
  set_ready: (
    payload: { roomId: RoomId; ready: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void;
  start_round: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  set_settings: (
    payload: { roomId: RoomId; settings: Partial<RoomSettings> },
    ack: (res: AckResult<{ settings: RoomSettings }>) => void,
  ) => void;
  pick_letter: (
    payload: { roomId: RoomId; slot: "start" | "end"; letter: string },
    ack: (res: AckResult<null>) => void,
  ) => void;
  submit_word: (
    payload: { roomId: RoomId; word: string; pasted?: boolean },
    ack: (res: AckResult<{ accepted: boolean; reason?: string }>) => void,
  ) => void;
  peeked: (
    payload: { roomId: RoomId; kind: "tab" | "mouse" },
    ack: (res: AckResult<null>) => void,
  ) => void;
  vote_skip: (
    payload: { roomId: RoomId },
    ack: (res: AckResult<{ votes: number; total: number }>) => void,
  ) => void;
  end_game: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
}

export interface ServerToClientEvents {
  room_update: (room: PublicRoom) => void;
  countdown: (n: number) => void;
  reveal_constraints: (data: {
    start: string;
    end: string;
    startedAt: number;
    endsAt: number;
  }) => void;
  round_active: () => void;
  invalid_attempt: (data: { playerId: PlayerId; name: string; word: string; reason: string }) => void;
  winner: (data: Winner) => void;
  round_timeout: (data: { roundIndex: number }) => void;
  round_skipped: (data: {
    roundIndex: number;
    start: string;
    end: string;
    reason: "no_words" | "voted";
  }) => void;
  skip_vote: (data: {
    playerId: PlayerId;
    name: string;
    votes: number;
    total: number;
  }) => void;
  cheater_caught: (data: {
    playerId: PlayerId;
    name: string;
    penalty: number;
    scoreAfter: number;
  }) => void;
  peek_announce: (data: {
    playerId: PlayerId;
    name: string;
    message: string;
    kind: "tab" | "mouse";
  }) => void;
  error_msg: (msg: string) => void;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const PICKABLE_LETTERS = "abcdefghijklmnoprstuvwy".split("");
