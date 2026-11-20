import React from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import NeonCard from './NeonCard';
import { useRealPlant, PHASE_LABEL } from '../services/realPlantContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const MACHINE_COLORS = ['#00E5FF', '#FFB300', '#A78BFA', '#EF4444', '#26e5a2', '#F472B6'];

/**
 * Real smart-meter data (HIPE, KIT Germany, Oct 2017): plant main meter, 10 sub-metered machines.
 * Expected power is a weekday profile the mean of the same time in the last two weeks.
 * Flags are relative to that baseline; the dataset has no fault or waste labels.
 */
export default function PlantBaseLoadPanel() {
  const { feeds, restart } = useRealPlant();
  const { phase, latest, hist, stats } = feeds.plant;
  const isLive = import.meta.env.VITE_PLANT_SOURCE === 'live';

  const data = {
    labels: hist.map((p) => p.time.slice(5, 16)),
    datasets: [
      { label: 'Main meter kW', data: hist.map((p) => p.main_kw), borderColor: '#26e5a2', backgroundColor: 'rgba(38,229,162,0.12)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: 'Expected kW (weekday baseline)', data: hist.map((p) => p.expected_kw), borderColor: '#94a3b8', borderDash: [6, 4], borderWidth: 1, pointRadius: 0 },
      { label: 'Base load kW', data: hist.map((p) => p.base_kw), borderColor: '#FFB300', borderWidth: 1, pointRadius: 0 },
      { label: 'Sub-metered machines kW', data: hist.map((p) => p.metered_kw), borderColor: '#00E5FF', borderWidth: 1.5, pointRadius: 0 },
      { label: 'Above baseline', data: hist.map((p) => (p.high ? p.main_kw : null)), borderColor: '#ef4444', backgroundColor: '#ef4444', showLine: false, pointRadius: 4 },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { color: '#334155' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#334155' }, title: { display: true, text: 'kW (15-min mean)', color: '#64748b' } },
    },
  };

  const active = latest
    ? Object.entries(latest.machines).filter(([, kw]) => kw > 0.05).sort((a, b) => b[1] - a[1])
    : [];
  const baseShare = latest && latest.cum_kwh > 0 ? (latest.cum_base_kwh / latest.cum_kwh) * 100 : null;
  const idleShare = latest && latest.cum_kwh > 0 ? (latest.cum_idle_kwh / latest.cum_kwh) * 100 : null;

  return (
    <NeonCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
            {isLive ? 'Live Plant Meters (MQTT)' : 'Real Plant Meters (electronics plant, HIPE 2017)'}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {isLive
              ? 'Readings arrive over MQTT. The baseline is the mean of the same time in the previous two weeks; it shows "learning" until the plant has enough of its own history, and it never flags before that. No fault labels exist. '
              : 'Three recorded months, 10 sub-metered machines plus the main meter. The baseline is the mean of the same time in the previous two weeks, tested on December; no fault labels exist. '}
            {PHASE_LABEL[phase]}
          </div>
        </div>
        <button
          onClick={() => restart('plant')}
          style={{ background: '#26e5a2', color: '#04130d', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
        >
          Restart replay
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="Time" value={latest ? `${latest.weekday} ${latest.time.slice(5, 16)}` : '—'} />
        <Stat label="Data split" value={latest ? latest.split : '—'} color={latest && latest.split === 'test' ? '#26e5a2' : undefined} />
        <Stat label="Main meter" value={latest ? `${latest.main_kw.toFixed(1)} kW` : '—'} />
        <Stat label="Metered machines" value={latest ? `${latest.metered_kw.toFixed(1)} kW` : '—'} />
        <Stat label="Unmetered" value={latest ? `${latest.unmetered_kw.toFixed(1)} kW` : '—'} />
        <Stat label="Base load share" value={baseShare == null ? '—' : `${baseShare.toFixed(0)}%`} color="#FFB300" />
        <Stat label="Used while machines idle" value={idleShare == null ? '—' : `${idleShare.toFixed(0)}%`} />
        <Stat label="Flagged intervals" value={latest ? stats.flagged : '—'} color={stats.flagged ? '#fbbf24' : undefined} />
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <Line options={options} data={data} />
      </div>

      {latest && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
          Running now:{' '}
          {active.length === 0
            ? 'no sub-metered machine above 0.05 kW'
            : active.map(([n, kw], i) => (
              <span key={n} style={{ color: MACHINE_COLORS[i % MACHINE_COLORS.length], marginRight: 10 }}>{n} {kw.toFixed(2)} kW</span>
            ))}
        </div>
      )}
    </NeonCard>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || '#e2e8f0' }}>{value}</div>
    </div>
  );
}
