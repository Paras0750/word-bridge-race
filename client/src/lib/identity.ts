"use client";

const KEY = "wbr.playerId";

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    const cryptoObj =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto : null;
    id = cryptoObj
      ? cryptoObj.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
