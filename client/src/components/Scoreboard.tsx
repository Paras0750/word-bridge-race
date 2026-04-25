"use client";

import { useEffect, useState } from "react";
import { CrownIcon, FlameIcon, TimerOffIcon, TrophyIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";
import { AttemptsLog } from "./AttemptsLog";
import type { AttemptEntry } from "@/app/room/[roomId]/page";

interface Props {
  room: PublicRoom;
  attempts: AttemptEntry[];
  meId: string;
  isHost: boolean;
}

export function Scoreboard({ room, attempts, meId, isHost }: Props) {
  const winner = room.round?.winner ?? null;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;

  const [secondsLeft, setSecondsLeft] = useState<number>(room.settings.scoreboardSeconds);
  useEffect(() => {
    setSecondsLeft(room.settings.scoreboardSeconds);
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [room.round?.index, room.settings.scoreboardSeconds]);

  const endGame = (): void => {
    getSocket().emit("end_game", { roomId: room.id }, () => undefined);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card className="text-center">
          <CardHeader className="items-center">
            {winner ? (
              <>
                <Badge
                  variant="outline"
                  className="border-[var(--success)]/40 rounded text-[var(--success)]"
                >
                  Round {room.round?.index} winner
                </Badge>
                <CardTitle className="mt-3 flex flex-wrap items-center justify-center gap-3 text-2xl sm:text-3xl">
                  <TrophyIcon className="size-6 text-[var(--warning)]" />
                  <span>{winner.name}</span>
                </CardTitle>
                {winner.streak >= 2 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs text-orange-400">
                    <FlameIcon className="size-3.5" />
                    {winner.streak}× streak
                    {winner.bonus > 0 && (
                      <span className="ml-1 font-medium">+{winner.bonus} bonus</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <Badge
                  variant="outline"
                  className="gap-1.5 border-[var(--warning)]/40 rounded text-[var(--warning)]"
                >
                  <TimerOffIcon className="size-3.5" />
                  Time's up
                </Badge>
                <CardTitle className="mt-3 text-2xl sm:text-3xl">
                  Round {room.round?.index} — no one solved it
                </CardTitle>
              </>
            )}
          </CardHeader>
          <CardContent>
            {winner ? (
              <>
                <div className="bg-muted mx-auto inline-flex flex-wrap items-center justify-center gap-2 rounded-md border px-4 py-2.5 font-mono text-xl sm:text-2xl">
                  <span className="text-muted-foreground uppercase">{room.round?.start}</span>
                  <span className="text-foreground break-all">{winner.word}</span>
                  <span className="text-muted-foreground uppercase">{room.round?.end}</span>
                </div>
                <p className="text-muted-foreground mt-3 text-sm tabular-nums">
                  {(winner.tookMs / 1000).toFixed(2)}s · +{10 + winner.bonus} pts
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-mono uppercase">
                  {room.round?.start}
                </span>
                <span className="mx-2">…</span>
                <span className="text-foreground font-mono uppercase">
                  {room.round?.end}
                </span>{" "}
                stumped everyone.
              </p>
            )}

            <div className="mx-auto mt-5 w-full max-w-[200px]">
              <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full transition-[width] duration-1000 ease-linear"
                  style={{
                    width: `${(secondsLeft / room.settings.scoreboardSeconds) * 100}%`,
                  }}
                />
              </div>
              <p className="text-muted-foreground mt-1.5 font-mono text-[10px] tabular-nums">
                Next round in {secondsLeft}s
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5">
              {sorted.map((p, idx) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2.5",
                    p.score === top && top > 0
                      ? "border-foreground/30 bg-muted"
                      : "bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold",
                      idx === 0 && top > 0
                        ? "bg-[var(--warning)]/20 text-[var(--warning)]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    {p.id === meId && (
                      <Badge variant="outline" className="rounded text-[10px]">
                        you
                      </Badge>
                    )}
                    {p.isHost && (
                      <CrownIcon className="size-3.5 shrink-0 text-[var(--warning)]" />
                    )}
                    {p.streak >= 2 && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-orange-500/40 rounded text-[10px] text-orange-400"
                      >
                        <FlameIcon className="size-3" />
                        {p.streak}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm tabular-nums">
                      {p.score}
                      <span className="text-muted-foreground text-xs"> pts</span>
                    </span>
                    {p.bestMs !== null && (
                      <span className="text-muted-foreground block font-mono text-[10px] tabular-nums">
                        best {(p.bestMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {isHost && (
              <Button variant="outline" className="mt-4 w-full" onClick={endGame}>
                End game · back to lobby
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <AttemptsLog attempts={attempts} meId={meId} emptyHint="No guesses this round." />
    </div>
  );
}
