/* eslint-disable no-console */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const COLORS: Record<Level, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

const isProd = process.env.NODE_ENV === "production";
const minLevel: Level =
  (process.env.LOG_LEVEL as Level | undefined) ?? (isProd ? "info" : "debug");

function shouldLog(level: Level): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

type Ctx = Record<string, unknown> | undefined;

function emit(level: Level, event: string, ctx: Ctx): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  if (isProd) {
    console.log(JSON.stringify({ ts, level, event, ...(ctx ?? {}) }));
    return;
  }
  const color = COLORS[level];
  const tag = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
  const ctxStr = ctx
    ? " " + DIM + JSON.stringify(ctx) + RESET
    : "";
  console.log(`${DIM}${ts}${RESET} ${tag} ${event}${ctxStr}`);
}

export const log = {
  debug: (event: string, ctx?: Ctx) => emit("debug", event, ctx),
  info: (event: string, ctx?: Ctx) => emit("info", event, ctx),
  warn: (event: string, ctx?: Ctx) => emit("warn", event, ctx),
  error: (event: string, ctx?: Ctx) => emit("error", event, ctx),
};

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
