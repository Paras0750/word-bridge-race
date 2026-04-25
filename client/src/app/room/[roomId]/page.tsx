"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { PublicRoom, Winner } from "@/lib/types";
import { Lobby } from "@/components/Lobby";
import { Countdown } from "@/components/Countdown";
import { ActiveRound } from "@/components/ActiveRound";
import { WinnerView } from "@/components/WinnerView";

const NAME_KEY = "wbr.name";

interface AttemptToast {
  id: string;
  name: string;
  word: string;
  reason: string;
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = (params?.roomId ?? "").toUpperCase();

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [toasts, setToasts] = useState<AttemptToast[]>([]);
  const [error, setError] = useState<string>("");
  const joinedRef = useRef<boolean>(false);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    const socket = getSocket();
    const name =
      (typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null) ?? "";

    if (!name) {
      router.replace("/");
      return;
    }

    const onRoomUpdate = (next: PublicRoom): void => {
      setRoom(next);
      if (next.phase === "lobby") {
        setCountdown(null);
        setWinner(null);
      }
    };
    const onCountdown = (n: number): void => setCountdown(n);
    const onWinner = (w: Winner): void => setWinner(w);
    const onInvalid = (data: { name: string; word: string; reason: string }): void => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-3), { id, ...data }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2000);
    };

    socket.on("room_update", onRoomUpdate);
    socket.on("countdown", onCountdown);
    socket.on("winner", onWinner);
    socket.on("invalid_attempt", onInvalid);

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

    if (socket.connected) tryJoin();
    else socket.once("connect", tryJoin);

    return () => {
      socket.off("room_update", onRoomUpdate);
      socket.off("countdown", onCountdown);
      socket.off("winner", onWinner);
      socket.off("invalid_attempt", onInvalid);
    };
  }, [roomId, router]);

  const me = useMemo(() => room?.players.find((p) => p.id === meId) ?? null, [room, meId]);
  const isHost = me?.isHost ?? false;

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5">
        <div className="panel p-8 text-center">
          <h2 className="text-xl font-semibold">Couldn't join</h2>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button className="btn-primary mt-6" onClick={() => router.push("/")}>
            Back to home
          </button>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5">
        <div className="text-sm text-muted">Connecting…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <header className="mb-6 flex items-center justify-between">
        <button
          className="text-xs uppercase tracking-[0.25em] text-muted hover:text-text"
          onClick={() => {
            getSocket().emit("leave_room", { roomId }, () => {
              router.push("/");
            });
          }}
        >
          ← Leave
        </button>
        <div className="flex items-center gap-3">
          <span className="label">Room</span>
          <code className="rounded-lg border border-line bg-panel2 px-3 py-1.5 font-mono text-lg tracking-[0.4em] text-accent">
            {room.id}
          </code>
          <button
            className="chip"
            onClick={() => {
              if (typeof navigator !== "undefined") {
                void navigator.clipboard.writeText(room.id);
              }
            }}
            title="Copy code"
          >
            copy
          </button>
        </div>
      </header>

      {room.phase === "lobby" && (
        <Lobby room={room} meId={meId} isHost={isHost} />
      )}

      {room.phase === "countdown" && countdown !== null && countdown > 0 && (
        <Countdown n={countdown} />
      )}

      {(room.phase === "active" ||
        (room.phase === "countdown" && countdown !== null && countdown === 0)) && (
        <ActiveRound room={room} meId={meId} />
      )}

      {room.phase === "finished" && winner && (
        <WinnerView room={room} winner={winner} isHost={isHost} />
      )}

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-xl border border-danger/30 bg-panel2/95 px-4 py-2 text-sm shadow-lg backdrop-blur"
          >
            <span className="font-medium text-danger">{t.name}</span>
            <span className="text-muted"> tried </span>
            <span className="font-mono">{t.word || "—"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
