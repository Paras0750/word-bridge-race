"use client";

import { useEffect, useRef, useState } from "react";
import { HandIcon, Loader2Icon, SendIcon } from "lucide-react";
import { sfx } from "@/lib/sound";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import type { PublicRoom, WordListId } from "@/lib/types";
import { WORD_LIST_META } from "@/lib/types";
import { AttemptsLog } from "./AttemptsLog";
import type { AttemptEntry } from "@/app/room/[roomId]/page";

interface Props {
  room: PublicRoom;
  meId: string;
  attempts: AttemptEntry[];
}

export function ActiveRound({ room, meId, attempts }: Props) {
  const me = room.players.find((p) => p.id === meId);
  const isSpectator = me?.spectator === true;
  const [word, setWord] = useState<string>("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pastedRef = useRef<boolean>(false);
  const roundIdxRef = useRef<number>(room.round?.index ?? 0);

  if (roundIdxRef.current !== (room.round?.index ?? 0)) {
    roundIdxRef.current = room.round?.index ?? 0;
    pastedRef.current = false;
  }

  const start = room.round?.start ?? "";
  const end = room.round?.end ?? "";
  const allowsSpaces = room.settings.wordListId === "atlas";
  const startedAt = room.round?.startedAt ?? null;
  const endsAt = room.round?.endsAt ?? null;
  const totalMs = startedAt && endsAt ? endsAt - startedAt : 0;
  const remainingMs = endsAt && startedAt ? Math.max(0, endsAt - startedAt - elapsedMs) : 0;
  const remainingPct = totalMs > 0 ? Math.max(0, (remainingMs / totalMs) * 100) : 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isSpectator) return;
    const onKey = (e: KeyboardEvent): void => {
      if (document.activeElement === inputRef.current) return;
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSpectator]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = (): void => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!endsAt) return;
    let firedRush = false;
    let lastTickSec = -1;
    const tick = (): void => {
      const remaining = endsAt - Date.now();
      const secs = Math.ceil(remaining / 1000);
      if (!firedRush && remaining <= 10_000 && remaining > 0) {
        firedRush = true;
        try {
          navigator.vibrate?.(40);
        } catch {
          // ignore
        }
      }
      if (remaining <= 10_000 && remaining > 0 && secs !== lastTickSec) {
        lastTickSec = secs;
        sfx.rush();
      }
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    let lastEmit = 0;
    let wasHidden = false;
    const emitPeek = (kind: "tab" | "mouse" | "resize"): void => {
      const now = Date.now();
      if (now - lastEmit < 4000) return;
      lastEmit = now;
      getSocket().emit("peeked", { roomId: room.id, kind }, () => undefined);
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        emitPeek("tab");
      }
    };
    const onPageShow = (): void => {
      if (wasHidden) {
        wasHidden = false;
        emitPeek("tab");
      }
    };
    const onWindowBlur = (): void => {
      if (document.activeElement?.tagName === "INPUT") return;
      wasHidden = true;
    };
    const onMouseLeave = (e: MouseEvent): void => {
      const to = e.relatedTarget as Node | null;
      if (!to) emitPeek("mouse");
    };
    let initialW = window.innerWidth;
    let initialH = window.innerHeight;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const dw = Math.abs(window.innerWidth - initialW);
        const dh = Math.abs(window.innerHeight - initialH);
        if (dw > 80 || dh > 80) {
          emitPeek("resize");
          initialW = window.innerWidth;
          initialH = window.innerHeight;
        }
      }, 600);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("resize", onResize);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [room.id]);

  const submit = (): void => {
    const value = word.trim().toLowerCase();
    if (!value) return;
    setSubmitting(true);
    getSocket().emit(
      "submit_word",
      { roomId: room.id, word: value, pasted: pastedRef.current },
      (res) => {
        setSubmitting(false);
        if (!res.ok) {
          setFeedback({ tone: "bad", text: res.error });
          return;
        }
        if (res.data.accepted) {
          setFeedback({ tone: "ok", text: "Correct!" });
          setWord("");
        } else if (res.data.reason === "pasted") {
          setFeedback({
            tone: "bad",
            text: "🚨 Caught pasting. Score docked, can't win this round.",
          });
          setWord("");
        } else {
          setFeedback({
            tone: "bad",
            text: humanizeReason(res.data.reason, room.settings.wordListId),
          });
          setWord("");
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      },
    );
  };

  const sortedPlayers = [...room.players].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const barColor =
    remainingPct > 33
      ? "bg-foreground"
      : remainingPct > 15
        ? "bg-[var(--warning)]"
        : "bg-destructive";
  const isRush = remainingMs > 0 && remainingMs <= 10_000;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 grid gap-4 duration-300 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="text-center">
            <Badge
              variant="outline"
              className="mx-auto w-fit rounded text-[10px] uppercase tracking-[0.2em]"
            >
              Round {room.round?.index} of {room.settings.maxRounds} · bridge it
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

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
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
              {room.round && room.round.possibleWordCount > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {room.round.possibleWordCount} possible
                  </span>
                </>
              )}
            </div>
            {endsAt && (
              <div
                className={cn(
                  "bg-muted mt-2 h-1 w-full overflow-hidden rounded-full",
                  isRush && "motion-safe:animate-pulse",
                )}
              >
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

        {isSpectator ? (
          <Card>
            <CardContent className="pt-5 text-center">
              <p className="text-muted-foreground text-sm">
                You're watching. The pen is for the players.
              </p>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardContent className="pt-5">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              autoComplete="off"
            >
              <Input
                ref={inputRef}
                value={word}
                onChange={(e) => {
                  const native = e.nativeEvent as InputEvent;
                  if (
                    native.inputType === "insertFromPaste" ||
                    native.inputType === "insertFromPasteAsQuotation" ||
                    native.inputType === "insertFromDrop"
                  ) {
                    pastedRef.current = true;
                  }
                  setWord(
                    allowsSpaces
                      ? e.target.value
                          .replace(/[^a-zA-Z ]/g, "")
                          .toLowerCase()
                          .replace(/\s+/g, " ")
                      : e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase(),
                  );
                }}
                onPaste={() => {
                  pastedRef.current = true;
                }}
                onDrop={() => {
                  pastedRef.current = true;
                }}
                placeholder={`${start}...${end}`}
                autoFocus
                maxLength={allowsSpaces ? 50 : 40}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="send"
                name="wbr-answer"
                aria-autocomplete="none"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                className="h-11 flex-1 font-mono text-base lowercase"
              />
              <Button
                type="submit"
                size="lg"
                className="h-11 px-5 sm:px-6"
                disabled={submitting || !word.trim()}
              >
                {submitting ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                {submitting ? "Sending…" : "Submit"}
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

            <SkipVoteRow room={room} meId={meId} />
          </CardContent>
        </Card>
        )}

        <LeaderboardStrip players={sortedPlayers} meId={meId} />
      </div>

      <AttemptsLog
        attempts={attempts}
        meId={meId}
        wordListId={room.settings.wordListId}
        emptyHint="Be the first to guess!"
      />
    </div>
  );
}

function LeaderboardStrip({
  players,
  meId,
}: {
  players: PublicRoom["players"];
  meId: string;
}) {
  const top = players.slice(0, 4);
  const overflow = players.length - top.length;
  return (
    <div className="bg-card/60 supports-[backdrop-filter]:bg-card/40 sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-1 overflow-x-auto rounded-md border px-3 py-2 backdrop-blur sm:mx-0">
      <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-[0.2em]">
        Top
      </span>
      {top.map((p, idx) => {
        const isMe = p.id === meId;
        return (
          <span
            key={p.id}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              isMe
                ? "border-foreground/40 bg-foreground/5 font-medium"
                : "bg-muted/40",
              !p.connected && "opacity-50",
            )}
            title={`${p.name} · ${p.score} pts`}
          >
            <span
              className={cn(
                "text-muted-foreground font-mono text-[10px]",
                idx === 0 && "text-[var(--warning)]",
              )}
            >
              {idx + 1}
            </span>
            <span className="max-w-[6ch] truncate sm:max-w-[10ch]">
              {p.name}
              {isMe && <span className="text-muted-foreground"> (you)</span>}
            </span>
            <span className="text-muted-foreground font-mono tabular-nums">
              {p.score}
            </span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-muted-foreground shrink-0 text-[10px]">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

function SkipVoteRow({ room, meId }: { room: PublicRoom; meId: string }) {
  const [voting, setVoting] = useState<boolean>(false);
  const votes = room.round?.skipVoteIds ?? [];
  const total = room.players.length;
  const haveIVoted = votes.includes(meId);

  const vote = (): void => {
    if (haveIVoted || voting) return;
    setVoting(true);
    getSocket().emit("vote_skip", { roomId: room.id }, () => {
      setVoting(false);
    });
  };

  return (
    <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
      <div className="text-muted-foreground text-[11px]">
        Stuck? Skip if everyone agrees ·{" "}
        <span className="font-mono tabular-nums">
          {votes.length}/{total}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={vote}
        disabled={haveIVoted || voting}
        className={cn(
          "h-8 gap-1.5",
          haveIVoted && "border-[var(--warning)]/40 text-[var(--warning)]",
        )}
      >
        {voting ? (
          <Loader2Icon className="size-3 animate-spin" />
        ) : (
          <HandIcon className="size-3" />
        )}
        {haveIVoted ? "Voted skip" : "Vote skip"}
      </Button>
    </div>
  );
}

function humanizeReason(reason?: string, wordListId: WordListId = "dictionary"): string {
  switch (reason) {
    case "wrong_start":
      return "Doesn't start with the right letter.";
    case "wrong_end":
      return "Doesn't end with the right letter.";
    case "letters_only":
      return wordListId === "atlas" ? "Letters and spaces only." : "Letters only.";
    case "too_short":
      return "Too short to bridge both.";
    case "empty":
      return "Type something.";
    case "not_a_word":
      return WORD_LIST_META[wordListId].notFoundLabel;
    case "almost":
      return "So close. Check your spelling.";
    case "already_used":
      return "Already used this room.";
    default:
      return "Not valid.";
  }
}
