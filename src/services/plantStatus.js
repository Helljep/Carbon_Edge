// Real machines shown on the dashboard. Each is backed by a recorded real dataset.
export const REAL_MACHINES = [
  { id: 'bearing', title: 'Bearing Test Rig', group: 'Rotating machinery', source: 'NASA IMS run-to-failure vibration data' },
  { id: 'hydraulic', title: 'Hydraulic Rig', group: 'Rotating machinery', source: 'ZeMA hydraulic test rig (UCI #447)' },
  { id: 'energy', title: 'Steel Plant Energy', group: 'Plant', source: 'UCI steel industry energy data (2018)' },
  { id: 'plant', title: 'Electronics Plant (HIPE)', group: 'Plant', source: 'HIPE smart-meter data, 1 week, KIT Germany (2017)' },
];

export const DEFAULT_MACHINE = 'bearing';

export const LEVEL_COLOR = {
  ok: 'var(--color-success)',
  warn: 'var(--color-warning)',
  error: 'var(--color-error)',
  idle: 'rgba(255,255,255,0.3)',
};

const HEALTHY = { cooler: 100, valve: 100, pump_leak: 0, accumulator: 130 };
const COMP_LABEL = { cooler: 'cooler', valve: 'valve', pump_leak: 'pump leakage', accumulator: 'accumulator' };

export const degradedComponents = (m) =>
  Object.keys(HEALTHY).filter((k) => m[`pred_${k}`] !== HEALTHY[k]).map((k) => COMP_LABEL[k]);

/** Current status of a machine, from its latest real-data message. */
export function machineStatus(id, feeds) {
  const m = feeds[id]?.latest;
  if (!m) return { level: 'idle', text: 'Waiting for data' };
  if (id === 'bearing') {
    if (m.status === 'FAULT') return { level: 'error', text: 'Fault detected' };
    if (m.status === 'WATCH') return { level: 'warn', text: 'Watch' };
    return { level: 'ok', text: 'Healthy' };
  }
  if (id === 'hydraulic') {
    const n = degradedComponents(m).length;
    if (n === 0) return { level: 'ok', text: 'No degradation diagnosed' };
    return { level: n >= 2 ? 'error' : 'warn', text: `${n} component${n > 1 ? 's' : ''} degraded (model)` };
  }
  if (id === 'energy') {
    return m.high ? { level: 'warn', text: 'Unexpectedly high usage' } : { level: 'ok', text: 'Within expected range' };
  }
  if (id === 'plant') {
    return m.high ? { level: 'warn', text: 'Above weekday baseline' } : { level: 'ok', text: m.idle ? 'Within baseline (machines idle)' : 'Within baseline' };
  }
  return { level: 'idle', text: '' };
}

/** Change of a numeric series over the last `lag` samples (null if not enough history). */
export function delta(hist, pick, lag = 10) {
  if (!hist || hist.length <= lag) return null;
  const a = pick(hist[hist.length - 1]);
  const b = pick(hist[hist.length - 1 - lag]);
  return a == null || b == null ? null : a - b;
}
