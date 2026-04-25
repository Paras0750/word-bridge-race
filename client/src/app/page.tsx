"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

const NAME_KEY = "wbr.name";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
    if (stored) setName(stored);
  }, []);

  const persistName = (value: string): void => {
    setName(value);
    if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, value);
  };

  const handleCreate = (): void => {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    setBusy(true);
    setError("");
    const socket = getSocket();
    socket.emit("create_room", { name: name.trim() }, (res) => {
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/room/${res.data.roomId}`);
    });
  };

  const handleJoin = (): void => {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    if (!roomCode.trim()) {
      setError("Enter a room code");
      return;
    }
    setBusy(true);
    setError("");
    const socket = getSocket();
    socket.emit(
      "join_room",
      { roomId: roomCode.trim().toUpperCase(), name: name.trim() },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/room/${res.data.room.id}`);
      },
    );
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-stretch justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Word Bridge Race
        </div>
        <h1 className="text-balance bg-gradient-to-br from-text to-muted bg-clip-text text-4xl font-semibold leading-tight text-transparent sm:text-5xl">
          Bridge two letters. <br />
          <span className="text-accent">Fastest word wins.</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          Host sets a start and end. Everyone races to type a real word that fits.
        </p>
      </div>

      <div className="panel p-6 shadow-glow">
        <label className="label">Your name</label>
        <input
          className="input mt-2"
          value={name}
          onChange={(e) => persistName(e.target.value)}
          placeholder="e.g. Paras"
          maxLength={20}
        />

        <div className="my-6 h-px bg-line" />

        <div className="grid gap-4">
          <button
            className="btn-primary h-12 text-base"
            onClick={handleCreate}
            disabled={busy}
          >
            Create room
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-line" />
            or join an existing
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono uppercase tracking-[0.4em]"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ROOM"
              maxLength={6}
            />
            <button className="btn-ghost h-12 px-6" onClick={handleJoin} disabled={busy}>
              Join
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        2–10 players · real-time · no signup
      </p>
    </main>
  );
}
