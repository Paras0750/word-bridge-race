"use client";

import { getSocket } from "@/lib/socket";
import type { PublicRoom, Winner } from "@/lib/types";

interface Props {
  room: PublicRoom;
  winner: Winner;
  isHost: boolean;
}

export function WinnerView({ room, winner, isHost }: Props) {
  const reset = (): void => {
    getSocket().emit("reset_round", { roomId: room.id }, () => undefined);
  };

  return (
    <div className="grid gap-6">
      <section className="panel p-8 text-center shadow-glow">
        <div className="label text-success">Winner</div>
        <div className="mt-3 text-3xl font-semibold sm:text-4xl">{winner.name}</div>
        <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-line bg-panel2 px-5 py-3 font-mono text-xl">
          <span className="text-accent">{room.round?.start}</span>
          <span className="text-text">{winner.word}</span>
          <span className="text-accent2">{room.round?.end}</span>
        </div>
        <div className="mt-4 text-sm text-muted">
          {(winner.tookMs / 1000).toFixed(2)}s
        </div>

        {isHost ? (
          <button className="btn-primary mt-6 px-6" onClick={reset}>
            Play again
          </button>
        ) : (
          <div className="mt-6 text-xs text-muted">Waiting for host to start a new round…</div>
        )}
      </section>
    </div>
  );
}
