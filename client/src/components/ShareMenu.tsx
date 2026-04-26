"use client";

import { useState } from "react";
import {
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  Share2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublicRoom } from "@/lib/types";

interface Props {
  room: PublicRoom;
  onDownload: () => Promise<void>;
  onShareImage: () => Promise<void>;
}

function buildShareText(room: PublicRoom): { text: string; url: string } {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const url =
    typeof window !== "undefined" ? window.location.origin : "wordbridge.race";
  const top3 = sorted
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${p.name} ${p.score}`)
    .join(" · ");
  const text = winner
    ? `Word Bridge Race · ${winner.name} took it. ${top3}. Try to beat us 👉`
    : `Word Bridge Race · ${room.roundsPlayed} rounds, no winner. Come do better 👉`;
  return { text, url };
}

export function ShareMenu({ room, onDownload, onShareImage }: Props) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const { text, url } = buildShareText(room);

  const tryNativeShare = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copyText();
      return;
    }
    setBusy("share");
    try {
      await onShareImage();
    } catch {
      try {
        await navigator.share({ title: "Word Bridge Race", text, url });
      } catch {
        // user cancelled or share failed
      }
    } finally {
      setBusy(null);
    }
  };

  const onTwitter = (): void => {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  const onWhatsApp = (): void => {
    const link = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const copyText = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleDownload = async (): Promise<void> => {
    setBusy("download");
    try {
      await onDownload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => void tryNativeShare()}
        disabled={busy !== null}
        className="h-10 flex-1 text-sm"
      >
        {busy === "share" ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <Share2Icon data-icon="inline-start" />
        )}
        Share
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleDownload()}
        disabled={busy !== null}
        className="h-10 flex-1 text-sm"
      >
        {busy === "download" ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        Download
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More share options"
          className="border-input bg-background hover:bg-muted text-foreground inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm"
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem onClick={onTwitter}>
            <XIcon className="size-3.5" />
            Share on X
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onWhatsApp}>
            <MessageCircleIcon className="size-3.5" />
            Share on WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyText()}>
            <CopyIcon className="size-3.5" />
            Copy text
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
