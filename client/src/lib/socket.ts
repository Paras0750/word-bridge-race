"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socketInstance) return socketInstance;
  const url = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
  socketInstance = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
  });
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
