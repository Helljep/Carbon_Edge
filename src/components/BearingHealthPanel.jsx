import React, { useEffect, useRef, useState, useCallback } from 'react';
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

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Tooltip, Legend);

const BASE_WS = import.meta.env.VITE_KILN_WS_URL || 'ws://localhost:8000/ws';
const BEARING_WS = BASE_WS.replace(/\/ws\/?$/, '') + '/ws/bearing';

const STATUS_COLOR = { HEALTHY: '#26e5a2', WATCH: '#fbbf24', FAULT: '#ef4444' };

/**
 * Live health of a real bearing: NASA IMS run-to-failure vibration data,
 * replayed through the trained anomaly model by the backend (/ws/bearing).
 */
export default function BearingHealthPanel() {
  const [phase, setPhase] = useState('idle'); // idle | connecting | running | done | error
  const [points, setPoints] = useState([]);
  const [latest, setLatest] = useState(null);
  const [speed, setSpeed] = useState(0.1);
  const socketRef = useRef(null);
  const bufferRef = useRef([]);

  const stop = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    bufferRef.current = [];
    setPoints([]);
    setLatest(null);
    setPhase('connecting');
    let ws;
    try {
      ws = new WebSocket(`${BEARING_WS}?interval=${speed}`);
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
      if (m.type === 'bearing') {
        bufferRef.current.push(m);
        setPoints(bufferRef.current.slice());
        setLatest(m);
      } else if (m.type === 'done') {
        setPhase('done');
      } else if (m.type === 'error') {
        setPhase('error');
      }
    };
  }, [speed, stop]);

  useEffect(() => stop, [stop]);

  const status = latest?.status || 'HEALTHY';
  const color = STATUS_COLOR[status];

  const chartData = {
    labels: points.map((p) => p.index),
    datasets: [
      {
        label: 'Anomaly score',
        data: points.map((p) => p.error),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Alarm threshold',
        data: points.map((p) => p.threshold),
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

  const label = {
    idle: 'Ready',
    connecting: 'Connecting…',
    running: 'Streaming',
    done: 'Run complete',
    error: 'Backend not reachable – start it with: uvicorn app:app --port 8000 (in mlmodel/)',
  }[phase];

  return (
    <NeonCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>Real Bearing Health (NASA IMS run-to-failure)</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Recorded vibration from a bearing that failed after ~164 h, replayed through the trained model. {label}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={phase === 'running'}
            style={{ background: '#0f1c26', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
          >
            <option value={0.3}>Slow</option>
            <option value={0.1}>Normal</option>
            <option value={0.02}>Fast</option>
          </select>
          <button
            onClick={start}
            style={{ background: '#26e5a2', color: '#04130d', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}
          >
            {phase === 'idle' ? 'Start replay' : 'Restart'}
          </button>
        </div>
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
