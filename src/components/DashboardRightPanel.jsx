import { Thermometer, Zap, Wind, Leaf } from 'lucide-react';
import './DashboardRightPanel.css';

const AlertCard = ({ title, color, icon: IconComponent, isSelected }) => (
  <div 
    className={`alert-card ${isSelected ? 'selected' : ''}`}
    style={{
      '--alert-color': color,
      borderColor: isSelected ? color : `${color}4D`,
      background: `linear-gradient(to bottom right, ${color}26, ${color}0D)`
    }}
  >
    <div className="alert-icon-wrapper" style={{ backgroundColor: `${color}33` }}>
      <IconComponent color={color} size={20} />
    </div>
    <div className="alert-content">
      <h4 style={{ color: 'var(--color-text-primary)' }}>{title}</h4>
    </div>
    {isSelected && <div className="alert-dot" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}></div>}
  </div>
);

const EnergyWasteCard = () => (
  <div className="efficiency-card" style={{ borderColor: 'rgba(255, 179, 0, 0.3)' }}>
    <div className="kpi-ring" style={{ border: '6px solid var(--color-warning)' }}>
      <span style={{ color: 'var(--color-warning)' }}>12%</span>
    </div>
    <div className="efficiency-info">
      <span className="info-label">Energy Waste</span>
      <span className="info-value">High Usage</span>
    </div>
  </div>
);

const CO2Card = () => (
  <div className="efficiency-card col" style={{ borderColor: 'rgba(38, 229, 162, 0.3)' }}>
    <div className="co2-header">
      <Leaf color="var(--color-accent)" size={16} />
      <span className="co2-label">CO₂ Reduction</span>
      <span className="co2-value" style={{ color: 'var(--color-accent)' }}>85 Tons</span>
    </div>
    <div className="progress-bar-bg" style={{ backgroundColor: 'rgba(38, 229, 162, 0.2)' }}>
      <div className="progress-bar-fill" style={{ width: '70%', backgroundColor: 'var(--color-accent)' }}></div>
    </div>
  </div>
);

const DashboardRightPanel = ({ isMobile = false }) => {
  return (
    <div className={`dashboard-right-panel ${isMobile ? 'mobile' : 'desktop'}`}>
      <div className="panel-content">
        <h3 className="panel-header">Live Alerts</h3>
        
        <AlertCard 
          title={"Temperature drift\non Kiln B"}
          color="var(--color-warning)"
          icon={Thermometer}
          isSelected={true}
        />
        <AlertCard 
          title={"Excess vibration\nMotor 7"}
          color="var(--color-error)"
          icon={Zap}
          isSelected={false}
        />
        <AlertCard 
          title={"Airflow deviation\nFurnace Line 2"}
          color="var(--color-accent)"
          icon={Wind}
          isSelected={false}
        />

        <div className="divider"></div>

        <h3 className="panel-header">Efficiency KPIs</h3>
        <EnergyWasteCard />
        <CO2Card />
      </div>
    </div>
  );
};

export default DashboardRightPanel;
