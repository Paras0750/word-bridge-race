"use client";

import { useState } from "react";
import {
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
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

interface Props {
  room: PublicRoom;
  meId: string;
  isHost: boolean;
}

const PAUSED_MESSAGES = [
  "intermission · grab a snack",
  "halftime · stretch those typing fingers",
  "the game has gone for a walk",
  "we'll wait. take your time.",
];

export function PausedView({ room, meId, isHost }: Props) {
  const [busy, setBusy] = useState<boolean>(false);

  const me = room.players.find((p) => p.id === meId);
  const active = room.players.filter((p) => p.connected && !p.spectator);
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const needed = Math.max(0, 2 - active.length);
  const message =
    PAUSED_MESSAGES[Math.floor(Math.random() * PAUSED_MESSAGES.length)] ??
    "paused";

  const toggleSpectate = (): void => {
    if (!me) return;
    getSocket().emit(
      "set_spectator",
      { roomId: room.id, spectator: !me.spectator },
      () => undefined,
    );
  };

  const resume = (): void => {
    if (busy) return;
    setBusy(true);
    getSocket().emit("resume_game", { roomId: room.id }, () => {
      setBusy(false);
    });
  };

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 flex flex-col gap-4 duration-300">
      <Card className="text-center">
        <CardHeader className="items-center">
          <Badge
            variant="outline"
            className="gap-1.5 rounded text-[10px] uppercase tracking-[0.25em]"
          >
            <PauseIcon className="size-3" />
            Paused
          </Badge>
          <CardTitle className="mt-3 text-2xl sm:text-3xl">
            {needed > 0
              ? `Need ${needed} more ${needed === 1 ? "player" : "players"}`
              : "Ready to resume"}
          </CardTitle>
          <p className="text-muted-foreground mt-2 text-xs italic">{message}</p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Round {room.roundsPlayed + 1} of {room.settings.maxRounds} ·
            scores preserved
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {me?.spectator ? (
              <Button
                size="lg"
                className="h-11 text-sm font-medium"
                onClick={toggleSpectate}
              >
                <EyeOffIcon data-icon="inline-start" />
                Stop watching · play
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-11 text-sm font-medium"
                onClick={toggleSpectate}
              >
                <EyeIcon data-icon="inline-start" />
                Just watch
              </Button>
            )}
            {isHost && active.length >= 2 && (
              <Button
                size="lg"
                className="h-11 text-sm font-medium"
                onClick={resume}
                disabled={busy}
              >
                {busy ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {busy ? "Unpausing…" : "Resume"}
              </Button>
            )}
          </div>
          {!isHost && active.length >= 2 && (
            <p className="text-muted-foreground mt-3 text-xs">
              Waiting for the host to hit resume…
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standings so far</CardTitle>
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
                  !p.connected && "opacity-50",
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
                  <span className="truncate text-sm font-medium">
                    {p.name}
                    {p.id === meId && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </span>
                  {p.isHost && (
                    <CrownIcon className="size-3.5 shrink-0 text-[var(--warning)]" />
                  )}
                  {p.spectator && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded text-[10px] italic"
                    >
                      <EyeIcon className="size-3" />
                      watching
                    </Badge>
                  )}
                  {!p.connected && (
                    <Badge
                      variant="outline"
                      className="rounded text-[10px] italic"
                    >
                      offline
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {p.score}
                  <span className="text-muted-foreground text-xs"> pts</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
