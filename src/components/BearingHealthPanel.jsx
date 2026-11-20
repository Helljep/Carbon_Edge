import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import NeonCard from './NeonCard';
import { useRealPlant, PHASE_LABEL } from '../services/realPlantContext';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Tooltip, Legend);

const STATUS_COLOR = { HEALTHY: '#26e5a2', WATCH: '#fbbf24', FAULT: '#ef4444' };

/**
 * Live health of a real bearing: NASA IMS run-to-failure vibration data,
 * replayed through the trained anomaly model by the backend (/ws/bearing).
 */
export default function BearingHealthPanel() {
  const { feeds, restart } = useRealPlant();
  const { phase, latest, hist } = feeds.bearing;

  const status = latest?.status || 'HEALTHY';
  const color = STATUS_COLOR[status];

  const chartData = {
    labels: hist.map((p) => p.index),
    datasets: [
      {
        label: 'Anomaly score',
        data: hist.map((p) => p.error),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Alarm threshold',
        data: hist.map((p) => p.threshold),
        borderColor: '#94a3b8',
        borderDash: [6, 4],
        borderWidth: 1,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: {
        type: 'category',
        ticks: { color: '#64748b', maxTicksLimit: 8 },
        grid: { color: '#334155' },
        title: { display: true, text: 'Snapshot (10 min apart)', color: '#64748b' },
      },
      y: {
        type: 'logarithmic',
        ticks: { color: '#64748b' },
        grid: { color: '#334155' },
        title: { display: true, text: 'Anomaly score (log)', color: '#64748b' },
      },
    },
  };

  return (
    <NeonCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>Real Bearing Health (NASA IMS run-to-failure)</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Recorded vibration from a bearing that failed after ~164 h, replayed through the trained model. {PHASE_LABEL[phase]}
          </div>
        </div>
        <button
          onClick={() => restart('bearing')}
          style={{ background: '#26e5a2', color: '#04130d', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
        >
          Restart replay
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="Status" value={status} color={color} />
        <Stat label="Snapshot" value={latest ? `${latest.index + 1} / ${latest.total}` : '—'} />
        <Stat label="Vibration RMS" value={latest ? latest.rms.toFixed(4) : '—'} />
        <Stat label="Kurtosis" value={latest ? latest.kurtosis.toFixed(2) : '—'} />
        <Stat label="Hours to end of run" value={latest ? latest.hours_to_end_of_run : '—'} />
        <Stat
          label="Warning lead time"
          value={latest?.lead_hours != null ? `${latest.lead_hours} h before failure` : 'no alarm yet'}
          color={latest?.lead_hours != null ? '#fbbf24' : undefined}
        />
      </div>

      <div style={{ width: '100%', height: 280 }}>
        <Line options={options} data={chartData} />
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
