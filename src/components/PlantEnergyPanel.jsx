import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import NeonCard from './NeonCard';
import { useRealPlant, PHASE_LABEL } from '../services/realPlantContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/**
 * Real steel-plant energy data (UCI #851, South Korea, 2018). Replays held-out Oct-Dec
 * readings against an expected-usage baseline learned from Jan-Sep calendar patterns.
 * "Unexpectedly high" is relative to that baseline; it is not a confirmed waste label.
 */
export default function PlantEnergyPanel() {
  const { feeds, restart } = useRealPlant();
  const { phase, latest, hist, stats } = feeds.energy;

  const data = {
    labels: hist.map((p) => p.date.slice(5, 16)),
    datasets: [
      { label: 'Actual kWh', data: hist.map((p) => p.kwh), borderColor: '#26e5a2', borderWidth: 2, pointRadius: 0, tension: 0.2 },
      { label: 'Expected kWh (baseline)', data: hist.map((p) => p.expected), borderColor: '#94a3b8', borderDash: [6, 4], borderWidth: 1, pointRadius: 0 },
      {
        label: 'Unexpectedly high', data: hist.map((p) => (p.high ? p.kwh : null)), borderColor: '#ef4444', backgroundColor: '#ef4444',
        showLine: false, pointRadius: 4,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { color: '#334155' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#334155' }, title: { display: true, text: 'kWh per 15 min', color: '#64748b' } },
    },
  };

  return (
    <NeonCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>Real Plant Energy &amp; CO₂ (steel plant, 2018)</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Held-out Oct–Dec readings vs an expected-usage baseline. CO₂ is derived from kWh in this dataset. {PHASE_LABEL[phase]}
          </div>
        </div>
        <button
          onClick={() => restart('energy')}
          style={{ background: '#26e5a2', color: '#04130d', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
        >
          Restart replay
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="Time" value={latest ? latest.date.slice(0, 16) : '—'} />
        <Stat label="Energy so far" value={latest ? `${latest.cum_kwh.toLocaleString()} kWh` : '—'} />
        <Stat label="CO₂ so far" value={latest ? `${latest.cum_tco2} t` : '—'} />
        <Stat label="Flagged intervals" value={latest ? stats.flagged : '—'} color={stats.flagged ? '#fbbf24' : undefined} />
        <Stat label="Unexpected excess" value={latest ? `${latest.cum_excess_kwh.toLocaleString()} kWh` : '—'} color={latest && latest.cum_excess_kwh ? '#fbbf24' : undefined} />
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <Line options={options} data={data} />
      </div>
    </NeonCard>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#e2e8f0' }}>{value}</div>
    </div>
  );
}
