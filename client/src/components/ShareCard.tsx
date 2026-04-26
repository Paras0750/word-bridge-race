"use client";

import { forwardRef } from "react";
import type { Player, PublicRoom } from "@/lib/types";

interface Props {
  room: PublicRoom;
}

const ShareCard = forwardRef<HTMLDivElement, Props>(({ room }, ref) => {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const totalCheats = room.roundHistory.reduce(
    (acc, r) => acc + r.cheaterIds.length,
    0,
  );
  const totalSkipped = room.roundHistory.filter((r) => r.skipped).length;
  const fastestWin = room.roundHistory
    .filter((r) => r.tookMs !== null)
    .sort((a, b) => (a.tookMs ?? 0) - (b.tookMs ?? 0))[0];
  const durationSec =
    room.gameStartedAt !== null && room.gameEndedAt !== null
      ? Math.floor((room.gameEndedAt - room.gameStartedAt) / 1000)
      : null;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1350,
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily:
          'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 64,
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#71717a",
              fontWeight: 500,
            }}
          >
            Word Bridge Race
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, marginTop: 8 }}>
            {room.name ?? "Game results"}
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "#71717a",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            letterSpacing: "0.25em",
          }}
        >
          {room.id}
        </div>
      </div>

      <div
        style={{
          background: "#111",
          border: "1px solid #262626",
          borderRadius: 16,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 16, color: "#71717a", letterSpacing: "0.25em", textTransform: "uppercase" }}>
          Champion
        </div>
        <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1 }}>
          {winner?.name ?? "—"}
        </div>
        <div style={{ fontSize: 32, color: "#fafafa", fontWeight: 600 }}>
          {winner?.score ?? 0} pts
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Stat label="Rounds" value={room.roundsPlayed} />
        <Stat
          label="Duration"
          value={durationSec !== null ? `${Math.floor(durationSec / 60)} min` : "—"}
        />
        <Stat label="Skipped" value={totalSkipped} />
        <Stat label="Cheats" value={totalCheats} />
      </div>

      <div
        style={{
          background: "#111",
          border: "1px solid #262626",
          borderRadius: 16,
          padding: 28,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, color: "#71717a", letterSpacing: "0.25em", textTransform: "uppercase" }}>
          Standings
        </div>
        {sorted.slice(0, 6).map((p, idx) => (
          <StandingRow key={p.id} player={p} rank={idx + 1} />
        ))}
        {fastestWin && (
          <div
            style={{
              marginTop: 8,
              fontSize: 16,
              color: "#71717a",
              borderTop: "1px solid #262626",
              paddingTop: 12,
            }}
          >
            Fastest win:{" "}
            <span style={{ color: "#fafafa", fontFamily: "ui-monospace, monospace" }}>
              {fastestWin.word}
            </span>{" "}
            by {fastestWin.winnerName} in{" "}
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {((fastestWin.tookMs ?? 0) / 1000).toFixed(2)}s
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 16,
          color: "#52525b",
          textAlign: "center",
        }}
      >
        wordbridge.race · think fast, type faster
      </div>
    </div>
  );
});

ShareCard.displayName = "ShareCard";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 14, color: "#71717a", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StandingRow({ player, rank }: { player: Player; rank: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 4px",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: rank === 1 ? "rgba(234,179,8,0.2)" : "#1f1f1f",
          color: rank === 1 ? "#eab308" : "#71717a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontFamily: "ui-monospace, monospace",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1, fontSize: 22, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {player.name}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
          color: rank === 1 ? "#fafafa" : "#a1a1aa",
        }}
      >
        {player.score}
      </div>
    </div>
  );
}

export { ShareCard };
