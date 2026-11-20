import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wsUrl, EMPTY, EMPTY_FEEDS, RealPlantContext } from './realPlantContext';
import { createAlertDetectors } from './alertRules';

// path = backend replay endpoint, interval = seconds per replayed sample, keep = history length
const STREAMS = {
  bearing: { path: '/ws/bearing', interval: 0.08, keep: 1000 },
  hydraulic: { path: '/ws/hydraulic', interval: 0.05, keep: 150 },
  energy: { path: '/ws/energy', interval: 0.02, keep: 192 },
};
const NAMES = Object.keys(STREAMS);
const COMPONENT_KEYS = ['cooler', 'valve', 'pump_leak', 'accumulator'];
const FLUSH_MS = 250;
const RESTART_MS = 4000;
const MAX_ALERTS = 100;

/**
 * One shared connection per real-data replay stream. Messages are accumulated in refs and
 * flushed to React state every 250 ms, so a fast stream does not re-render the page per message.
 */
export function RealPlantProvider({ enabled, children }) {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [alerts, setAlerts] = useState([]);
  const [lastMessageAt, setLastMessageAt] = useState(null);
  const alertsRef = useRef([]);
  const idRef = useRef(0);
  const detectors = useRef({});
  const lastMsgRef = useRef(null);
  const sockets = useRef({});
  const timers = useRef({});
  const live = useRef({});
  const dirty = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const fresh = () => ({ phase: 'idle', latest: null, hist: [], stats: { n: 0, ok: {}, flagged: 0 } });

  const handle = useCallback((name, m) => {
    const f = live.current[name];
    f.latest = m;
    f.hist.push(m);
    if (f.hist.length > STREAMS[name].keep) f.hist.shift();
    lastMsgRef.current = Date.now();
    if (name === 'hydraulic') {
      f.stats.n += 1;
      COMPONENT_KEYS.forEach((k) => { f.stats.ok[k] = (f.stats.ok[k] || 0) + (m[`ok_${k}`] ? 1 : 0); });
    } else if (name === 'energy' && m.high) {
      f.stats.flagged += 1;
    }
    const found = detectors.current[name] ? detectors.current[name].process(name, m, f.hist) : [];
    if (found.length) {
      const now = new Date();
      const made = found.map((a) => ({
        id: `${now.getTime()}-${idRef.current++}`,
        title: a.title,
        description: a.description,
        machine: a.machine,
        source: a.source,
        time: now.toLocaleTimeString(),
        timestamp: now,
        severity: a.severity,
        rootCause: a.rootCause,
        rootCauseDetail: a.rootCauseDetail,
        action: a.action,
        additionalActions: a.additionalActions || [],
        eventLog: a.log,
        chartTitle: a.chartTitle,
        rawData: { top_causes: a.topCauses || [] },
        acknowledged: false,
      }));
      alertsRef.current = [...made, ...alertsRef.current].slice(0, MAX_ALERTS);
    }
    dirty.current = true;
  }, []);

  const connect = useCallback((name) => {
    clearTimeout(timers.current[name]);
    const old = sockets.current[name];
    if (old) { old.onclose = null; old.onerror = null; old.close(); }
    live.current[name] = { ...fresh(), phase: 'connecting' };
    detectors.current[name] = createAlertDetectors();
    dirty.current = true;
    let ws;
    try {
      ws = new WebSocket(`${wsUrl(STREAMS[name].path)}?interval=${STREAMS[name].interval}`);
    } catch {
      live.current[name].phase = 'error';
      return;
    }
    sockets.current[name] = ws;
    const setPhase = (p) => { if (live.current[name]) { live.current[name].phase = p; dirty.current = true; } };
    ws.onopen = () => setPhase('running');
    ws.onerror = () => setPhase('error');
    ws.onclose = () => {
      const p = live.current[name]?.phase;
      if (p === 'running' || p === 'connecting') setPhase('error');
      if (enabledRef.current) timers.current[name] = setTimeout(() => connect(name), 5000);
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'done') {
        setPhase('done');
        timers.current[name] = setTimeout(() => enabledRef.current && connect(name), RESTART_MS);
      } else if (m.type === 'error') {
        setPhase('error');
      } else {
        handle(name, m);
      }
    };
  }, [handle]);

  const stopAll = useCallback(() => {
    NAMES.forEach((n) => {
      clearTimeout(timers.current[n]);
      const s = sockets.current[n];
      if (s) { s.onclose = null; s.onerror = null; s.close(); }
      sockets.current[n] = null;
    });
  }, []);

  useEffect(() => {
    if (enabled) NAMES.forEach(connect);
    else stopAll();
    return stopAll;
  }, [enabled, connect, stopAll]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      const next = {};
      NAMES.forEach((n) => {
        const f = live.current[n];
        next[n] = f
          ? { phase: f.phase, latest: f.latest, hist: f.hist.slice(), stats: { ...f.stats, ok: { ...f.stats.ok } } }
          : EMPTY;
      });
      setFeeds(next);
      setAlerts(alertsRef.current);
      setLastMessageAt(lastMsgRef.current);
    }, FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  const ackAlert = useCallback((id) => {
    alertsRef.current = alertsRef.current.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
    dirty.current = true;
  }, []);
  const deleteAlert = useCallback((id) => {
    alertsRef.current = alertsRef.current.filter((a) => a.id !== id);
    dirty.current = true;
  }, []);
  const clearAlerts = useCallback(() => {
    alertsRef.current = [];
    dirty.current = true;
  }, []);

  const value = useMemo(
    () => ({ feeds, restart: connect, alerts, lastMessageAt, ackAlert, deleteAlert, clearAlerts }),
    [feeds, connect, alerts, lastMessageAt, ackAlert, deleteAlert, clearAlerts],
  );
  return <RealPlantContext.Provider value={value}>{children}</RealPlantContext.Provider>;
}
