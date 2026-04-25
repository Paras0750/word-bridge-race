"use client";

import { useState } from "react";
import { CheckIcon, CrownIcon, FlameIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  room: PublicRoom;
  meId: string;
  isHost: boolean;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function Lobby({ room, meId, isHost }: Props) {
  const [error, setError] = useState<string>("");

  const me = room.players.find((p) => p.id === meId);
  const allReady =
    room.players.length >= 2 && room.players.every((p) => p.ready);
  const readyCount = room.players.filter((p) => p.ready).length;
  const readyPct = (readyCount / Math.max(1, room.players.length)) * 100;

  const toggleReady = (): void => {
    if (!me) return;
    setError("");
    getSocket().emit(
      "set_ready",
      { roomId: room.id, ready: !me.ready },
      (res) => {
        if (!res.ok) setError(res.error);
      },
    );
  };

  const startRound = (): void => {
    setError("");
    getSocket().emit("start_round", { roomId: room.id }, (res) => {
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Players</CardTitle>
              <Badge variant="secondary" className="font-mono rounded">
                {room.players.length}/10
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full transition-[width] duration-300"
                  style={{ width: `${readyPct}%` }}
                />
              </div>
              <span className="text-muted-foreground text-xs font-medium tabular-nums">
                {readyCount}/{room.players.length} ready
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5">
              {room.players.map((p) => (
                <li
                  key={p.id}
                  className="bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-2.5"
                >
                  <div className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    {initials(p.name) || "?"}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {p.id === meId && (
                      <Badge variant="outline" className="rounded text-[10px]">
                        you
                      </Badge>
                    )}
                    {p.isHost && (
                      <CrownIcon className="size-3.5 shrink-0 text-[var(--warning)]" />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.score > 0 && (
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {p.score}pts
                      </span>
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
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        p.ready
                          ? "bg-[var(--success)]"
                          : "bg-muted-foreground/30",
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {room.roundsPlayed > 0 && (
              <p className="text-muted-foreground mt-4 text-xs">
                {room.roundsPlayed} round{room.roundsPlayed === 1 ? "" : "s"}{" "}
                played · {room.usedWordsCount} word
                {room.usedWordsCount === 1 ? "" : "s"} used
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get ready to race</CardTitle>
            <CardDescription>
              Two random players pick a start and end letter. First valid real
              word wins +10. Streak of 3 = +5 bonus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                variant={me?.ready ? "outline" : "default"}
                className={cn(
                  "h-11 w-full text-sm font-medium",
                  me?.ready &&
                    "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/15",
                )}
                onClick={toggleReady}
                disabled={!me}
              >
                {me?.ready ? (
                  <>
                    <CheckIcon data-icon="inline-start" />
                    You're ready · tap to undo
                  </>
                ) : (
                  "I'm ready"
                )}
              </Button>

              {isHost ? (
                <Button
                  size="lg"
                  className="h-11 w-full text-sm font-medium"
                  onClick={startRound}
                  disabled={!allReady}
                >
                  <PlayIcon data-icon="inline-start" />
                  {allReady
                    ? "Start round"
                    : room.players.length < 2
                      ? "Need at least 2 players"
                      : `Waiting for ${room.players.length - readyCount} player${room.players.length - readyCount === 1 ? "" : "s"}`}
                </Button>
              ) : (
                <p className="text-muted-foreground rounded-md border border-dashed border-white/10 px-3 py-2.5 text-center text-xs">
                  Waiting for the host to start…
                </p>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <SettingsPanel room={room} isHost={isHost} />
    </div>
  );
}
