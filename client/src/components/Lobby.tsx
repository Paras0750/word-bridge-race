"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  FlameIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PencilIcon,
  PlayIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";
import { SettingsPanel } from "./SettingsPanel";
import { HouseRules } from "./HouseRules";

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

const READY_NUDGES = [
  "I'm ready",
  "Let's go",
  "Bring it",
  "Ready to lose",
  "All in",
];

export function Lobby({ room, meId, isHost }: Props) {
  const [error, setError] = useState<string>("");
  const [readyBusy, setReadyBusy] = useState<boolean>(false);
  const [startBusy, setStartBusy] = useState<boolean>(false);
  const [editingName, setEditingName] = useState<boolean>(false);
  const [draftName, setDraftName] = useState<string>(room.name ?? "");

  useEffect(() => {
    setDraftName(room.name ?? "");
  }, [room.name]);

  const me = room.players.find((p) => p.id === meId);
  const active = room.players.filter((p) => p.connected && !p.spectator);
  const allReady = active.length >= 2 && active.every((p) => p.ready);
  const readyCount = active.filter((p) => p.ready).length;
  const readyPct = (readyCount / Math.max(1, active.length)) * 100;

  const readyLabel =
    READY_NUDGES[Math.floor(Math.random() * READY_NUDGES.length)] ??
    "I'm ready";

  const toggleReady = (): void => {
    if (!me || readyBusy) return;
    setError("");
    setReadyBusy(true);
    getSocket().emit(
      "set_ready",
      { roomId: room.id, ready: !me.ready },
      (res) => {
        setReadyBusy(false);
        if (!res.ok) setError(res.error);
      },
    );
  };

  const startRound = (): void => {
    if (startBusy) return;
    setError("");
    setStartBusy(true);
    getSocket().emit("start_round", { roomId: room.id }, (res) => {
      setStartBusy(false);
      if (!res.ok) setError(res.error);
    });
  };

  const transferHost = (toPlayerId: string): void => {
    getSocket().emit(
      "transfer_host",
      { roomId: room.id, toPlayerId },
      (res) => {
        if (!res.ok) setError(res.error);
      },
    );
  };

  const toggleSpectate = (): void => {
    if (!me) return;
    getSocket().emit(
      "set_spectator",
      { roomId: room.id, spectator: !me.spectator },
      (res) => {
        if (!res.ok) setError(res.error);
      },
    );
  };

  const saveName = (): void => {
    setEditingName(false);
    getSocket().emit(
      "set_room_name",
      { roomId: room.id, name: draftName },
      (res) => {
        if (!res.ok) setError(res.error);
      },
    );
  };

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 grid gap-4 duration-300 lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {editingName && isHost ? (
                  <Input
                    autoFocus
                    value={draftName}
                    maxLength={30}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") {
                        setEditingName(false);
                        setDraftName(room.name ?? "");
                      }
                    }}
                    placeholder="Name this circus"
                    className="h-8 max-w-xs"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!isHost}
                    onClick={() => isHost && setEditingName(true)}
                    className={cn(
                      "group inline-flex min-w-0 items-center gap-2 truncate text-left",
                      isHost && "hover:text-foreground",
                    )}
                  >
                    <CardTitle className="truncate text-base">
                      {room.name ?? "Players"}
                    </CardTitle>
                    {isHost && (
                      <PencilIcon className="text-muted-foreground/50 size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary" className="rounded font-mono">
                  {active.length}/10
                </Badge>
              </div>
            </div>
            {active.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                  <div
                    className="bg-foreground h-full transition-[width] duration-300"
                    style={{ width: `${readyPct}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-xs font-medium tabular-nums">
                  {readyCount}/{active.length} ready
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5">
              {room.players.map((p) => {
                const canTransfer =
                  isHost && p.id !== meId && p.connected && !p.spectator;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-2.5",
                      !p.connected && "opacity-50",
                    )}
                  >
                    <div className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                      {initials(p.name) || "?"}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                      {p.id === meId && (
                        <Badge
                          variant="outline"
                          className="rounded text-[10px]"
                        >
                          you
                        </Badge>
                      )}
                      {p.spectator && (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded text-[10px] italic"
                          title="Watching this round, joins next"
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
                      {canTransfer && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="text-muted-foreground hover:text-foreground -mr-1 rounded p-1"
                            aria-label="Player options"
                          >
                            <MoreVerticalIcon className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={4}>
                            <DropdownMenuItem onClick={() => transferHost(p.id)}>
                              <CrownIcon className="size-3.5" />
                              Make host
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </li>
                );
              })}
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
              Best of {room.settings.maxRounds} rounds. Two random players pick
              the letters. First valid word wins +10. Streak of 3 = +5 bonus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {me?.spectator ? (
                <>
                  <Alert>
                    <AlertDescription>
                      Watching from the bleachers. Jump back in for the next
                      round.
                    </AlertDescription>
                  </Alert>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 w-full text-sm font-medium"
                    onClick={toggleSpectate}
                  >
                    <EyeOffIcon data-icon="inline-start" />
                    I want to play next round
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant={me?.ready ? "outline" : "default"}
                    className={cn(
                      "h-11 w-full text-sm font-medium",
                      me?.ready &&
                        "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/15",
                    )}
                    onClick={toggleReady}
                    disabled={!me || readyBusy}
                  >
                    {readyBusy ? (
                      <>
                        <Loader2Icon
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                        Saving…
                      </>
                    ) : me?.ready ? (
                      <>
                        <CheckIcon data-icon="inline-start" />
                        Locked in · tap to chicken out
                      </>
                    ) : (
                      readyLabel
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-8 w-full text-xs"
                    onClick={toggleSpectate}
                  >
                    <EyeIcon data-icon="inline-start" />
                    Just here to watch
                  </Button>
                </>
              )}

              {isHost ? (
                <Button
                  size="lg"
                  className="h-11 w-full text-sm font-medium"
                  onClick={startRound}
                  disabled={!allReady || startBusy}
                >
                  {startBusy ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  {startBusy
                    ? "Lighting the fuse…"
                    : allReady
                      ? `Start the show (${room.settings.maxRounds} rounds)`
                      : active.length < 2
                        ? "Need ≥2 brave souls"
                        : `Waiting on ${active.length - readyCount} ${active.length - readyCount === 1 ? "diva" : "divas"}…`}
                </Button>
              ) : (
                <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2.5 text-center text-xs">
                  Waiting for the host to stop scrolling and hit start…
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

      <div className="flex flex-col gap-4">
        <SettingsPanel room={room} isHost={isHost} />
        <HouseRules wordListId={room.settings.wordListId} />
      </div>
    </div>
  );
}
