"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";

interface Props {
  room: PublicRoom;
  meId: string;
  isHost: boolean;
}

export function Lobby({ room, meId, isHost }: Props) {
  const [start, setStart] = useState<string>(room.constraints.start);
  const [end, setEnd] = useState<string>(room.constraints.end);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    setStart(room.constraints.start);
    setEnd(room.constraints.end);
  }, [room.constraints.start, room.constraints.end]);

  const setConstraints = (): void => {
    setError("");
    const socket = getSocket();
    socket.emit(
      "set_constraints",
      { roomId: room.id, start: start.trim().toLowerCase(), end: end.trim().toLowerCase() },
      (res) => {
        if (!res.ok) setError(res.error);
      },
    );
  };

  const startRound = (): void => {
    setError("");
    setBusy(true);
    const socket = getSocket();
    socket.emit("start_round", { roomId: room.id }, (res) => {
      setBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
      <section className="panel p-5">
        <h2 className="label">Players · {room.players.length}/10</h2>
        <ul className="mt-3 space-y-2">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3 py-2.5"
            >
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="font-medium">{p.name}</span>
                {p.id === meId && <span className="chip">you</span>}
              </span>
              {p.isHost && <span className="chip text-accent">host</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5">
        <h2 className="label">Round constraints</h2>
        <p className="mt-1 text-xs text-muted">
          {isHost ? "Set the start and end. They reveal at countdown 0." : "Waiting for the host to set up the round."}
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="label">Starts with</label>
            <input
              className="input mt-2 font-mono uppercase tracking-widest disabled:opacity-60"
              value={start}
              maxLength={10}
              disabled={!isHost}
              onChange={(e) => setStart(e.target.value.replace(/[^a-zA-Z]/g, ""))}
              placeholder="P"
            />
          </div>
          <div>
            <label className="label">Ends with</label>
            <input
              className="input mt-2 font-mono uppercase tracking-widest disabled:opacity-60"
              value={end}
              maxLength={10}
              disabled={!isHost}
              onChange={(e) => setEnd(e.target.value.replace(/[^a-zA-Z]/g, ""))}
              placeholder="D"
            />
          </div>

          {isHost && (
            <div className="mt-2 grid gap-2">
              <button className="btn-ghost" onClick={setConstraints} disabled={!start || !end}>
                Save constraints
              </button>
              <button
                className="btn-primary h-12"
                onClick={startRound}
                disabled={busy || !room.constraints.start || !room.constraints.end}
              >
                Start round
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          {!isHost && (room.constraints.start || room.constraints.end) && (
            <div className="mt-2 text-xs text-muted">
              Host has{" "}
              {room.constraints.start && room.constraints.end
                ? "set the constraints. Locked in."
                : "started setting up…"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
