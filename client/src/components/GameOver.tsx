"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  CrownIcon,
  FlameIcon,
  Loader2Icon,
  RotateCcwIcon,
  TrophyIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";
import { ShareCard } from "./ShareCard";
import { ShareMenu } from "./ShareMenu";
import { WinnerTimeline } from "./WinnerTimeline";

const StatsCharts = dynamic(
  () => import("./StatsCharts").then((m) => m.StatsCharts),
  { ssr: false, loading: () => <ChartsLoading /> },
);

function ChartsLoading() {
  return (
    <div className="bg-muted/30 flex h-40 items-center justify-center rounded-md border">
      <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
    </div>
  );
}

interface Props {
  room: PublicRoom;
  meId: string;
  isHost: boolean;
}

const FUNNY_FOOTERS = [
  "go touch grass",
  "tell your friends, lose to them too",
  "log this loss in your diary",
  "one game closer to retirement",
  "your dictionary thanks you",
];

export function GameOver({ room, meId, isHost }: Props) {
  const [busy, setBusy] = useState<boolean>(false);
  const shareRef = useRef<HTMLDivElement | null>(null);

  const captureBlob = async (): Promise<Blob | null> => {
    if (!shareRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return toBlob(shareRef.current, {
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: "#0a0a0a",
    });
  };

  const handleDownload = async (): Promise<void> => {
    const blob = await captureBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (room.name ?? room.id).replace(/[^a-z0-9-]/gi, "_");
    a.download = `wordbridge-${safeName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareImage = async (): Promise<void> => {
    const blob = await captureBlob();
    if (!blob) return;
    const file = new File([blob], "word-bridge-race.png", { type: "image/png" });
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const url =
      typeof window !== "undefined"
        ? window.location.origin
        : "wordbridge.race";
    const text = winner
      ? `Word Bridge Race · ${winner.name} took it.`
      : `Word Bridge Race results`;

    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: "Word Bridge Race",
        text,
        url,
        files: [file],
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: "Word Bridge Race", text, url });
      return;
    }
    await handleDownload();
  };

  const sorted = [...room.players].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
  const winner = sorted[0];
  const top = winner?.score ?? 0;
  const totalCheats = room.roundHistory.reduce(
    (acc, r) => acc + r.cheaterIds.length,
    0,
  );
  const totalSkipped = room.roundHistory.filter((r) => r.skipped).length;
  const totalTimedOut = room.roundHistory.filter(
    (r) => r.timedOut && !r.skipped,
  ).length;
  const fastestWin = room.roundHistory
    .filter((r) => r.tookMs !== null)
    .sort((a, b) => (a.tookMs ?? 0) - (b.tookMs ?? 0))[0];
  const durationSec =
    room.gameStartedAt !== null && room.gameEndedAt !== null
      ? Math.floor((room.gameEndedAt - room.gameStartedAt) / 1000)
      : null;

  const footer =
    FUNNY_FOOTERS[Math.floor(Math.random() * FUNNY_FOOTERS.length)] ??
    "good game";

  const newGame = (): void => {
    if (busy) return;
    setBusy(true);
    getSocket().emit("new_game", { roomId: room.id }, () => {
      setBusy(false);
    });
  };

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex flex-col gap-4 duration-500">
      <Card className="text-center">
        <CardHeader className="items-center">
          <Badge
            variant="outline"
            className="rounded text-[10px] uppercase tracking-[0.25em]"
          >
            Game over
          </Badge>
          {winner && top > 0 ? (
            <CardTitle className="mt-3 flex flex-wrap items-center justify-center gap-3 text-2xl sm:text-3xl">
              <TrophyIcon className="size-7 text-[var(--warning)]" />
              <span>
                {winner.name}{" "}
                <span className="text-muted-foreground text-base">wins</span>
              </span>
            </CardTitle>
          ) : (
            <CardTitle className="mt-3 text-2xl sm:text-3xl">
              Nobody scored. Awkward.
            </CardTitle>
          )}
          <p className="text-muted-foreground mt-2 text-xs italic">{footer}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Rounds" value={room.roundsPlayed} />
            {totalCheats > 0 ? (
              <Stat label="Cheats" value={totalCheats} tone="danger" />
            ) : (
              <Stat label="Cheats" value={0} />
            )}
            <Stat label="Skips" value={totalSkipped + totalTimedOut} />
            <Stat
              label="Duration"
              value={durationSec !== null ? `${Math.floor(durationSec / 60)}m` : "—"}
            />
          </div>

          {fastestWin && (
            <p className="text-muted-foreground mt-4 text-xs">
              Fastest win:{" "}
              <span className="text-foreground font-mono">
                {fastestWin.word}
              </span>{" "}
              by {fastestWin.winnerName} in{" "}
              <span className="font-mono">
                {((fastestWin.tookMs ?? 0) / 1000).toFixed(2)}s
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Brag about it</CardTitle>
        </CardHeader>
        <CardContent>
          <ShareMenu
            room={room}
            onDownload={handleDownload}
            onShareImage={handleShareImage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final standings</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5">
            {sorted.map((p, idx) => {
              const wins = room.roundHistory.filter(
                (r) => r.winnerId === p.id,
              ).length;
              const cheats = room.roundHistory.filter((r) =>
                r.cheaterIds.includes(p.id),
              ).length;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2.5",
                    idx === 0 && top > 0
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
                    <span className="truncate text-sm font-medium">
                      {p.name}
                      {p.id === meId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </span>
                    {p.isHost && (
                      <CrownIcon className="size-3.5 shrink-0 text-[var(--warning)]" />
                    )}
                  </div>
                  <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-[11px]">
                    <span>
                      <span className="text-foreground font-mono">{wins}</span>{" "}
                      wins
                    </span>
                    {cheats > 0 && (
                      <span className="text-destructive">
                        <span className="font-mono">{cheats}</span> cheats
                      </span>
                    )}
                    {p.streak >= 2 && (
                      <span className="text-orange-400 inline-flex items-center gap-0.5">
                        <FlameIcon className="size-3" />
                        {p.streak}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 font-mono text-base font-semibold tabular-nums">
                    {p.score}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <WinnerTimeline players={room.players} history={room.roundHistory} />

      <StatsCharts players={room.players} history={room.roundHistory} />

      {isHost && (
        <button
          type="button"
          onClick={newGame}
          disabled={busy}
          className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-xs underline-offset-4 transition-colors hover:underline disabled:opacity-50"
        >
          {busy ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-3" />
          )}
          {busy ? "resetting…" : "start a new game"}
        </button>
      )}

      {/* Off-screen share card — captured to PNG, never visible */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <ShareCard ref={shareRef} room={room} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "danger";
}) {
  return (
    <div
      className={cn(
        "bg-muted/30 flex flex-col gap-1 rounded-md border px-3 py-2 text-center",
        tone === "danger" && "border-destructive/30",
      )}
    >
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
