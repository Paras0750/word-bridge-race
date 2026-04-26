"use client";

import { useEffect, useRef } from "react";
import {
  BrainIcon,
  CheckCircle2Icon,
  ClipboardXIcon,
  EyeIcon,
  HandIcon,
  XCircleIcon,
} from "lucide-react";
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
          <Badge variant="secondary" className="rounded font-mono text-[10px] tabular-nums">
            {attempts.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-xs">
            {emptyHint ?? "No activity yet."}
          </p>
        ) : (
          <div
            ref={scrollRef}
            className="no-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto sm:max-h-[28rem]"
          >
            {attempts.map((a) => (
              <LogRow key={a.id} entry={a} meId={meId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ entry, meId }: { entry: AttemptEntry; meId: string }) {
  const isMe = entry.playerId === meId;
  const nameLabel = (
    <span className="text-muted-foreground text-[11px]">
      {entry.name}
      {isMe && <span> (you)</span>}
    </span>
  );

  if (entry.kind === "guess") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
          entry.valid
            ? "border-[var(--success)]/30 bg-[var(--success)]/5"
            : "bg-muted/30",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {entry.valid ? (
            <CheckCircle2Icon className="size-3.5 shrink-0 text-[var(--success)]" />
          ) : (
            <XCircleIcon className="text-muted-foreground/60 size-3.5 shrink-0" />
          )}
          {nameLabel}
          <span
            className={cn(
              "truncate font-mono text-sm",
              entry.valid ? "text-[var(--success)]" : "text-foreground",
            )}
          >
            {entry.word || "—"}
          </span>
        </div>
        <span className="text-muted-foreground/70 shrink-0 text-[10px] uppercase tracking-wider">
          {entry.valid ? "winner" : humanReason(entry.reason)}
        </span>
      </div>
    );
  }

  if (entry.kind === "cheat") {
    return (
      <div className="border-destructive/40 bg-destructive/10 flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardXIcon className="text-destructive size-3.5 shrink-0" />
          {nameLabel}
          <span className="text-destructive truncate text-xs italic">
            caught pasting
          </span>
        </div>
        <span className="text-destructive shrink-0 text-[10px] uppercase tracking-wider">
          −{entry.penalty}
        </span>
      </div>
    );
  }

  if (entry.kind === "peek") {
    return (
      <div className="bg-muted/30 flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm">
        <EyeIcon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground truncate text-xs">
          {entry.message}
        </span>
      </div>
    );
  }

  if (entry.kind === "hivemind") {
    return (
      <div className="bg-muted/30 flex items-center gap-2 rounded-sm border border-[var(--info)]/30 bg-[var(--info)]/5 px-2.5 py-1.5 text-sm">
        <BrainIcon className="size-3.5 shrink-0 text-[var(--info)]" />
        <span className="text-muted-foreground truncate text-xs">
          <span className="text-foreground font-medium">{entry.names[0]}</span>{" "}
          & <span className="text-foreground font-medium">{entry.names[1]}</span>{" "}
          both tried{" "}
          <span className="text-foreground font-mono">{entry.word}</span>
        </span>
        <span className="text-muted-foreground/70 ml-auto shrink-0 text-[10px] uppercase tracking-wider">
          hivemind
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-[var(--warning)]/30 bg-[var(--warning)]/5 px-2.5 py-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <HandIcon className="size-3.5 shrink-0 text-[var(--warning)]" />
        {nameLabel}
        <span className="text-muted-foreground text-xs">voted skip</span>
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
        {entry.votes}/{entry.total}
      </span>
    </div>
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
    case "almost":
      return "so close";
    case "already_used":
      return "used";
    case "too_short":
      return "too short";
    case "letters_only":
      return "letters only";
    case "empty":
      return "empty";
    case "pasted":
      return "pasted";
    default:
      return "invalid";
  }
}
