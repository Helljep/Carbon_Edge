import { Activity, Droplets, Zap, Leaf } from 'lucide-react';
import { useRealPlant } from '../services/realPlantContext';
import { LEVEL_COLOR, machineStatus, degradedComponents } from '../services/plantStatus';
import './DashboardRightPanel.css';

const AlertCard = ({ title, color, icon: IconComponent, isSelected }) => (
  <div
    className={`alert-card ${isSelected ? 'selected' : ''}`}
    style={{
      '--alert-color': color,
      borderColor: isSelected ? color : `${color}4D`,
      background: `linear-gradient(to bottom right, ${color}26, ${color}0D)`,
    }}
  >
    <div className="alert-icon-wrapper" style={{ backgroundColor: `${color}33` }}>
      <IconComponent color={color} size={20} />
    </div>
    <div className="alert-content">
      <h4 style={{ color: 'var(--color-text-primary)', whiteSpace: 'pre-line' }}>{title}</h4>
    </div>
    {isSelected && <div className="alert-dot" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}></div>}
  </div>
);

const ExcessEnergyCard = ({ pct }) => {
  const color = pct == null ? 'rgba(255,255,255,0.3)' : pct > 5 ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div className="efficiency-card" style={{ borderColor: 'rgba(255, 179, 0, 0.3)' }}>
      <div className="kpi-ring" style={{ border: `6px solid ${color}` }}>
        <span style={{ color }}>{pct == null ? '—' : `${pct.toFixed(1)}%`}</span>
      </div>
      <div className="efficiency-info">
        <span className="info-label">Unexpected Energy</span>
        <span className="info-value">vs baseline</span>
      </div>
    </div>
  );
};

const CO2Card = ({ tons, progress }) => (
  <div className="efficiency-card col" style={{ borderColor: 'rgba(38, 229, 162, 0.3)' }}>
    <div className="co2-header">
      <Leaf color="var(--color-accent)" size={16} />
      <span className="co2-label">CO₂ emitted (replay)</span>
      <span className="co2-value" style={{ color: 'var(--color-accent)' }}>{tons == null ? '—' : `${tons} t`}</span>
    </div>
    <div className="progress-bar-bg" style={{ backgroundColor: 'rgba(38, 229, 162, 0.2)' }}>
      <div className="progress-bar-fill" style={{ width: `${Math.round((progress || 0) * 100)}%`, backgroundColor: 'var(--color-accent)' }}></div>
    </div>
  </div>
);

const DashboardRightPanel = ({ isMobile = false, selectedMachine = 'bearing' }) => {
  const { feeds } = useRealPlant();
  const b = feeds.bearing.latest;
  const h = feeds.hydraulic.latest;
  const e = feeds.energy.latest;

  const bs = machineStatus('bearing', feeds);
  const hs = machineStatus('hydraulic', feeds);
  const es = machineStatus('energy', feeds);

  const bearingTitle = !b
    ? 'Bearing rig\nwaiting for data'
    : b.alarm
      ? `Bearing fault alarm\n${b.lead_hours} h before failure`
      : `Bearing rig: ${bs.text.toLowerCase()}\nsnapshot ${b.index + 1}/${b.total}`;
  const bad = h ? degradedComponents(h) : [];
  const hydTitle = !h
    ? 'Hydraulic rig\nwaiting for data'
    : bad.length
      ? `Hydraulic rig (model)\n${bad.join(', ')}`
      : 'Hydraulic rig\nno degradation diagnosed';
  const energyTitle = !e
    ? 'Plant energy\nwaiting for data'
    : e.high
      ? `Unexpectedly high usage\n+${(e.kwh - e.expected).toFixed(0)} kWh vs expected`
      : 'Plant energy\nwithin expected range';

  const excessPct = e && e.cum_kwh > 0 ? (e.cum_excess_kwh / e.cum_kwh) * 100 : null;

  return (
    <div className={`dashboard-right-panel ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="panel-content">
        <h3 className="panel-header">Live Status</h3>

        <AlertCard title={bearingTitle} color={LEVEL_COLOR[bs.level]} icon={Activity} isSelected={selectedMachine === 'bearing'} />
        <AlertCard title={hydTitle} color={LEVEL_COLOR[hs.level]} icon={Droplets} isSelected={selectedMachine === 'hydraulic'} />
        <AlertCard title={energyTitle} color={LEVEL_COLOR[es.level]} icon={Zap} isSelected={selectedMachine === 'energy'} />

        <div className="divider"></div>

        <h3 className="panel-header">Energy &amp; CO₂ (steel plant)</h3>
        <ExcessEnergyCard pct={excessPct} />
        <CO2Card tons={e ? e.cum_tco2 : null} progress={e ? (e.index + 1) / e.total : 0} />
      </div>
    </div>
  );
};

export default DashboardRightPanel;
