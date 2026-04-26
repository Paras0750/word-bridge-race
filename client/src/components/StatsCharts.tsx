"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Player, RoundHistoryEntry } from "@/lib/types";

interface Props {
  players: Player[];
  history: RoundHistoryEntry[];
}

const PALETTE = [
  "#fafafa",
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#27272a",
  "#d4d4d8",
  "#e4e4e7",
  "#f4f4f5",
  "#18181b",
];

export function StatsCharts({ players, history }: Props) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players],
  );
  const colorOf: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    sorted.forEach((p, i) => {
      map[p.id] = PALETTE[i % PALETTE.length] ?? "#fafafa";
    });
    return map;
  }, [sorted]);

  const scoreData = useMemo(() => {
    const rows: Array<Record<string, number>> = [{ round: 0 }];
    for (const p of sorted) (rows[0] as Record<string, number>)[p.name] = 0;
    for (const r of history) {
      const prev = rows[rows.length - 1] ?? rows[0]!;
      const next: Record<string, number> = { round: r.index };
      for (const p of sorted) {
        const after = r.scoresAfter.find((s) => s.id === p.id);
        next[p.name] = after?.score ?? prev[p.name] ?? 0;
      }
      rows.push(next);
    }
    return rows;
  }, [history, sorted]);

  const winsData = useMemo(() => {
    return sorted.map((p) => ({
      name: p.name,
      wins: history.filter((r) => r.winnerId === p.id).length,
      cheats: history.filter((r) => r.cheaterIds.includes(p.id)).length,
    }));
  }, [history, sorted]);

  const hasAnyWin = winsData.some((w) => w.wins > 0);

  return (
    <div className="grid gap-4">
      {history.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score progression</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="round"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tick={{ fill: "var(--muted-foreground)" }}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 11,
                    color: "var(--foreground)",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                />
                {sorted.map((p) => (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.name}
                    stroke={colorOf[p.id] ?? "#fafafa"}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasAnyWin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Wins per player</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={Math.max(160, winsData.length * 32 + 24)}>
              <BarChart
                data={winsData}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: -8 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tick={{ fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tick={{ fill: "var(--muted-foreground)" }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 11,
                    color: "var(--foreground)",
                  }}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="wins"
                  fill="var(--foreground)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
