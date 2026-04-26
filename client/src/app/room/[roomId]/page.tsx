"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import {
  ArrowLeftIcon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  Share2Icon,
  WifiOffIcon,
  RotateCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { sfx } from "@/lib/sound";
import { SERVER_URL, getSocket, reconnectSocket } from "@/lib/socket";
import { useSocketStatus } from "@/lib/useSocketStatus";
import { getOrCreatePlayerId } from "@/lib/identity";
import type { PublicRoom, Winner } from "@/lib/types";
import { Lobby } from "@/components/Lobby";
import { Countdown } from "@/components/Countdown";
import { ActiveRound } from "@/components/ActiveRound";
import { Scoreboard } from "@/components/Scoreboard";
import { PickPhase } from "@/components/PickPhase";
import dynamic from "next/dynamic";
import { PausedView } from "@/components/PausedView";

const GameOver = dynamic(
  () => import("@/components/GameOver").then((m) => m.GameOver),
  { ssr: false },
);

const NAME_KEY = "wbr.name";

export type AttemptEntry =
  | {
      id: string;
      kind: "guess";
      playerId: string;
      name: string;
      word: string;
      valid: boolean;
      reason?: string;
      at: number;
    }
  | {
      id: string;
      kind: "cheat";
      playerId: string;
      name: string;
      penalty: number;
      at: number;
    }
  | {
      id: string;
      kind: "peek";
      playerId: string;
      name: string;
      message: string;
      at: number;
    }
  | {
      id: string;
      kind: "skip";
      playerId: string;
      name: string;
      votes: number;
      total: number;
      at: number;
    }
  | {
      id: string;
      kind: "hivemind";
      playerId: "";
      name: "";
      word: string;
      names: [string, string];
      at: number;
    };

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = (params?.roomId ?? "").toUpperCase();

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [revealWords, setRevealWords] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [slow, setSlow] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const joinedRef = useRef<boolean>(false);
  const lastRoundRef = useRef<number>(0);
  const meIdRef = useRef<string>("");
  const { status: socketStatus, lastError: socketError } = useSocketStatus();

  useEffect(() => {
    meIdRef.current = meId;
  }, [meId]);

  const handleRetry = (): void => {
    setRetrying(true);
    reconnectSocket();
    setTimeout(() => setRetrying(false), 2500);
  };

  useEffect(() => {
    if (socketStatus === "connected") setRetrying(false);
  }, [socketStatus]);

  useEffect(() => {
    const socket = getSocket();
    const name =
      (typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null) ?? "";

    if (!name) {
      router.replace(`/?room=${encodeURIComponent(roomId)}`);
      return;
    }

    const onRoomUpdate = (next: PublicRoom): void => {
      setRoom(next);
      if (next.phase === "lobby") setCountdown(null);
      const ridx = next.round?.index ?? 0;
      if (ridx !== lastRoundRef.current) {
        lastRoundRef.current = ridx;
        setAttempts([]);
        setRevealWords(null);
      }
    };
    const onCountdown = (n: number): void => {
      setCountdown(n);
      if (n === 0) sfx.countdownFinal();
      else if (n <= 3) sfx.countdownBeep();
    };
    const onInvalid = (data: {
      playerId: string;
      name: string;
      word: string;
      reason: string;
    }): void => {
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "guess",
          playerId: data.playerId,
          name: data.name,
          word: data.word,
          valid: false,
          reason: data.reason,
          at: Date.now(),
        },
      ]);
    };
    const onWinner = (w: Winner): void => {
      sfx.ding();
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "guess",
          playerId: w.playerId,
          name: w.name,
          word: w.word,
          valid: true,
          at: Date.now(),
        },
      ]);
      void confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#fafafa", "#a1a1aa", "#52525b"],
        disableForReducedMotion: true,
      });
      if (w.bonus > 0) {
        toast.success(`${w.name} +${w.bonus} streak bonus (${w.streak} in a row!)`);
      }
    };
    const onRoundTimeout = (): void => {
      toast.warning("Time's up — no one solved it!");
    };
    const onRoundSkipped = (data: {
      start: string;
      end: string;
      reason: "no_words" | "voted";
    }): void => {
      if (data.reason === "no_words") {
        toast.warning(
          `No words bridge ${data.start.toUpperCase()} and ${data.end.toUpperCase()} — skipping round.`,
        );
        return;
      }
      toast.warning("Everyone voted to skip this round.");
    };
    const onCheaterCaught = (data: {
      playerId: string;
      name: string;
      penalty: number;
    }): void => {
      sfx.buzz();
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "cheat",
          playerId: data.playerId,
          name: data.name,
          penalty: data.penalty,
          at: Date.now(),
        },
      ]);
      if (data.playerId === meIdRef.current) {
        toast.error(`🚨 Caught pasting! −${data.penalty} pts`);
      } else {
        toast.error(`🚨 ${data.name} got caught pasting · −${data.penalty} pts`);
      }
    };
    const onPeekAnnounce = (data: {
      playerId: string;
      name: string;
      message: string;
    }): void => {
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "peek",
          playerId: data.playerId,
          name: data.name,
          message: data.message,
          at: Date.now(),
        },
      ]);
      if (data.playerId !== meIdRef.current) toast(data.message);
    };
    const onWordsReveal = (data: { words: string[] }): void => {
      setRevealWords(data.words);
    };
    const onGamePaused = (): void => {
      toast.warning("Game paused — need 2 active players to continue");
    };
    const onGameResumed = (): void => {
      toast.success("And we're back");
    };
    const onGameOver = (): void => {
      sfx.gameOver();
      void confetti({
        particleCount: 120,
        spread: 90,
        startVelocity: 50,
        origin: { x: 0.5, y: 0.4 },
        colors: ["#fafafa", "#facc15", "#a1a1aa"],
        disableForReducedMotion: true,
      });
    };
    const onHivemind = (data: {
      word: string;
      names: [string, string];
    }): void => {
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "hivemind",
          playerId: "",
          name: "",
          word: data.word,
          names: data.names,
          at: Date.now(),
        },
      ]);
      toast.info(
        `🧠 Hivemind: ${data.names[0]} & ${data.names[1]} both tried "${data.word}"`,
      );
    };
    const onSkipVote = (data: {
      playerId: string;
      name: string;
      votes: number;
      total: number;
    }): void => {
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
          kind: "skip",
          playerId: data.playerId,
          name: data.name,
          votes: data.votes,
          total: data.total,
          at: Date.now(),
        },
      ]);
    };
    const onError = (msg: string): void => {
      toast.error(msg);
    };

    socket.on("room_update", onRoomUpdate);
    socket.on("countdown", onCountdown);
    socket.on("invalid_attempt", onInvalid);
    socket.on("winner", onWinner);
    socket.on("round_timeout", onRoundTimeout);
    socket.on("round_skipped", onRoundSkipped);
    socket.on("cheater_caught", onCheaterCaught);
    socket.on("peek_announce", onPeekAnnounce);
    socket.on("skip_vote", onSkipVote);
    socket.on("hivemind", onHivemind);
    socket.on("round_words_reveal", onWordsReveal);
    socket.on("game_over", onGameOver);
    socket.on("game_paused", onGamePaused);
    socket.on("game_resumed", onGameResumed);
    socket.on("error_msg", onError);

    const tryJoin = (): void => {
      socket.emit(
        "join_room",
        { roomId, name, playerId: getOrCreatePlayerId() },
        (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setMeId(res.data.playerId);
          setRoom(res.data.room);
        },
      );
    };

    const onConnect = (): void => {
      tryJoin();
    };

    if (!joinedRef.current) {
      joinedRef.current = true;
      if (socket.connected) tryJoin();
    }
    socket.on("connect", onConnect);

    return () => {
      socket.off("room_update", onRoomUpdate);
      socket.off("countdown", onCountdown);
      socket.off("invalid_attempt", onInvalid);
      socket.off("winner", onWinner);
      socket.off("round_timeout", onRoundTimeout);
      socket.off("round_skipped", onRoundSkipped);
      socket.off("cheater_caught", onCheaterCaught);
      socket.off("peek_announce", onPeekAnnounce);
      socket.off("skip_vote", onSkipVote);
      socket.off("hivemind", onHivemind);
      socket.off("round_words_reveal", onWordsReveal);
      socket.off("game_over", onGameOver);
      socket.off("game_paused", onGamePaused);
      socket.off("game_resumed", onGameResumed);
      socket.off("error_msg", onError);
      socket.off("connect", onConnect);
    };
  }, [roomId, router]);

  const me = useMemo(() => room?.players.find((p) => p.id === meId) ?? null, [room, meId]);
  const isHost = me?.isHost ?? false;

  useEffect(() => {
    if (room) return;
    setSlow(false);
    const id = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(id);
  }, [room, socketStatus]);

  const copyCode = async (): Promise<void> => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const toggleSpectate = (): void => {
    if (!me || !room) return;
    getSocket().emit(
      "set_spectator",
      { roomId: room.id, spectator: !me.spectator },
      () => undefined,
    );
  };

  const inviteUrl = (): string => {
    if (typeof window === "undefined" || !room) return "";
    return `${window.location.origin}/?room=${room.id}`;
  };

  const shareInvite = async (): Promise<void> => {
    if (!room) return;
    const url = inviteUrl();
    const text = room.name
      ? `Join "${room.name}" on Word Bridge Race`
      : `Join my Word Bridge Race game · ${room.id}`;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title: "Word Bridge Race", text, url });
        return;
      } catch {
        // user cancelled or share failed → fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  if (error && !room) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4">
        <div className="bg-card rounded-lg border p-8 text-center">
          <h2 className="text-xl font-semibold">Couldn't join</h2>
          <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          <p className="text-muted-foreground mt-1 font-mono text-xs">{roomId}</p>
          <Button
            className="mt-6"
            onClick={() => router.push(`/?room=${encodeURIComponent(roomId)}`)}
          >
            Back to home
          </Button>
        </div>
      </main>
    );
  }

  if (!room) {
    const isFailed = socketStatus === "failed";
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4">
        <div className="bg-card w-full rounded-lg border p-8 text-center">
          {isFailed ? (
            <>
              <WifiOffIcon className="text-destructive mx-auto size-8" />
              <h2 className="mt-4 text-lg font-semibold">Can't reach the server</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Tried{" "}
                <code className="text-foreground font-mono text-xs">{SERVER_URL}</code>{" "}
                a few times and got no response.
              </p>
              {socketError && (
                <p className="text-muted-foreground/80 mt-1 font-mono text-[10px]">
                  {socketError}
                </p>
              )}
              <p className="text-muted-foreground/80 mt-4 text-xs">
                Make sure the server is running:
                <br />
                <code className="text-foreground font-mono text-xs">
                  cd server &amp;&amp; bun run dev
                </code>
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <RotateCwIcon data-icon="inline-start" />
                  )}
                  {retrying ? "Retrying…" : "Retry"}
                </Button>
                <Button
                  onClick={() =>
                    router.push(`/?room=${encodeURIComponent(roomId)}`)
                  }
                >
                  Back to home
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2Icon className="text-muted-foreground mx-auto size-6 animate-spin" />
              <h2 className="mt-4 text-base font-medium">
                {socketStatus === "reconnecting" ? "Reconnecting…" : "Connecting…"}
              </h2>
              <p className="text-muted-foreground mt-2 font-mono text-xs">
                Room {roomId}
              </p>
              {slow && (
                <>
                  <p className="text-muted-foreground mt-4 text-xs">
                    Taking longer than usual. Server may be waking up.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleRetry}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <Loader2Icon
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <RotateCwIcon data-icon="inline-start" />
                    )}
                    {retrying ? "Retrying…" : "Retry now"}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-4 sm:py-6">
      {(socketStatus === "reconnecting" || socketStatus === "failed") && (
        <div className="bg-destructive/10 text-destructive border-destructive/30 mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-2">
            {socketStatus === "reconnecting" || retrying ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <WifiOffIcon className="size-3.5" />
            )}
            {socketStatus === "failed" && !retrying
              ? "Disconnected from server"
              : "Reconnecting…"}
          </span>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="disabled:opacity-50 hover:underline"
          >
            {retrying ? "retrying…" : "retry"}
          </button>
        </div>
      )}
      <header className="mb-5 flex items-center justify-between gap-2 sm:mb-6">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              getSocket().emit("leave_room", { roomId }, () => {
                router.push("/");
              });
            }}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Leave
          </Button>
          {me && room.phase !== "game_over" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSpectate}
              title={
                me.spectator
                  ? "Stop watching, jump in"
                  : "Sit this one out, just watch"
              }
            >
              {me.spectator ? (
                <EyeOffIcon data-icon="inline-start" />
              ) : (
                <EyeIcon data-icon="inline-start" />
              )}
              <span className="hidden sm:inline">
                {me.spectator ? "Play" : "Watch"}
              </span>
            </Button>
          )}
          <SoundToggle />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyCode}
            className="bg-card hover:bg-muted inline-flex max-w-[160px] items-center gap-2 truncate rounded-md border px-2.5 py-1.5 transition-colors sm:max-w-none"
            title="Copy room code"
          >
            {room.name && (
              <span className="text-foreground truncate text-sm font-medium">
                {room.name}
              </span>
            )}
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
              {room.name ? "·" : "Room"}
            </span>
            <span className="font-mono text-sm font-semibold tracking-[0.25em]">
              {room.id}
            </span>
            {copied ? (
              <CheckIcon className="size-3.5 text-[var(--success)]" />
            ) : (
              <CopyIcon className="text-muted-foreground size-3.5" />
            )}
          </button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void shareInvite()}
            title="Share invite link"
            aria-label="Share invite link"
          >
            <Share2Icon className="size-4" />
          </Button>
        </div>
      </header>

      {room.phase === "lobby" && <Lobby room={room} meId={meId} isHost={isHost} />}

      {(room.phase === "pick_start" || room.phase === "pick_end") && (
        <PickPhase room={room} meId={meId} />
      )}

      {room.phase === "countdown" && countdown !== null && countdown > 0 && (
        <Countdown n={countdown} />
      )}

      {(room.phase === "active" ||
        (room.phase === "countdown" && countdown !== null && countdown === 0)) && (
        <ActiveRound room={room} meId={meId} attempts={attempts} />
      )}

      {room.phase === "scoreboard" && (
        <Scoreboard
          room={room}
          attempts={attempts}
          meId={meId}
          isHost={isHost}
          revealWords={revealWords}
        />
      )}

      {room.phase === "paused" && (
        <PausedView room={room} meId={meId} isHost={isHost} />
      )}

      {room.phase === "game_over" && (
        <GameOver room={room} meId={meId} isHost={isHost} />
      )}
    </main>
  );
}
