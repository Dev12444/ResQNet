"use client";

import { API_URL, USE_MOCK } from "./api";

/** Backend WebSocket envelope (API_CONTRACT §4): every message is {event, data, ts}. */
export type WsEvent = { event: string; data: unknown; ts: string };

/** ws(s)://<api>/ws, or NEXT_PUBLIC_WS_URL when the socket lives elsewhere. */
export function wsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? `${API_URL.replace(/^http/, "ws")}/ws`;
}

/**
 * Subscribe to live events with automatic reconnect (Render/Neon cold starts, venue Wi-Fi).
 * Returns an unsubscribe function. No-op in mock mode.
 */
export function createResQWebSocket(onEvent: (event: WsEvent) => void, onStatus?: (open: boolean) => void) {
  if (USE_MOCK || typeof window === "undefined") return () => undefined;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    socket = new WebSocket(wsUrl());
    socket.onopen = () => onStatus?.(true);
    socket.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as WsEvent);
      } catch {
        // Ignore malformed events so the dashboard stays usable.
      }
    };
    socket.onclose = () => {
      onStatus?.(false);
      if (!closed) retry = setTimeout(connect, 3000);
    };
  };
  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
