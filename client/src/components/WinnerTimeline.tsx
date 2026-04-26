"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Player, RoundHistoryEntry } from "@/lib/types";

interface Props {
  players: Player[];
  history: RoundHistoryEntry[];
}

const PALETTE = [
  "#fafafa",
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#27272a",
  "#d4d4d8",
  "#e4e4e7",
];

export function WinnerTimeline({ players, history }: Props) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players],
  );
  const colorOf: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {};
    sorted.forEach((p, i) => {
      m[p.id] = PALETTE[i % PALETTE.length] ?? "#fafafa";
    });
    return m;
  }, [sorted]);

  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Round timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {history.map((r) => {
            const color = r.winnerId ? colorOf[r.winnerId] : null;
            const tip = r.winnerName
              ? `R${r.index} · ${r.start}…${r.end} · ${r.winnerName} (${r.word}) ${((r.tookMs ?? 0) / 1000).toFixed(2)}s`
              : r.skipped
                ? `R${r.index} · ${r.start}…${r.end} · skipped (${r.skipReason})`
                : `R${r.index} · ${r.start}…${r.end} · timed out`;
            return (
              <div
                key={r.index}
                title={tip}
                className={cn(
                  "relative flex h-10 min-w-[1.75rem] flex-1 items-center justify-center rounded-sm border text-[10px] font-mono tabular-nums sm:h-12",
                  !color && "bg-muted/30 text-muted-foreground border-dashed",
                )}
                style={
                  color
                    ? {
                        background: color,
                        color:
                          color === "#fafafa" || color === "#e4e4e7" || color === "#d4d4d8"
                            ? "#0a0a0a"
                            : "#fafafa",
                        borderColor: "transparent",
                      }
                    : undefined
                }
              >
                <span className="opacity-60">{r.index}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
          {sorted.map((p) => {
            const wins = history.filter((r) => r.winnerId === p.id).length;
            if (wins === 0) return null;
            return (
              <span
                key={p.id}
                className="text-muted-foreground inline-flex items-center gap-1.5"
              >
                <span
                  className="size-2 rounded-sm"
                  style={{ background: colorOf[p.id] ?? "#fafafa" }}
                />
                <span className="text-foreground">{p.name}</span>
                <span className="font-mono">×{wins}</span>
              </span>
            );
          })}
          {history.some((r) => !r.winnerId) && (
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="bg-muted/30 size-2 rounded-sm border border-dashed" />
              skipped / timed out
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
