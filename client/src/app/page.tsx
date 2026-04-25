"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Loader2Icon, PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSocket } from "@/lib/socket";
import { getOrCreatePlayerId } from "@/lib/identity";

const NAME_KEY = "wbr.name";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
    const fromQuery = new URLSearchParams(window.location.search).get("room");
    if (fromQuery) {
      const cleaned = fromQuery.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (cleaned) setRoomCode(cleaned);
    }
  }, []);

  const persistName = (value: string): void => {
    setName(value);
    if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, value);
  };

  const handleCreate = (): void => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setBusy(true);
    setError("");
    getSocket().emit(
      "create_room",
      { name: name.trim(), playerId: getOrCreatePlayerId() },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/room/${res.data.roomId}`);
      },
    );
  };

  const handleJoin = (): void => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (roomCode.trim().length !== 6) {
      setError("Room code is 6 characters");
      return;
    }
    setBusy(true);
    setError("");
    getSocket().emit(
      "join_room",
      {
        roomId: roomCode.trim().toUpperCase(),
        name: name.trim(),
        playerId: getOrCreatePlayerId(),
      },
      (res) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/room/${res.data.room.id}`);
      },
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg sm:py-16">
      <div className="mb-8 sm:mb-10">
        <div className="text-muted-foreground mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em]">
          <SparklesIcon className="size-3" />
          Word Bridge Race
        </div>
        <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          Bridge two letters. Fastest word wins.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-sm">
          Type a real word that starts with one letter and ends with another. First valid
          answer takes the round.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="player-name" className="text-xs font-medium">
            Display name
          </Label>
          <Input
            id="player-name"
            value={name}
            onChange={(e) => persistName(e.target.value)}
            placeholder="e.g. Paras"
            maxLength={20}
            autoComplete="given-name"
            className="h-10"
          />
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.25em]">
            choose
          </span>
          <div className="bg-border h-px flex-1" />
        </div>

        <Button
          size="lg"
          className="h-11 w-full text-sm font-medium"
          onClick={handleCreate}
          disabled={busy}
        >
          {busy ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          {busy ? "Creating…" : "Create new room"}
        </Button>

        <div className="my-4 flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.25em]">
            or join
          </span>
          <div className="bg-border h-px flex-1" />
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
        >
          <Input
            value={roomCode}
            onChange={(e) =>
              setRoomCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z2-9]/g, "")
                  .slice(0, 6),
              )
            }
            placeholder="ROOM CODE"
            maxLength={6}
            enterKeyHint="go"
            inputMode="text"
            autoCapitalize="characters"
            className="h-11 flex-1 text-center font-mono text-base uppercase tracking-[0.3em]"
          />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="h-11 px-4"
            disabled={busy}
          >
            {busy ? "Joining…" : "Join"}
            {busy ? (
              <Loader2Icon data-icon="inline-end" className="animate-spin" />
            ) : (
              <ArrowRightIcon data-icon="inline-end" />
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        2–10 players · real-time · no signup
      </p>
    </main>
  );
}
