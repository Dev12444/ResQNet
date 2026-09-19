"use client";

export type WsEvent = {
  type: string;
  payload?: unknown;
};

export function createResQWebSocket(onEvent: (event: WsEvent) => void) {
  const url = process.env.NEXT_PUBLIC_WS_URL;
  if (!url) return () => undefined;

  const socket = new WebSocket(url);
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as WsEvent);
    } catch {
      // Ignore malformed events so the dashboard stays usable.
    }
  };

  return () => socket.close();
}
