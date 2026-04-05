import { useEffect, useRef, useState, useCallback } from 'react';

export interface WSEvent {
  type: string;
  [key: string]: unknown;
}

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const event = JSON.parse(e.data) as WSEvent;
      setEvents(prev => [...prev, event]);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
