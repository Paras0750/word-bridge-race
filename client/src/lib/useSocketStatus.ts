"use client";

import { useEffect, useState } from "react";
import { getSocket } from "./socket";

export type SocketStatus = "connecting" | "connected" | "reconnecting" | "failed";

export function useSocketStatus(): {
  status: SocketStatus;
  lastError: string | null;
} {
  const [status, setStatus] = useState<SocketStatus>(() => {
    if (typeof window === "undefined") return "connecting";
    return getSocket().connected ? "connected" : "connecting";
  });
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = (): void => {
      setStatus("connected");
      setLastError(null);
    };
    const onDisconnect = (): void => {
      setStatus((s) => (s === "connected" ? "reconnecting" : s));
    };
    const onConnectError = (err: Error): void => {
      setLastError(err.message);
      setStatus((s) => (s === "connected" ? "reconnecting" : s));
    };
    const onReconnectAttempt = (n: number): void => {
      if (n >= 3) setStatus("failed");
      else setStatus((s) => (s === "connected" ? "reconnecting" : s));
    };
    const onReconnect = (): void => {
      setStatus("connected");
      setLastError(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);

    if (socket.connected) setStatus("connected");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
    };
  }, []);

  return { status, lastError };
}
