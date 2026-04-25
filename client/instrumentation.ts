export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { slog } = await import("./src/lib/server-logger");

  slog.info("next.boot", {
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL ?? "(unset)",
    env: process.env.NODE_ENV ?? "dev",
    port: process.env.PORT ?? "3000",
    node: process.version,
  });

  process.on("uncaughtException", (err) => {
    slog.error("next.uncaughtException", {
      err: err.message,
      stack: err.stack,
    });
  });
  process.on("unhandledRejection", (reason) => {
    slog.error("next.unhandledRejection", { reason: String(reason) });
  });
}
