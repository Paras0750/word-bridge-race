"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

let socketInstance: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socketInstance) return socketInstance;
  socketInstance = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function reconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance.connect();
  } else {
    getSocket();
  }
}
