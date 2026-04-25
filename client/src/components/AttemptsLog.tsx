"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttemptEntry } from "@/app/room/[roomId]/page";

interface Props {
  attempts: AttemptEntry[];
  meId: string;
  className?: string;
  emptyHint?: string;
}

export function AttemptsLog({ attempts, meId, className, emptyHint }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [attempts.length]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Round log</CardTitle>
          <Badge variant="secondary" className="font-mono rounded text-[10px] tabular-nums">
            {attempts.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            {emptyHint ?? "No guesses yet."}
          </p>
        ) : (
          <div
            ref={scrollRef}
            className="no-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto sm:max-h-[28rem]"
          >
            {attempts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                  a.valid
                    ? "border-[var(--success)]/30 bg-[var(--success)]/5"
                    : "border-white/5 bg-white/[0.02]",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {a.valid ? (
                    <CheckCircle2Icon className="size-3.5 shrink-0 text-[var(--success)]" />
                  ) : (
                    <XCircleIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
                  )}
                  <span className="text-muted-foreground truncate text-[11px]">
                    {a.name}
                    {a.playerId === meId && <span> (you)</span>}
                  </span>
                  <span
                    className={cn(
                      "truncate font-mono text-sm",
                      a.valid ? "text-[var(--success)]" : "text-foreground",
                    )}
                  >
                    {a.word || "—"}
                  </span>
                </div>
                <span className="text-muted-foreground/70 shrink-0 text-[10px] uppercase tracking-wider">
                  {a.valid ? "winner" : humanReason(a.reason)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function humanReason(reason?: string): string {
  switch (reason) {
    case "wrong_start":
      return "wrong start";
    case "wrong_end":
      return "wrong end";
    case "not_a_word":
      return "not a word";
    case "already_used":
      return "used";
    case "too_short":
      return "too short";
    case "letters_only":
      return "letters only";
    case "empty":
      return "empty";
    default:
      return "invalid";
  }
}
