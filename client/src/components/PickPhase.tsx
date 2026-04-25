"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { PICKABLE_LETTERS, type PublicRoom } from "@/lib/types";

interface Props {
  room: PublicRoom;
  meId: string;
}

export function PickPhase({ room, meId }: Props) {
  const slot: "start" | "end" = room.phase === "pick_start" ? "start" : "end";
  const picker = slot === "start" ? room.round?.pickers.start : room.round?.pickers.end;
  const isMyTurn = picker?.playerId === meId;
  const [submittingLetter, setSubmittingLetter] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const submitting = submittingLetter !== null;

  const totalMs = room.settings.pickTimeoutSeconds * 1000;
  const [secondsLeft, setSecondsLeft] = useState<number>(room.settings.pickTimeoutSeconds);
  const [pct, setPct] = useState<number>(100);
  useEffect(() => {
    if (!picker?.deadlineMs) return;
    const tick = (): void => {
      const ms = Math.max(0, picker.deadlineMs - Date.now());
      setSecondsLeft(Math.ceil(ms / 1000));
      setPct(Math.max(0, (ms / totalMs) * 100));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [picker?.deadlineMs, totalMs]);

  const pick = (letter: string): void => {
    if (!isMyTurn || submitting) return;
    setSubmittingLetter(letter);
    setError("");
    getSocket().emit("pick_letter", { roomId: room.id, slot, letter }, (res) => {
      setSubmittingLetter(null);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader className="text-center">
          <Badge variant="outline" className="mx-auto w-fit rounded text-[10px] uppercase tracking-[0.2em]">
            Round {room.round?.index} · {slot === "start" ? "start letter" : "end letter"}
          </Badge>
          <CardTitle className="mt-2 text-xl font-semibold sm:text-2xl">
            {isMyTurn ? (
              <span>Your turn — pick a letter</span>
            ) : (
              <span>
                <span className="text-foreground">{picker?.name}</span>
                <span className="text-muted-foreground"> is picking…</span>
              </span>
            )}
          </CardTitle>

          {slot === "end" && isMyTurn && (
            <p className="text-muted-foreground mt-2 text-xs">
              Start letter is hidden — pick blind.
            </p>
          )}

          <div className="mx-auto mt-4 w-full max-w-xs">
            <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-foreground h-full transition-[width] duration-100 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1.5 font-mono text-xs tabular-nums">
              {secondsLeft}s
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
            {PICKABLE_LETTERS.map((l) => (
              <Button
                key={l}
                variant="outline"
                disabled={!isMyTurn || submitting}
                onClick={() => pick(l)}
                className={cn(
                  "h-11 w-full p-0 font-mono text-base uppercase",
                  !isMyTurn && "opacity-50",
                  submittingLetter === l &&
                    "border-foreground/40 bg-foreground/10",
                )}
              >
                {submittingLetter === l ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  l
                )}
              </Button>
            ))}
          </div>
          {!isMyTurn && (
            <p className="text-muted-foreground mt-4 text-center text-xs">
              If they don't pick in time, a random letter is chosen.
            </p>
          )}
          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
