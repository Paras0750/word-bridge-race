"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenIcon, CodeIcon, GlobeIcon, MinusIcon, PawPrintIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import {
  SETTINGS_BOUNDS,
  WORD_LIST_IDS,
  WORD_LIST_META,
  type PublicRoom,
  type RoomSettings,
  type WordListId,
} from "@/lib/types";

interface Props {
  room: PublicRoom;
  isHost: boolean;
}

type TimingKey = Exclude<keyof RoomSettings, "wordListId">;

const WORD_LIST_ICONS: Record<WordListId, typeof BookOpenIcon> = {
  dictionary: BookOpenIcon,
  pets: PawPrintIcon,
  atlas: GlobeIcon,
  coding: CodeIcon,
};

const PRESETS: Array<{
  id: "fast" | "standard" | "chill";
  label: string;
  hint: string;
  values: Pick<RoomSettings, TimingKey>;
}> = [
  {
    id: "fast",
    label: "Fast",
    hint: "30s rounds",
    values: {
      pickTimeoutSeconds: 8,
      countdownSeconds: 3,
      roundMaxSeconds: 30,
      scoreboardSeconds: 5,
      maxRounds: 10,
    },
  },
  {
    id: "standard",
    label: "Standard",
    hint: "90s rounds",
    values: {
      pickTimeoutSeconds: 15,
      countdownSeconds: 5,
      roundMaxSeconds: 90,
      scoreboardSeconds: 10,
      maxRounds: 20,
    },
  },
  {
    id: "chill",
    label: "Chill",
    hint: "3 min rounds",
    values: {
      pickTimeoutSeconds: 30,
      countdownSeconds: 5,
      roundMaxSeconds: 180,
      scoreboardSeconds: 15,
      maxRounds: 20,
    },
  },
];

const FIELDS: Array<{
  key: TimingKey;
  label: string;
  desc: string;
  step: number;
  unit: string;
}> = [
  { key: "maxRounds", label: "Game length", desc: "rounds total", step: 1, unit: "" },
  { key: "pickTimeoutSeconds", label: "Pick time", desc: "per picker", step: 1, unit: "s" },
  { key: "countdownSeconds", label: "Countdown", desc: "before round", step: 1, unit: "s" },
  { key: "roundMaxSeconds", label: "Round limit", desc: "auto-end", step: 15, unit: "s" },
  { key: "scoreboardSeconds", label: "Pause", desc: "between rounds", step: 1, unit: "s" },
];

function settingsMatch(a: RoomSettings, b: Pick<RoomSettings, TimingKey>): boolean {
  return (
    a.pickTimeoutSeconds === b.pickTimeoutSeconds &&
    a.countdownSeconds === b.countdownSeconds &&
    a.roundMaxSeconds === b.roundMaxSeconds &&
    a.scoreboardSeconds === b.scoreboardSeconds &&
    a.maxRounds === b.maxRounds
  );
}

export function SettingsPanel({ room, isHost }: Props) {
  const [draft, setDraft] = useState<RoomSettings>(room.settings);
  const [busyKey, setBusyKey] = useState<TimingKey | "preset" | "wordList" | null>(null);

  useEffect(() => {
    setDraft(room.settings);
  }, [room.settings]);

  const activePreset = useMemo(() => {
    return PRESETS.find((p) => settingsMatch(draft, p.values))?.id ?? null;
  }, [draft]);

  const apply = (next: RoomSettings, busy: TimingKey | "preset" | "wordList"): void => {
    setDraft(next);
    if (!isHost) return;
    setBusyKey(busy);
    getSocket().emit(
      "set_settings",
      { roomId: room.id, settings: next },
      () => {
        setBusyKey(null);
      },
    );
  };

  const setOne = (key: TimingKey, value: number): void => {
    const bounds = SETTINGS_BOUNDS[key];
    const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
    if (clamped === draft[key]) return;
    apply({ ...draft, [key]: clamped }, key);
  };

  const choosePreset = (id: (typeof PRESETS)[number]["id"]): void => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    apply({ ...draft, ...preset.values }, "preset");
  };

  const chooseWordList = (wordListId: WordListId): void => {
    if (wordListId === draft.wordListId) return;
    apply({ ...draft, wordListId }, "wordList");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em]">
            <Settings2Icon className="size-3.5" />
            Game settings
          </span>
          {!isHost && (
            <Badge variant="outline" className="rounded text-[10px]">
              host only
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-[0.18em]">
              Word list
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {WORD_LIST_IDS.map((id) => {
                const meta = WORD_LIST_META[id];
                const Icon = WORD_LIST_ICONS[id];
                const active = draft.wordListId === id;
                return (
                  <button
                    key={id}
                    onClick={() => chooseWordList(id)}
                    disabled={!isHost || busyKey === "wordList"}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-xs transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span className="text-muted-foreground text-center text-[10px] leading-tight">
                      {meta.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {WORD_LIST_META[draft.wordListId].detail && (
              <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                {WORD_LIST_META[draft.wordListId].detail}
              </p>
            )}
          </div>

          <div className="bg-border h-px" />

          <div>
            <p className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-[0.18em]">
              Pace
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => {
                const active = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => choosePreset(p.id)}
                    disabled={!isHost || busyKey === "preset"}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-xs transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            {!activePreset && (
              <p className="text-muted-foreground mt-2 text-[10px]">
                Custom · adjust below
              </p>
            )}
          </div>

          <div className="bg-border h-px" />

          <div className="flex flex-col gap-2">
            {FIELDS.map((f) => {
              const bounds = SETTINGS_BOUNDS[f.key];
              const value = draft[f.key];
              const atMin = value <= bounds.min;
              const atMax = value >= bounds.max;
              const busy = busyKey === f.key || busyKey === "preset";
              return (
                <div
                  key={f.key}
                  className="bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{f.label}</p>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-none">
                      {f.desc}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-md"
                      disabled={!isHost || atMin || busy}
                      onClick={() => setOne(f.key, value - f.step)}
                      aria-label={`decrease ${f.label}`}
                    >
                      <MinusIcon className="size-3" />
                    </Button>
                    <span className="w-12 text-center font-mono text-sm font-semibold tabular-nums">
                      {value}
                      {f.unit && (
                        <span className="text-muted-foreground ml-0.5 text-[10px]">
                          {f.unit}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-md"
                      disabled={!isHost || atMax || busy}
                      onClick={() => setOne(f.key, value + f.step)}
                      aria-label={`increase ${f.label}`}
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
