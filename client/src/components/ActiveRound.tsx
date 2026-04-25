"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";
import { AttemptsLog } from "./AttemptsLog";
import type { AttemptEntry } from "@/app/room/[roomId]/page";

interface Props {
  room: PublicRoom;
  meId: string;
  attempts: AttemptEntry[];
}

export function ActiveRound({ room, meId, attempts }: Props) {
  const [word, setWord] = useState<string>("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const start = room.round?.start ?? "";
  const end = room.round?.end ?? "";
  const startedAt = room.round?.startedAt ?? null;
  const endsAt = room.round?.endsAt ?? null;
  const totalMs = startedAt && endsAt ? endsAt - startedAt : 0;
  const remainingMs = endsAt && startedAt ? Math.max(0, endsAt - startedAt - elapsedMs) : 0;
  const remainingPct = totalMs > 0 ? Math.max(0, (remainingMs / totalMs) * 100) : 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (document.activeElement === inputRef.current) return;
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const tick = (): void => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [startedAt]);

  const submit = (): void => {
    const value = word.trim().toLowerCase();
    if (!value) return;
    setSubmitting(true);
    getSocket().emit("submit_word", { roomId: room.id, word: value }, (res) => {
      setSubmitting(false);
      if (!res.ok) {
        setFeedback({ tone: "bad", text: res.error });
        return;
      }
      if (res.data.accepted) {
        setFeedback({ tone: "ok", text: "Correct!" });
        setWord("");
      } else {
        setFeedback({ tone: "bad", text: humanizeReason(res.data.reason) });
        setWord("");
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    });
  };

  const otherPlayers = room.players.filter((p) => p.id !== meId);

  const barColor =
    remainingPct > 33
      ? "bg-foreground"
      : remainingPct > 15
        ? "bg-[var(--warning)]"
        : "bg-destructive";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="text-center">
            <Badge
              variant="outline"
              className="mx-auto w-fit rounded text-[10px] uppercase tracking-[0.2em]"
            >
              Round {room.round?.index} · bridge it
            </Badge>
            <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4">
              <span className="bg-muted text-foreground grid size-16 place-items-center rounded-md border font-mono text-3xl font-semibold uppercase sm:size-20 sm:text-5xl">
                {start}
              </span>
              <span className="text-muted-foreground text-2xl font-light sm:text-3xl">
                ···
              </span>
              <span className="bg-muted text-foreground grid size-16 place-items-center rounded-md border font-mono text-3xl font-semibold uppercase sm:size-20 sm:text-5xl">
                {end}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 text-xs">
              <span className="text-muted-foreground font-mono tabular-nums">
                {(elapsedMs / 1000).toFixed(2)}s
              </span>
              {endsAt && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {Math.ceil(remainingMs / 1000)}s left
                  </span>
                </>
              )}
            </div>
            {endsAt && (
              <div className="bg-muted mt-2 h-1 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full transition-[width] duration-100 ease-linear",
                    barColor,
                  )}
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Input
                ref={inputRef}
                value={word}
                onChange={(e) =>
                  setWord(e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase())
                }
                placeholder={`${start}...${end}`}
                autoFocus
                maxLength={40}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                className="h-11 flex-1 font-mono text-base lowercase"
              />
              <Button
                type="submit"
                size="lg"
                className="h-11 px-5 sm:px-6"
                disabled={submitting || !word.trim()}
              >
                <SendIcon data-icon="inline-start" />
                Submit
              </Button>
            </form>

            {feedback && (
              <Alert
                variant={feedback.tone === "ok" ? "default" : "destructive"}
                className={cn(
                  "mt-3",
                  feedback.tone === "ok" &&
                    "border-[var(--success)]/40 bg-[var(--success)]/10",
                )}
              >
                <AlertDescription
                  className={cn(feedback.tone === "ok" && "text-[var(--success)]")}
                >
                  {feedback.text}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-muted-foreground mt-3 text-xs">
              Real word · starts with{" "}
              <span className="text-foreground font-mono uppercase">{start}</span> ·
              ends with <span className="text-foreground font-mono uppercase">{end}</span>{" "}
              · not used in this room before.
            </p>
          </CardContent>
        </Card>

        {otherPlayers.length > 0 && (
          <Card>
            <CardContent className="pt-5">
              <p className="text-muted-foreground mb-2 text-[10px] uppercase tracking-[0.2em]">
                Racing against
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherPlayers.map((p) => (
                  <Badge key={p.id} variant="outline" className="gap-1.5 rounded">
                    <span className="size-1.5 rounded-full bg-[var(--success)]" />
                    {p.name}
                    {p.score > 0 && (
                      <span className="text-muted-foreground">· {p.score}pts</span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AttemptsLog attempts={attempts} meId={meId} emptyHint="Be the first to guess!" />
    </div>
  );
}

function humanizeReason(reason?: string): string {
  switch (reason) {
    case "wrong_start":
      return "Doesn't start with the right letter.";
    case "wrong_end":
      return "Doesn't end with the right letter.";
    case "letters_only":
      return "Letters only.";
    case "too_short":
      return "Too short to bridge both.";
    case "empty":
      return "Type something.";
    case "not_a_word":
      return "Not in the dictionary.";
    case "already_used":
      return "Already used this room.";
    default:
      return "Not valid.";
  }
}
