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
  connected: boolean;
  disconnectedAt: number | null;
  spectator: boolean;
}

export type RoomPhase =
  | "lobby"
  | "pick_start"
  | "pick_end"
  | "countdown"
  | "active"
  | "scoreboard"
  | "paused"
  | "game_over";

export interface Constraints {
  start: string;
  end: string;
}

export type WordListId = "dictionary" | "pets" | "atlas" | "coding";

export const WORD_LIST_IDS: WordListId[] = ["dictionary", "pets", "atlas", "coding"];

export const WORD_LIST_META: Record<
  WordListId,
  { label: string; hint: string; notFoundLabel: string; detail?: string }
> = {
  dictionary: {
    label: "Dictionary",
    hint: "Any real English word",
    notFoundLabel: "Not in the dictionary.",
  },
  pets: {
    label: "Pets",
    hint: "Animal & pet names",
    notFoundLabel: "Not a known pet or animal.",
  },
  atlas: {
    label: "Atlas",
    hint: "Countries & cities",
    notFoundLabel: "Not a known country or city.",
  },
  coding: {
    label: "Coding",
    hint: "Programming terms & tools",
    notFoundLabel: "Not a known coding term.",
  },
};

export interface RoomSettings {
  wordListId: WordListId;
  countdownSeconds: number;
  pickTimeoutSeconds: number;
  scoreboardSeconds: number;
  roundMaxSeconds: number;
  maxRounds: number;
}

export const SETTINGS_BOUNDS = {
  countdownSeconds: { min: 1, max: 10, default: 5 },
  pickTimeoutSeconds: { min: 5, max: 60, default: 15 },
  scoreboardSeconds: { min: 3, max: 30, default: 10 },
  roundMaxSeconds: { min: 15, max: 300, default: 90 },
  maxRounds: { min: 5, max: 50, default: 20 },
} as const;

export interface PickerSlot {
  playerId: PlayerId;
  name: string;
  deadlineMs: number;
}

export interface RoundWinner {
  playerId: PlayerId;
  name: string;
  word: string;
  tookMs: number;
  streak: number;
  bonus: number;
}

export interface Round {
  index: number;
  pickers: { start: PickerSlot | null; end: PickerSlot | null };
  start: string;
  end: string;
  startedAt: number | null;
  endsAt: number | null;
  winner: RoundWinner | null;
  timedOut: boolean;
  skipped: boolean;
  skipReason: "no_words" | "voted" | null;
  possibleWordCount: number;
  cheaters: Set<PlayerId>;
  skipVotes: Set<PlayerId>;
  lastInvalid: { word: string; playerId: PlayerId; name: string; at: number } | null;
}

export interface RoundHistoryEntry {
  index: number;
  start: string;
  end: string;
  winnerId: PlayerId | null;
  winnerName: string | null;
  word: string | null;
  tookMs: number | null;
  cheaterIds: PlayerId[];
  skipped: boolean;
  skipReason: "no_words" | "voted" | null;
  timedOut: boolean;
  possibleWordCount: number;
  scoresAfter: Array<{ id: PlayerId; score: number }>;
}

export interface Room {
  id: RoomId;
  hostId: PlayerId;
  players: Player[];
  phase: RoomPhase;
  round: Round | null;
  roundsPlayed: number;
  usedWords: Set<string>;
  recentPickers: PlayerId[];
  settings: RoomSettings;
  pickTimer: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setInterval> | null;
  scoreboardTimer: ReturnType<typeof setTimeout> | null;
  roundTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
  emptySinceMs: number | null;
  name: string | null;
  roundHistory: RoundHistoryEntry[];
  gameStartedAt: number | null;
  gameEndedAt: number | null;
}

export interface PublicRound {
  index: number;
  pickers: { start: PickerSlot | null; end: PickerSlot | null };
  start: string;
  end: string;
  startedAt: number | null;
  endsAt: number | null;
  winner: RoundWinner | null;
  timedOut: boolean;
  skipped: boolean;
  skipReason: "no_words" | "voted" | null;
  possibleWordCount: number;
  skipVoteIds: PlayerId[];
  pickableLetters: string[];
}

export interface PublicRoom {
  id: RoomId;
  name: string | null;
  hostId: PlayerId;
  players: Player[];
  phase: RoomPhase;
  round: PublicRound | null;
  roundsPlayed: number;
  usedWordsCount: number;
  settings: RoomSettings;
  roundHistory: RoundHistoryEntry[];
  gameStartedAt: number | null;
  gameEndedAt: number | null;
}

export interface ClientToServerEvents {
  create_room: (
    payload: { name: string; playerId?: PlayerId },
    ack: (res: AckResult<{ roomId: RoomId; playerId: PlayerId }>) => void,
  ) => void;
  join_room: (
    payload: { roomId: RoomId; name: string; playerId?: PlayerId },
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
    payload: { roomId: RoomId; kind: "tab" | "mouse" | "resize" },
    ack: (res: AckResult<null>) => void,
  ) => void;
  vote_skip: (
    payload: { roomId: RoomId },
    ack: (res: AckResult<{ votes: number; total: number }>) => void,
  ) => void;
  end_game: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  new_game: (payload: { roomId: RoomId }, ack: (res: AckResult<null>) => void) => void;
  transfer_host: (
    payload: { roomId: RoomId; toPlayerId: PlayerId },
    ack: (res: AckResult<null>) => void,
  ) => void;
  set_room_name: (
    payload: { roomId: RoomId; name: string },
    ack: (res: AckResult<{ name: string | null }>) => void,
  ) => void;
  set_spectator: (
    payload: { roomId: RoomId; spectator: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void;
  resume_game: (
    payload: { roomId: RoomId },
    ack: (res: AckResult<null>) => void,
  ) => void;
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
  hivemind: (data: {
    word: string;
    names: [string, string];
  }) => void;
  winner: (data: RoundWinner) => void;
  round_timeout: (data: { roundIndex: number }) => void;
  round_skipped: (data: {
    roundIndex: number;
    start: string;
    end: string;
    reason: "no_words" | "voted";
  }) => void;
  round_words_reveal: (data: {
    roundIndex: number;
    words: string[];
  }) => void;
  game_over: (data: {
    rounds: number;
    history: RoundHistoryEntry[];
  }) => void;
  game_paused: (data: { reason: "not_enough_players" }) => void;
  game_resumed: () => void;
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
    kind: "tab" | "mouse" | "resize";
  }) => void;
  error_msg: (msg: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId: PlayerId;
  roomId: RoomId | null;
  name: string;
}

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };
