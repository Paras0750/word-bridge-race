"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import {
  ArrowLeftIcon,
  CopyIcon,
  CheckIcon,
  Loader2Icon,
  WifiOffIcon,
  RotateCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SERVER_URL, getSocket, reconnectSocket } from "@/lib/socket";
import { useSocketStatus } from "@/lib/useSocketStatus";
import type { PublicRoom, Winner } from "@/lib/types";
import { Lobby } from "@/components/Lobby";
import { Countdown } from "@/components/Countdown";
import { ActiveRound } from "@/components/ActiveRound";
import { Scoreboard } from "@/components/Scoreboard";
import { PickPhase } from "@/components/PickPhase";

const NAME_KEY = "wbr.name";

export interface AttemptEntry {
  id: string;
  playerId: string;
  name: string;
  word: string;
  valid: boolean;
  reason?: string;
  at: number;
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = (params?.roomId ?? "").toUpperCase();

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [slow, setSlow] = useState<boolean>(false);
  const joinedRef = useRef<boolean>(false);
  const lastRoundRef = useRef<number>(0);
  const { status: socketStatus, lastError: socketError } = useSocketStatus();

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
      }
    };
    const onCountdown = (n: number): void => setCountdown(n);
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
      const id = `${Date.now()}-${Math.random()}`;
      setAttempts((prev) => [
        ...prev,
        {
          id,
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
    const onError = (msg: string): void => {
      toast.error(msg);
    };

    socket.on("room_update", onRoomUpdate);
    socket.on("countdown", onCountdown);
    socket.on("invalid_attempt", onInvalid);
    socket.on("winner", onWinner);
    socket.on("round_timeout", onRoundTimeout);
    socket.on("error_msg", onError);

    const tryJoin = (): void => {
      socket.emit("join_room", { roomId, name }, (res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMeId(res.data.playerId);
        setRoom(res.data.room);
      });
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
                <Button variant="outline" onClick={() => reconnectSocket()}>
                  <RotateCwIcon data-icon="inline-start" />
                  Retry
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
                    onClick={() => reconnectSocket()}
                  >
                    <RotateCwIcon data-icon="inline-start" />
                    Retry now
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
        <div className="bg-destructive/10 text-destructive mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/30 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-2">
            <WifiOffIcon className="size-3.5" />
            {socketStatus === "failed"
              ? "Disconnected from server"
              : "Reconnecting…"}
          </span>
          <button
            onClick={() => reconnectSocket()}
            className="hover:underline"
          >
            retry
          </button>
        </div>
      )}
      <header className="mb-5 flex items-center justify-between gap-2 sm:mb-6">
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
        <button
          onClick={copyCode}
          className="bg-card hover:bg-muted inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors"
          title="Copy room code"
        >
          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.2em]">
            Room
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
        <Scoreboard room={room} attempts={attempts} meId={meId} isHost={isHost} />
      )}
    </main>
  );
}
