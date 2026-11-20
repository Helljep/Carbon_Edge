import { createContext, useContext } from 'react';

const BASE_WS = import.meta.env.VITE_KILN_WS_URL || 'ws://localhost:8000/ws';
export const wsUrl = (suffix) => BASE_WS.replace(/\/ws\/?$/, '') + suffix;

export const PHASE_LABEL = {
  idle: 'Ready',
  connecting: 'Connecting…',
  running: 'Streaming',
  done: 'Run complete – restarting',
  error: 'Backend not reachable – start it with: python -m uvicorn app:app --port 8000 (in mlmodel/)',
};

export const EMPTY = { phase: 'idle', latest: null, hist: [], stats: { n: 0, ok: {}, flagged: 0 } };
export const EMPTY_FEEDS = { bearing: EMPTY, hydraulic: EMPTY, energy: EMPTY, plant: EMPTY };

export const RealPlantContext = createContext({
  feeds: EMPTY_FEEDS,
  restart: () => {},
  alerts: [],
  lastMessageAt: null,
  ackAlert: () => {},
  deleteAlert: () => {},
  clearAlerts: () => {},
});

export const useRealPlant = () => useContext(RealPlantContext);
