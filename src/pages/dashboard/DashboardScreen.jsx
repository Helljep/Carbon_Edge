import React, { useState, useEffect } from 'react';
import SimulationState from '../../services/SimulationState';
import { useRealPlant } from '../../services/realPlantContext';
import { REAL_MACHINES, DEFAULT_MACHINE, delta } from '../../services/plantStatus';
import PlantExplorer from '../../components/PlantExplorer';
import DashboardRightPanel from '../../components/DashboardRightPanel';
import KPICard from '../../components/KPICard';
import NeonCard from '../../components/NeonCard';
import PlantHeatmap from '../../components/PlantHeatmap';
import LiveTelemetryChart from '../../components/LiveTelemetryChart';
import BearingHealthPanel from '../../components/BearingHealthPanel';
import HydraulicDiagnosisPanel from '../../components/HydraulicDiagnosisPanel';
import PlantEnergyPanel from '../../components/PlantEnergyPanel';

import {
  Thermometer, Zap, Settings, Activity, Gauge, Droplets, Leaf, TrendingUp,
  ChevronDown, LineChart as LineIcon, Timer, AlertTriangle,
} from 'lucide-react';

import './Dashboard.css';

// ---------- KPI definitions: every value comes from the latest real-data message ----------

const fmt = (v, d = 0) => (v != null && !Number.isNaN(Number(v)) ? Number(v).toFixed(d) : '--');

// `pick` reads the value from one history entry; goodWhen says which direction is healthy
const kpi = (title, value, unit, Icon, color, hist, pick, goodWhen) => {
  const d = pick ? delta(hist, pick) : null;
  const hasTrend = d != null && Math.abs(d) > 0;
  return {
    title, value, unit, Icon, color,
    trendDir: hasTrend ? (d > 0 ? 'up' : 'down') : null,
    trend: hasTrend ? `${d > 0 ? '+' : ''}${Math.abs(d) < 1 ? d.toFixed(3) : d.toFixed(1)}` : null,
    isPos: hasTrend ? (goodWhen === 'up' ? d >= 0 : goodWhen === 'down' ? d <= 0 : true) : true,
  };
};

function buildKpis(machine, feeds) {
  const { latest: m, hist } = feeds[machine];
  if (!m) return [];
  if (machine === 'bearing') {
    return [
      kpi('Status', m.status, '', Activity, m.status === 'FAULT' ? 'var(--color-error)' : m.status === 'WATCH' ? 'var(--color-warning)' : 'var(--color-success)'),
      kpi('Anomaly Score', fmt(m.error, 2), '', AlertTriangle, 'var(--color-warning)', hist, (x) => x.error, 'down'),
      kpi('Vibration RMS', fmt(m.rms, 4), '', Activity, 'var(--color-accent)', hist, (x) => x.rms, 'down'),
      kpi('Kurtosis', fmt(m.kurtosis, 2), '', Gauge, 'var(--color-accent)', hist, (x) => x.kurtosis, 'down'),
      kpi('Alarm Threshold', fmt(m.threshold, 2), '', Settings, 'var(--color-success)'),
      kpi('Snapshot', `${m.index + 1}/${m.total}`, '', Timer, 'var(--color-accent)'),
      kpi('Hours to End of Run', fmt(m.hours_to_end_of_run, 1), 'h', Timer, 'var(--color-warning)'),
      kpi('Warning Lead Time', m.lead_hours != null ? fmt(m.lead_hours, 1) : '--', m.lead_hours != null ? 'h' : '', AlertTriangle, 'var(--color-error)'),
    ];
  }
  if (machine === 'hydraulic') {
    return [
      kpi('Motor Power', fmt(m.EPS1_mean, 0), 'W', Zap, 'var(--color-warning)', hist, (x) => x.EPS1_mean, 'down'),
      kpi('Oil Temperature', fmt(m.TS1_mean, 1), '°C', Thermometer, 'var(--color-warning)', hist, (x) => x.TS1_mean, 'down'),
      kpi('Pressure (PS1)', fmt(m.PS1_mean, 0), 'bar', Gauge, 'var(--color-accent)', hist, (x) => x.PS1_mean),
      kpi('Cooling Efficiency', fmt(m.CE_mean, 1), '%', Droplets, 'var(--color-success)', hist, (x) => x.CE_mean, 'up'),
      kpi('Cooler (model)', fmt(m.pred_cooler, 0), '%', Droplets, m.ok_cooler ? 'var(--color-success)' : 'var(--color-error)'),
      kpi('Valve (model)', fmt(m.pred_valve, 0), '%', Settings, m.ok_valve ? 'var(--color-success)' : 'var(--color-error)'),
      kpi('Pump Leakage (model)', fmt(m.pred_pump_leak, 0), '', Activity, m.ok_pump_leak ? 'var(--color-success)' : 'var(--color-error)'),
      kpi('Accumulator (model)', fmt(m.pred_accumulator, 0), 'bar', Gauge, m.ok_accumulator ? 'var(--color-success)' : 'var(--color-error)'),
    ];
  }
  const share = m.cum_kwh > 0 ? (m.cum_excess_kwh / m.cum_kwh) * 100 : 0;
  return [
    kpi('Usage Now', fmt(m.kwh, 1), 'kWh/15min', Zap, m.high ? 'var(--color-warning)' : 'var(--color-accent)', hist, (x) => x.kwh, 'down'),
    kpi('Expected Now', fmt(m.expected, 1), 'kWh/15min', Settings, 'var(--color-success)'),
    kpi('Energy So Far', Number(m.cum_kwh).toLocaleString(), 'kWh', TrendingUp, 'var(--color-accent)'),
    kpi('CO₂ So Far', fmt(m.cum_tco2, 2), 't', Leaf, 'var(--color-success)'),
    kpi('Flagged Intervals', String(feeds.energy.stats.flagged), '', AlertTriangle, 'var(--color-warning)'),
    kpi('Unexpected Excess', Number(m.cum_excess_kwh).toLocaleString(), 'kWh', Zap, 'var(--color-warning)'),
    kpi('Excess Share', fmt(share, 1), '%', Gauge, 'var(--color-warning)'),
    kpi('Replay Progress', fmt(((m.index + 1) / m.total) * 100, 0), '%', Timer, 'var(--color-accent)'),
  ];
}

// ---------- Main chart: one series per tab, from the history of the selected machine ----------

const CHARTS = {
  bearing: {
    'Vibration RMS': (h) => ({ color: '#00E5FF', label: 'Vibration RMS', x: h.map((p) => p.index), y: h.map((p) => p.rms) }),
    Kurtosis: (h) => ({ color: '#FFB300', label: 'Kurtosis', x: h.map((p) => p.index), y: h.map((p) => p.kurtosis) }),
    'Anomaly score': (h) => ({ color: '#EF4444', label: 'Anomaly score', x: h.map((p) => p.index), y: h.map((p) => p.error) }),
  },
  hydraulic: {
    'Oil temp': (h) => ({ color: '#FFB300', label: 'Oil temperature (°C)', x: h.map((p) => p.index), y: h.map((p) => p.TS1_mean) }),
    Pressure: (h) => ({ color: '#00E5FF', label: 'Pressure PS1 (bar)', x: h.map((p) => p.index), y: h.map((p) => p.PS1_mean) }),
    'Motor power': (h) => ({ color: '#00E676', label: 'Motor power (W)', x: h.map((p) => p.index), y: h.map((p) => p.EPS1_mean) }),
    'Cooling eff.': (h) => ({ color: '#A78BFA', label: 'Cooling efficiency (%)', x: h.map((p) => p.index), y: h.map((p) => p.CE_mean) }),
  },
  energy: {
    'Usage vs expected': (h) => ({
      color: '#00E676', label: 'Actual kWh', x: h.map((p) => p.date.slice(5, 16)), y: h.map((p) => p.kwh),
      extra: { label: 'Expected kWh', y: h.map((p) => p.expected), color: '#94a3b8' },
    }),
    'Cumulative CO₂': (h) => ({ color: '#26e5a2', label: 'Cumulative CO₂ (t)', x: h.map((p) => p.date.slice(5, 16)), y: h.map((p) => p.cum_tco2) }),
  },
};

const DashboardContent = () => {
  const { feeds } = useRealPlant();
  const [selectedMachine, setSelectedMachine] = useState(DEFAULT_MACHINE);
  const [chartTab, setChartTab] = useState(null);
  const [isWide, setIsWide] = useState(window.innerWidth > 1200);
  const [connected, setConnected] = useState(SimulationState.isConnected);

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth > 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // the welcome popup sets SimulationState.isConnected directly, so poll it
  useEffect(() => {
    const id = setInterval(() => setConnected(SimulationState.isConnected), 400);
    return () => clearInterval(id);
  }, []);

  const machine = REAL_MACHINES.find((m) => m.id === selectedMachine);
  const tabs = Object.keys(CHARTS[selectedMachine]);
  const activeTab = tabs.includes(chartTab) ? chartTab : tabs[0];
  const kpis = connected ? buildKpis(selectedMachine, feeds) : [];

  const handleMachineSelect = (id) => {
    setSelectedMachine(id);
    setChartTab(null);
  };

  const kpiGrid = (isWeb) => (
    <div className={`kpi-grid ${isWeb ? 'web-grid' : 'mobile-grid'}`}>
      {(kpis.length ? kpis : Array.from({ length: 8 }, () => ({ title: '—', value: '---', unit: '', trend: null, Icon: Activity, color: 'rgba(255,255,255,0.2)', isPos: true }))).map((k, idx) => (
        <KPICard
          key={idx}
          title={k.title}
          value={k.value}
          unit={k.unit}
          trend={k.trend}
          isPositiveTrend={k.isPos}
          trendDir={k.trendDir}
          icon={k.Icon}
          accentColor={kpis.length ? k.color : 'rgba(255,255,255,0.2)'}
          isWeb={isWeb}
        />
      ))}
    </div>
  );

  const MainChart = () => {
    if (!connected) {
      return (
        <NeonCard>
          <div className="locked-chart-container main-locked">
            <LineIcon size={64} color="rgba(38, 229, 162, 0.3)" />
            <h3 className="locked-title">Connection Required</h3>
            <p className="locked-subtitle">Connect to replay recorded real-machine data</p>
          </div>
        </NeonCard>
      );
    }
    const s = CHARTS[selectedMachine][activeTab](feeds[selectedMachine].hist);
    const datasets = [{
      label: s.label, data: s.y, borderColor: s.color, backgroundColor: `${s.color}33`,
      fill: true, tension: 0.3, pointRadius: 0,
    }];
    if (s.extra) {
      datasets.push({ label: s.extra.label, data: s.extra.y, borderColor: s.extra.color, borderDash: [6, 4], fill: false, tension: 0.3, pointRadius: 0 });
    }
    return (
      <NeonCard>
        <div className="chart-tabs">
          {tabs.map((tab) => (
            <div key={tab} className={`chart-tab ${activeTab === tab ? 'active' : ''} ${isWide ? 'wide' : ''}`} onClick={() => setChartTab(tab)}>
              {tab}
            </div>
          ))}
        </div>
        <LiveTelemetryChart data={{ labels: s.x.map(String), datasets }} title="" />
      </NeonCard>
    );
  };

  const DetailPanel = () => {
    if (selectedMachine === 'bearing') return <BearingHealthPanel />;
    if (selectedMachine === 'hydraulic') return <HydraulicDiagnosisPanel />;
    return <PlantEnergyPanel />;
  };

  const header = (
    <div className="header-section">
      <h1 className="header-title">{machine.title} Dashboard</h1>
      <p className="header-subtitle">Replay of recorded real-machine data: {machine.source}.</p>
    </div>
  );

  if (!isWide) {
    return (
      <div className="dashboard-content mobile-pd">
        <div className="mobile-dashboard-header">
          <span className="view-label">View:</span>
          <div className="dropdown-container">
            <select value={selectedMachine} onChange={(e) => handleMachineSelect(e.target.value)}>
              {REAL_MACHINES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="spacer-24"></div>
        {kpiGrid(false)}
        <div className="spacer-24"></div>
        {MainChart()}
        <div className="spacer-24"></div>
        {DetailPanel()}
        <div className="spacer-24"></div>
        <PlantHeatmap isMobile={true} selectedMachine={selectedMachine} />
        <div className="spacer-24"></div>
        <DashboardRightPanel isMobile={true} selectedMachine={selectedMachine} />
      </div>
    );
  }

  return (
    <div className="dashboard-web-layout">
      <div className="dashboard-sidebar">
        <PlantExplorer onMachineSelected={handleMachineSelect} />
      </div>
      <div className="dashboard-main-scroll">
        <div className="dashboard-content web-pd">
          {header}
          <div className="spacer-24"></div>
          {kpiGrid(true)}
          <div className="spacer-24"></div>
          {MainChart()}
          <div className="spacer-24"></div>
          {DetailPanel()}
          <div className="spacer-24"></div>
          <PlantHeatmap isMobile={false} selectedMachine={selectedMachine} />
        </div>
      </div>
      <div className="dashboard-right">
        <DashboardRightPanel isMobile={false} selectedMachine={selectedMachine} />
      </div>
    </div>
  );
};

const DashboardScreen = () => <DashboardContent />;

export default DashboardScreen;
