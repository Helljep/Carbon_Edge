import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_WS = import.meta.env.VITE_KILN_WS_URL || 'ws://localhost:8000/ws';

export const wsUrl = (suffix) => BASE_WS.replace(/\/ws\/?$/, '') + suffix;

/**
 * Connects to a replay WebSocket and hands every message to `onMessage`.
 * phase: idle | connecting | running | done | error
 */
export default function useReplaySocket(path, interval, onMessage, onReset) {
  const [phase, setPhase] = useState('idle');
  const socketRef = useRef(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const stop = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    if (onReset) onReset();
    setPhase('connecting');
    let ws;
    try {
      ws = new WebSocket(`${wsUrl(path)}?interval=${interval}`);
    } catch {
      setPhase('error');
      return;
    }
    socketRef.current = ws;
    ws.onopen = () => setPhase('running');
    ws.onerror = () => setPhase('error');
    ws.onclose = () => setPhase((p) => (p === 'running' || p === 'connecting' ? 'error' : p));
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'done') setPhase('done');
      else if (m.type === 'error') setPhase('error');
      else handlerRef.current(m);
    };
  }, [path, interval, onReset, stop]);

  useEffect(() => stop, [stop]);

  return { phase, start };
}

export const PHASE_LABEL = {
  idle: 'Ready',
  connecting: 'Connecting…',
  running: 'Streaming',
  done: 'Run complete',
  error: 'Backend not reachable – start it with: python -m uvicorn app:app --port 8000 (in mlmodel/)',
};
