import React, { useState } from 'react';
import { Settings, Thermometer, Gauge, Activity, Zap } from 'lucide-react';
import { useRealPlant } from '../../services/realPlantContext';
import { REAL_MACHINES, DEFAULT_MACHINE, LEVEL_COLOR, machineStatus } from '../../services/plantStatus';
import './DashboardPages.css';

// Health bars for the hydraulic rig's four components, taken from the model's diagnosis.
const HYD_BARS = [
  { key: 'cooler', name: 'Cooler (efficiency)', pct: (v) => v },
  { key: 'valve', name: 'Valve (switching)', pct: (v) => v },
  { key: 'pump_leak', name: 'Pump leakage', pct: (v) => [100, 55, 15][v] ?? 50 },
  { key: 'accumulator', name: 'Accumulator (pre-charge)', pct: (v) => Math.min(100, (v / 130) * 100) },
];
const barColor = (pct) => (pct >= 90 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-orange)' : 'var(--color-error)');

/** Machines page: the three real replayed machines, with live status and their recent alerts. */
const MachinesScreen = () => {
  const { feeds, alerts } = useRealPlant();
  const [selected, setSelected] = useState(DEFAULT_MACHINE);
  const isWide = window.innerWidth > 1000;

  const info = REAL_MACHINES.find((m) => m.id === selected);
  const latest = feeds[selected].latest;
  const status = machineStatus(selected, feeds);
  const own = alerts.filter((a) => a.source === selected);

  const metrics = !latest ? [] : selected === 'bearing' ? [
    { label: 'ANOMALY SCORE', value: latest.error.toFixed(2), unit: `/ ${latest.threshold.toFixed(2)}`, icon: Activity, color: 'var(--color-orange)' },
    { label: 'VIBRATION RMS', value: latest.rms.toFixed(4), unit: '', icon: Gauge, color: 'var(--color-success)' },
    { label: 'KURTOSIS', value: latest.kurtosis.toFixed(2), unit: '', icon: Activity, color: 'var(--color-purple)' },
  ] : selected === 'hydraulic' ? [
    { label: 'OIL TEMPERATURE', value: latest.TS1_mean.toFixed(1), unit: '°C', icon: Thermometer, color: 'var(--color-orange)' },
    { label: 'MOTOR POWER', value: latest.EPS1_mean.toFixed(0), unit: 'W', icon: Zap, color: 'var(--color-success)' },
    { label: 'PRESSURE', value: latest.PS1_mean.toFixed(0), unit: 'bar', icon: Gauge, color: 'var(--color-purple)' },
  ] : selected === 'plant' ? [
    { label: 'MAIN METER', value: latest.main_kw.toFixed(1), unit: 'kW', icon: Zap, color: 'var(--color-orange)' },
    { label: 'METERED MACHINES', value: latest.metered_kw.toFixed(1), unit: 'kW', icon: Activity, color: 'var(--color-success)' },
    { label: 'BASE LOAD', value: latest.base_kw.toFixed(1), unit: 'kW', icon: Gauge, color: 'var(--color-purple)' },
  ] : [
    { label: 'USAGE (INTERVAL)', value: latest.kwh.toFixed(1), unit: 'kWh', icon: Zap, color: 'var(--color-orange)' },
    { label: 'EXPECTED', value: latest.expected.toFixed(1), unit: 'kWh', icon: Gauge, color: 'var(--color-success)' },
    { label: 'CO₂ SO FAR', value: String(latest.cum_tco2), unit: 't', icon: Activity, color: 'var(--color-purple)' },
  ];

  const MachineSelector = () => (
    <div className="machines-sidebar">
      <div className="sidebar-header">ASSETS (REAL DATA)</div>
      <div className="machine-list">
        {REAL_MACHINES.map((m) => (
          <div key={m.id} className={`machine-item ${selected === m.id ? 'active' : ''}`} onClick={() => setSelected(m.id)}>
            <Settings size={20} className={selected === m.id ? 'icon-active' : 'icon-inactive'} />
            <span>{m.title}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const Header = () => (
    <div className="machine-header">
      <div className="machine-title-area">
        <h1>{info.title}</h1>
        <div className="machine-status">
          <div className="status-dot" style={{ backgroundColor: LEVEL_COLOR[status.level] }}></div>
          <span className="status-text" style={{ color: LEVEL_COLOR[status.level] }}>{status.text.toUpperCase()}</span>
        </div>
      </div>
      <div className="oee-card">
        <span className="oee-label">DATA SOURCE</span>
        <span className="oee-value" style={{ fontSize: 13 }}>{info.source}</span>
      </div>
    </div>
  );

  const MetricCard = ({ label, value, unit, icon: Icon, color }) => (
    <div className="metric-card panel-card" style={{ borderColor: `${color}40` }}>
      <div className="metric-header"><Icon size={16} color={color} /><span>{label}</span></div>
      <div className="metric-value-row"><span className="m-val">{value}</span><span className="m-unit">{unit}</span></div>
    </div>
  );

  const HealthItem = ({ name, pct, text }) => (
    <div className="health-item">
      <div className="health-header"><span>{name}</span><span style={{ color: barColor(pct) }}>{text}</span></div>
      <div className="health-bar-bg"><div className="health-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}></div></div>
    </div>
  );

  const ComponentHealth = () => {
    let body;
    if (!latest) body = <p className="alert-desc">Waiting for data from the replay backend.</p>;
    else if (selected === 'hydraulic') {
      body = HYD_BARS.map((c) => {
        const v = latest[`pred_${c.key}`];
        const pct = c.pct(v);
        return <HealthItem key={c.key} name={c.name} pct={pct} text={`${v}`} />;
      });
    } else if (selected === 'bearing') {
      const pct = Math.max(0, Math.min(100, 100 - (latest.error / latest.threshold) * 50));
      body = <HealthItem name="Bearing (score vs alarm threshold)" pct={pct} text={`${(latest.error / latest.threshold).toFixed(2)}x`} />;
    } else if (selected === 'plant') {
      const idle = latest.cum_kwh > 0 ? (latest.cum_idle_kwh / latest.cum_kwh) * 100 : 0;
      body = (
        <>
          <HealthItem name="Energy used while machines idle" pct={100 - idle} text={`${idle.toFixed(0)}% idle`} />
          {Object.entries(latest.machines).filter(([, kw]) => kw > 0.05).map(([n, kw]) => (
            <HealthItem key={n} name={n} pct={100} text={`${kw.toFixed(2)} kW`} />
          ))}
        </>
      );
    } else {
      const excess = Math.max(0, latest.cum_excess_kwh);
      const pct = latest.cum_kwh > 0 ? Math.max(0, 100 - (excess / latest.cum_kwh) * 100) : 100;
      body = <HealthItem name="Energy within baseline" pct={pct} text={`${pct.toFixed(1)}%`} />;
    }
    return (
      <div className="health-panel panel-card">
        <h2>{selected === 'hydraulic' ? 'COMPONENT DIAGNOSIS (MODEL)' : 'CONDITION'}</h2>
        <div className="health-items">{body}</div>
      </div>
    );
  };

  const EventLog = () => (
    <div className="maintenance-panel panel-card">
      <h2>RECENT ALERTS</h2>
      <div className="log-items">
        {own.length === 0 ? <p className="alert-desc">No alerts for this machine yet.</p> : own.slice(0, 5).map((a, i) => (
          <React.Fragment key={a.id}>
            {i > 0 && <div className="divider"></div>}
            <div className="log-item">
              <div className="log-info">
                <span className="log-date">{a.time}</span>
                <span className="log-task">{a.title}</span>
              </div>
              <div className={`log-status ${a.severity === 'High' ? '' : 'upcoming'}`}>{a.severity.toUpperCase()}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  const Center = () => (
    <>
      <Header />
      <div className="spacer-24"></div>
      <div className={isWide ? 'metrics-row' : 'metrics-col'}>
        {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>
      <div className="spacer-24"></div>
      <p className="alert-desc">
        Read-only view of a replay of recorded real data. There are no machine controls because nothing here is connected to real equipment.
      </p>
    </>
  );

  return (
    <div className="machines-container">
      {isWide ? (
        <div className="machines-layout">
          <div className="layout-left">{MachineSelector()}</div>
          <div className="layout-divider"></div>
          <div className="layout-center">{Center()}</div>
          <div className="layout-divider"></div>
          <div className="layout-right">
            {ComponentHealth()}
            <div className="spacer-24"></div>
            {EventLog()}
          </div>
        </div>
      ) : (
        <div className="machines-mobile-layout">
          <select className="mobile-machine-selector panel-card" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {REAL_MACHINES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <div className="spacer-16"></div>
          {Center()}
          <div className="spacer-24"></div>
          {ComponentHealth()}
          <div className="spacer-24"></div>
          {EventLog()}
        </div>
      )}
    </div>
  );
};

export default MachinesScreen;
