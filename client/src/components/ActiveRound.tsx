"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { PublicRoom } from "@/lib/types";

interface Props {
  room: PublicRoom;
  meId: string;
}

export function ActiveRound({ room, meId }: Props) {
  const [word, setWord] = useState<string>("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const start = room.round?.start ?? room.constraints.start;
  const end = room.round?.end ?? room.constraints.end;
  const startedAt = room.round?.startedAt ?? null;

  useEffect(() => {
    inputRef.current?.focus();
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
    const socket = getSocket();
    socket.emit("submit_word", { roomId: room.id, word: value }, (res) => {
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

  return (
    <div className="grid gap-6">
      <section className="panel p-6 text-center">
        <div className="label">Bridge it</div>
        <div className="mt-3 flex items-center justify-center gap-3 font-mono text-3xl sm:text-4xl">
          <span className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 uppercase text-accent">
            {start}
          </span>
          <span className="text-muted">…</span>
          <span className="rounded-xl border border-accent2/40 bg-accent2/10 px-4 py-2 uppercase text-accent2">
            {end}
          </span>
        </div>
        <div className="mt-3 font-mono text-xs text-muted">
          {(elapsedMs / 1000).toFixed(2)}s
        </div>
      </section>

      <section className="panel p-5">
        <label className="label">Your answer</label>
        <div className="mt-2 flex gap-2">
          <input
            ref={inputRef}
            className="input flex-1 font-mono text-lg lowercase"
            value={word}
            onChange={(e) => setWord(e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={`${start}…${end}`}
            autoFocus
            maxLength={40}
          />
          <button className="btn-primary h-12 px-6" onClick={submit} disabled={submitting}>
            Submit
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              feedback.tone === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <p className="mt-3 text-xs text-muted">
          Word must start with <span className="font-mono text-text">{start}</span> and end with{" "}
          <span className="font-mono text-text">{end}</span>.
        </p>
      </section>

      {otherPlayers.length > 0 && (
        <section className="panel p-5">
          <div className="label mb-3">Racers</div>
          <div className="flex flex-wrap gap-2">
            {otherPlayers.map((p) => (
              <span key={p.id} className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {p.name}
              </span>
            ))}
          </div>
        </section>
      )}
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
    default:
      return "Not valid.";
  }
}
