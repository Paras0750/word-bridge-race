"use client";

import { useEffect, useState } from "react";
import { Settings2Icon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSocket } from "@/lib/socket";
import { SETTINGS_BOUNDS, type PublicRoom, type RoomSettings } from "@/lib/types";

interface Props {
  room: PublicRoom;
  isHost: boolean;
}

const FIELDS: Array<{
  key: keyof RoomSettings;
  label: string;
  desc: string;
}> = [
  {
    key: "pickTimeoutSeconds",
    label: "Letter pick time",
    desc: "Per picker",
  },
  {
    key: "countdownSeconds",
    label: "Countdown",
    desc: "Pre-round",
  },
  {
    key: "roundMaxSeconds",
    label: "Round limit",
    desc: "Auto-end if no one solves",
  },
  {
    key: "scoreboardSeconds",
    label: "Between rounds",
    desc: "Scoreboard pause",
  },
];

export function SettingsPanel({ room, isHost }: Props) {
  const [draft, setDraft] = useState<RoomSettings>(room.settings);
  const [saving, setSaving] = useState<keyof RoomSettings | null>(null);

  useEffect(() => {
    setDraft(room.settings);
  }, [room.settings]);

  const update = (key: keyof RoomSettings, value: number): void => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const commit = (key: keyof RoomSettings, value: number): void => {
    if (value === room.settings[key]) return;
    setSaving(key);
    getSocket().emit(
      "set_settings",
      { roomId: room.id, settings: { [key]: value } as Partial<RoomSettings> },
      () => {
        setSaving(null);
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
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
          {FIELDS.map((f) => {
            const bounds = SETTINGS_BOUNDS[f.key];
            const value = draft[f.key];
            return (
              <div key={f.key} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.label}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {f.desc}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-1.5">
                    {saving === f.key && (
                      <span className="text-muted-foreground text-[10px]">
                        saving…
                      </span>
                    )}
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {value}
                      <span className="text-muted-foreground ml-0.5 text-xs">s</span>
                    </span>
                  </div>
                </div>
                <Slider
                  value={value}
                  min={bounds.min}
                  max={bounds.max}
                  step={1}
                  disabled={!isHost}
                  onValueChange={(v) => update(f.key, v)}
                  onValueCommitted={(v) => isHost && commit(f.key, v)}
                />
                <div className="text-muted-foreground/70 flex justify-between font-mono text-[10px] tabular-nums">
                  <span>{bounds.min}s</span>
                  <span>{bounds.max}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
