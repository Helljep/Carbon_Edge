import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Brain, BarChart2, TrendingUp, Activity, Cpu, CheckCircle, ShieldCheck, Scale } from 'lucide-react';
import { useRealPlant } from '../../services/realPlantContext';
import { REAL_MACHINES, DEFAULT_MACHINE, machineStatus, degradedComponents } from '../../services/plantStatus';
import './DashboardPages.css';
import './AIOptimization.css';

const NeonPanel = ({ title, icon: Icon, color, expand, children }) => (
  <div className="neon-panel" style={{ '--panel-color': color }}>
    <div className="neon-panel-header">
      <Icon size={20} color={color} />
      <span style={{ color }}>{title}</span>
    </div>
    <div className="neon-panel-divider" />
    <div className={`neon-panel-content ${expand ? 'expand' : ''}`}>
      {children}
    </div>
  </div>
);

const LivePulse = () => (
  <div className="live-pulse">
    <div className="pulse-dot"></div>
  </div>
);

const SeverityGauge = ({ severity }) => {
  let color = 'var(--color-lime)';
  let percent = 25;
  let text = severity.toUpperCase();

  const sevLow = severity.toLowerCase();
  if (sevLow === 'critical') { color = 'var(--color-error)'; percent = 100; }
  else if (sevLow === 'high') { color = 'var(--color-orange)'; percent = 75; }
  else if (sevLow === 'warning') { color = '#FFFF00'; percent = 50; }
  else if (sevLow === 'normal' || sevLow === 'low' || sevLow === '') { color = 'var(--color-accent)'; percent = 10; text = 'NORMAL'; }

  const dasharray = `${percent * 2.83} 283`; // Approximation for stroke-dasharray (r=45 ~ 282.7px)

  return (
    <div className="severity-gauge">
      <svg width="110" height="110">
        <circle cx="55" cy="55" r="45" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle cx="55" cy="55" r="45" fill="transparent" stroke={color} strokeWidth="10" 
          strokeDasharray="283 283" strokeDashoffset={283 - (percent / 100 * 283)} 
          strokeLinecap="round" transform="rotate(-90 55 55)" 
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div className="gauge-center">
        <div className="gauge-label">SEVERITY</div>
        <div className="gauge-value" style={{ color }}>{text}</div>
      </div>
    </div>
  );
};

const GlowingMetricCard = ({ label, value, icon: Icon, color }) => (
  <div className="glowing-metric-card">
    <div className="metric-icon-wrap" style={{ backgroundColor: `${color}33` }}>
      <Icon size={16} color={color} />
    </div>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
  </div>
);

const SEVERITY = { ok: 'normal', warn: 'warning', error: 'high', idle: 'normal' };
const RANK = { High: 3, Warning: 2, Low: 1 };

/** Series for the trend chart, per machine, from the shared real-data history. */
const trendOf = (id, hist) => {
  if (id === 'bearing') return { label: 'Anomaly score', data: hist.map((m, i) => ({ time: i, score: m.error })) };
  if (id === 'hydraulic') return { label: 'Components diagnosed degraded', data: hist.map((m, i) => ({ time: i, score: degradedComponents(m).length })) };
  if (id === 'plant') return { label: 'kW above weekday baseline', data: hist.map((m, i) => ({ time: i, score: Math.max(0, m.main_kw - m.expected_kw) })) };
  return { label: 'kWh above expected', data: hist.map((m, i) => ({ time: i, score: Math.max(0, m.kwh - m.expected) })) };
};

const metricsOf = (id, m) => {
  if (id === 'bearing') return [
    { label: 'SCORE / THRESHOLD', value: `${(m.error / m.threshold).toFixed(2)}x`, icon: ShieldCheck, color: 'var(--color-accent)' },
    { label: 'VIBRATION RMS', value: m.rms.toFixed(4), icon: Scale, color: 'var(--color-lime)' },
    { label: 'KURTOSIS', value: m.kurtosis.toFixed(2), icon: TrendingUp, color: 'var(--color-orange)' },
  ];
  if (id === 'hydraulic') return [
    { label: 'MOTOR POWER', value: `${m.EPS1_mean.toFixed(0)} W`, icon: ShieldCheck, color: 'var(--color-accent)' },
    { label: 'OIL TEMP', value: `${m.TS1_mean.toFixed(1)} C`, icon: Scale, color: 'var(--color-lime)' },
    { label: 'PRESSURE', value: `${m.PS1_mean.toFixed(0)} bar`, icon: TrendingUp, color: 'var(--color-orange)' },
  ];
  if (id === 'plant') return [
    { label: 'MAIN METER', value: `${m.main_kw.toFixed(1)} kW`, icon: ShieldCheck, color: 'var(--color-accent)' },
    { label: 'EXPECTED', value: `${m.expected_kw.toFixed(1)} kW`, icon: Scale, color: 'var(--color-lime)' },
    { label: 'BASE LOAD', value: `${m.base_kw.toFixed(1)} kW`, icon: TrendingUp, color: 'var(--color-orange)' },
  ];
  return [
    { label: 'USAGE (INTERVAL)', value: `${m.kwh.toFixed(1)} kWh`, icon: ShieldCheck, color: 'var(--color-accent)' },
    { label: 'EXPECTED', value: `${m.expected.toFixed(1)} kWh`, icon: Scale, color: 'var(--color-lime)' },
    { label: 'CO2 SO FAR', value: `${m.cum_tco2} t`, icon: TrendingUp, color: 'var(--color-orange)' },
  ];
};

/**
 * Suggestions for the selected machine. They come from the rule-based alerts built on the
 * replayed real data (services/alertRules.js). This page does not optimise anything.
 */
const AIOptimizationPage = () => {
  const { feeds, alerts } = useRealPlant();
  const [machine, setMachine] = useState(DEFAULT_MACHINE);
  const feed = feeds[machine];
  const latest = feed.latest;
  const status = machineStatus(machine, feeds);
  const isWide = window.innerWidth > 1200;

  if (!latest) {
    return (
      <div className="ai-container center-content">
        <div className="spinner"></div>
        <p className="loading-text">Waiting for the replay backend to send data...</p>
      </div>
    );
  }

  const own = alerts.filter((a) => a.source === machine);
  const top = own.reduce((best, a) => (!best || RANK[a.severity] > RANK[best.severity] ? a : best), null);
  const focus = own[0] || top; // alerts are newest first
  const trend = trendOf(machine, feed.hist);
  const causes = focus?.rawData?.top_causes || [];
  const isNormal = status.level === 'ok' || status.level === 'idle';
  const title = REAL_MACHINES.find((m) => m.id === machine);

  return (
    <div className="ai-container">
      <div className="ai-layout-wrapper">
        <div className="ai-header">
          <div className="header-left">
            <div className="live-status-row">
              <LivePulse />
              <span className="live-text">REPLAY OF RECORDED REAL DATA · RULE-BASED SUGGESTIONS</span>
            </div>
            <h1 className="plant-id">{title.title.toUpperCase()}</h1>
            <div className="timestamp-text">{title.source}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {REAL_MACHINES.map((m) => (
                <button key={m.id} type="button" onClick={() => setMachine(m.id)}
                  style={{ padding: '4px 12px', borderRadius: 14, cursor: 'pointer', background: m.id === machine ? 'rgba(38,229,162,0.15)' : 'transparent',
                    color: m.id === machine ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    border: `1px solid ${m.id === machine ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)'}` }}>
                  {m.title}
                </button>
              ))}
            </div>
          </div>
          <div className="header-right">
            <div className="buffer-badge">
              <Cpu size={18} />
              <span>{own.length} ALERT{own.length === 1 ? '' : 'S'} · {feed.hist.length} SAMPLES</span>
            </div>
          </div>
        </div>

        <div className={`ai-grid ${isWide ? 'grid-desktop' : 'grid-mobile'}`}>
          <div className="grid-cell">
            <NeonPanel title="DIAGNOSTICS & SUGGESTIONS" icon={Brain} color="var(--color-orange)" expand>
              <div className="diag-group">
                <div className="diag-label root-cause">CURRENT STATE</div>
                <div className="diag-value">{status.text}</div>
              </div>
              <div className="diag-group">
                <div className="diag-label root-cause">LIKELY CAUSE (LATEST ALERT)</div>
                <div className="diag-value">{focus ? `${focus.rootCause}. ${focus.rootCauseDetail}` : 'No alert has fired for this machine yet.'}</div>
              </div>
              <div className="diag-group">
                <div className="diag-label recommendation">SUGGESTED CHECK</div>
                <div className="diag-value">{focus ? focus.action : 'Continue monitoring. Nothing to act on.'}</div>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title="MACHINE HEALTH" icon={Activity} color="var(--color-lime)" expand>
              <div className="health-content-row">
                <div className="health-gauge-area">
                  <SeverityGauge severity={SEVERITY[status.level]} />
                </div>
                <div className="health-metrics-area">
                  {metricsOf(machine, latest).map((m) => (
                    <GlowingMetricCard key={m.label} label={m.label} value={m.value} icon={m.icon} color={m.color} />
                  ))}
                </div>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title={trend.label.toUpperCase()} icon={TrendingUp} color="var(--color-accent)" expand>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trend.data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" hide />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="score" stroke="var(--color-accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title="EVIDENCE" icon={BarChart2} color="var(--color-lime)" expand>
              {causes.length > 0 ? (
                <div className="impact-bars-scroll">
                  <div className="diag-label">{focus.chartTitle}</div>
                  {causes.map((c) => (
                    <div className="impact-bar-item" key={c.sensor}>
                      <div className="impact-bar-header">
                        <span>{c.sensor.toUpperCase()}</span>
                        <span style={{ color: c.impact >= 5 ? 'var(--color-error)' : 'var(--color-orange)' }}>{c.impact.toFixed(1)}</span>
                      </div>
                      <div className="impact-bar-bg">
                        <div className="impact-bar-fill" style={{ width: `${Math.min(100, (c.impact / 10) * 100)}%`,
                          backgroundColor: c.impact >= 5 ? 'var(--color-error)' : 'var(--color-orange)' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : focus ? (
                <pre className="diag-value" style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{focus.eventLog}</pre>
              ) : (
                <div className="normal-impact-state">
                  <CheckCircle size={32} color="var(--color-lime)" />
                  <span>{isNormal ? 'NO ALERTS FOR THIS MACHINE' : 'WAITING FOR A RULE TO FIRE'}</span>
                </div>
              )}
            </NeonPanel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIOptimizationPage;
