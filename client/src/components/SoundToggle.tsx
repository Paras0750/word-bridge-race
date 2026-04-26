"use client";

import { useEffect, useState } from "react";
import { Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMuted, setMuted, sfx } from "@/lib/sound";

export function SoundToggle() {
  const [muted, setMutedState] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setMutedState(isMuted());
  }, []);

  if (!mounted) {
    return <div className="size-8" />;
  }

  const toggle = (): void => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) {
      sfx.unlock();
      sfx.tick();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sounds off" : "Sounds on"}
      className="text-muted-foreground hover:text-foreground"
    >
      {muted ? (
        <VolumeXIcon className="size-4" />
      ) : (
        <Volume2Icon className="size-4" />
      )}
    </Button>
  );
}
