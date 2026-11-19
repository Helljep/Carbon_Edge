import React, { useCallback, useRef, useState } from 'react';
import NeonCard from './NeonCard';
import useReplaySocket, { PHASE_LABEL } from './useReplaySocket';

const COMPONENTS = [
  { key: 'cooler', label: 'Cooler (efficiency %)' },
  { key: 'valve', label: 'Valve (switching %)' },
  { key: 'pump_leak', label: 'Pump leakage (0/1/2)' },
  { key: 'accumulator', label: 'Accumulator (bar)' },
];

/**
 * Real hydraulic test rig (ZeMA, UCI #447). Replays 2,205 recorded 60 s cycles; the diagnosis
 * shown for each cycle is an OUT-OF-FOLD prediction (the model never saw that cycle's run).
 */
export default function HydraulicDiagnosisPanel() {
  const [latest, setLatest] = useState(null);
  const [acc, setAcc] = useState({});
  const stats = useRef({ n: 0, ok: {} });

  const onReset = useCallback(() => {
    stats.current = { n: 0, ok: {} };
    setLatest(null);
    setAcc({});
  }, []);

  const onMessage = useCallback((m) => {
    const s = stats.current;
    s.n += 1;
    COMPONENTS.forEach(({ key }) => { s.ok[key] = (s.ok[key] || 0) + (m[`ok_${key}`] ? 1 : 0); });
    setLatest(m);
    const next = {};
    COMPONENTS.forEach(({ key }) => { next[key] = s.ok[key] / s.n; });
    setAcc(next);
  }, []);

  const { phase, start } = useReplaySocket('/ws/hydraulic', 0.03, onMessage, onReset);

  return (
    <NeonCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>Real Hydraulic Rig Diagnosis (ZeMA)</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Recorded rig cycles, diagnosed by a model that never saw the cycle&apos;s run. {PHASE_LABEL[phase]}
          </div>
        </div>
        <button
          onClick={start}
          style={{ background: '#26e5a2', color: '#04130d', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
        >
          {phase === 'idle' ? 'Start replay' : 'Restart'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8', margin: '12px 0 4px' }}>
        Cycle {latest ? `${latest.index + 1} / ${latest.total}` : '—'}
        {latest && ` · motor ${latest.EPS1_mean.toFixed(0)} W · oil temp ${latest.TS1_mean.toFixed(1)} °C · pressure ${latest.PS1_mean.toFixed(0)} bar`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 8 }}>
        {COMPONENTS.map(({ key, label }) => {
          const ok = latest ? latest[`ok_${key}`] : null;
          return (
            <div key={key} style={{ border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                actual <b style={{ color: '#e2e8f0' }}>{latest ? latest[`true_${key}`] : '—'}</b>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                model says <b style={{ color: ok === null ? '#e2e8f0' : ok ? '#26e5a2' : '#ef4444' }}>{latest ? latest[`pred_${key}`] : '—'}</b>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginTop: 6 }}>
                {acc[key] !== undefined ? `${(acc[key] * 100).toFixed(0)}%` : '—'}
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}> running accuracy</span>
              </div>
            </div>
          );
        })}
      </div>
    </NeonCard>
  );
}
