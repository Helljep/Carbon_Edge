import React, { useState, useEffect } from 'react';
import MachineData from '../../data/machineData';
import { Settings, Thermometer, Gauge, Activity, Cpu, Power, Crosshair, Map, Wrench, ShieldCheck, Cpu as CpuIcon } from 'lucide-react';
import './DashboardPages.css';

const MachinesScreen = () => {
  const [selectedMachine, setSelectedMachine] = useState(MachineData.defaultMachine);
  const [isRunning, setIsRunning] = useState(true);
  
  const [targetTemp, setTargetTemp] = useState(1450.0);
  const [targetSpeed, setTargetSpeed] = useState(85.0);
  const [targetFeed, setTargetFeed] = useState(120.0);
  
  const [currentTemp, setCurrentTemp] = useState(1448.2);
  const [currentSpeed, setCurrentSpeed] = useState(84.8);
  const [currentFeed, setCurrentFeed] = useState(119.5);

  const machines = MachineData.machines;

  useEffect(() => {
    const timer = setInterval(() => {
      if (isRunning) {
        setCurrentTemp(prev => prev + (targetTemp - prev) * 0.1 + (Math.random() - 0.5) * 2);
        setCurrentSpeed(prev => prev + (targetSpeed - prev) * 0.1 + (Math.random() - 0.5) * 0.5);
        setCurrentFeed(prev => prev + (targetFeed - prev) * 0.1 + (Math.random() - 0.5) * 1.0);
      } else {
        setCurrentTemp(prev => Math.max(25.0, prev * 0.995));
        setCurrentSpeed(prev => Math.max(0.0, prev * 0.95));
        setCurrentFeed(0.0);
      }
    }, 800);

    return () => clearInterval(timer);
  }, [isRunning, targetTemp, targetSpeed, targetFeed]);

  const isWide = window.innerWidth > 1000;

  const MachineSelector = () => (
    <div className="machines-sidebar">
      <div className="sidebar-header">ASSETS</div>
      <div className="machine-list">
        {machines.map(m => (
          <div 
            key={m} 
            className={`machine-item ${selectedMachine === m ? 'active' : ''}`}
            onClick={() => setSelectedMachine(m)}
          >
            <Settings size={20} className={selectedMachine === m ? 'icon-active' : 'icon-inactive'} />
            <span>{m}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const Header = () => (
    <div className="machine-header">
      <div className="machine-title-area">
        <h1>{selectedMachine}</h1>
        <div className="machine-status">
          <div className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></div>
          <span className={`status-text ${isRunning ? 'running' : 'stopped'}`}>
            {isRunning ? "OPERATIONAL" : "STOPPED"}
          </span>
        </div>
      </div>
      <div className="oee-card">
        <span className="oee-label">OEE SCORE</span>
        <span className="oee-value">87.4%</span>
      </div>
    </div>
  );

  const SliderControl = ({ label, value, min, max, unit, onChange }) => (
    <div className="slider-control">
      <div className="slider-header">
        <span>{label}</span>
        <span className="slider-val">{value.toFixed(1)} {unit}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        onChange={e => onChange(parseFloat(e.target.value))}
        className="custom-slider"
      />
    </div>
  );

  const ControlPanel = () => (
    <div className="control-panel panel-card">
      <div className="panel-header">
        <h2>CONTROL PANEL</h2>
        <div className="mode-badge">MODE: AUTO</div>
      </div>
      
      <div className="action-buttons">
        <button 
          className="btn-start" 
          onClick={() => setIsRunning(true)} 
          disabled={isRunning}
        >
          START MACHINE
        </button>
        <button 
          className="btn-stop" 
          onClick={() => setIsRunning(false)} 
          disabled={!isRunning}
        >
          STOP MACHINE
        </button>
      </div>

      <div className="sliders">
        <SliderControl 
          label="TARGET TEMPERATURE" value={targetTemp} 
          min={1000} max={1600} unit="°C" onChange={setTargetTemp} 
        />
        <SliderControl 
          label="ROTATION SPEED" value={targetSpeed} 
          min={0} max={120} unit="RPM" onChange={setTargetSpeed} 
        />
        <SliderControl 
          label="FEED RATE" value={targetFeed} 
          min={0} max={200} unit="t/h" onChange={setTargetFeed} 
        />
      </div>
    </div>
  );

  const MetricCard = ({ label, value, unit, icon: Icon, color }) => (
    <div className="metric-card panel-card" style={{ borderColor: `${color}40` }}>
      <div className="metric-header">
        <Icon size={16} color={color} />
        <span>{label}</span>
      </div>
      <div className="metric-value-row">
        <span className="m-val">{value}</span>
        <span className="m-unit">{unit}</span>
      </div>
    </div>
  );

  const ComponentHealth = () => (
    <div className="health-panel panel-card">
      <h2>COMPONENT HEALTH</h2>
      <div className="health-items">
        <HealthItem name="Main Motor" health={98} color="var(--color-success)" />
        <HealthItem name="Gearbox" health={85} color="var(--color-success)" />
        <HealthItem name="Drive Bearing" health={72} color="var(--color-orange)" />
        <HealthItem name="Cooling Fan" health={94} color="var(--color-success)" />
        <HealthItem name="Hydraulic Pump" health={45} color="var(--color-error)" />
      </div>
    </div>
  );

  const HealthItem = ({ name, health, color }) => (
    <div className="health-item">
      <div className="health-header">
        <span>{name}</span>
        <span style={{ color }}>{health}%</span>
      </div>
      <div className="health-bar-bg">
        <div className="health-bar-fill" style={{ width: `${health}%`, backgroundColor: color }}></div>
      </div>
    </div>
  );

  const MaintenanceLog = () => (
    <div className="maintenance-panel panel-card">
      <h2>MAINTENANCE LOG</h2>
      <div className="log-items">
        <LogItem date="2023-10-15" task="Oil Change" status="Completed" />
        <div className="divider"></div>
        <LogItem date="2023-11-02" task="Bearing Inspection" status="Completed" />
        <div className="divider"></div>
        <LogItem date="2023-12-10" task="Filter Replacement" status="Scheduled" isUpcoming />
      </div>
    </div>
  );

  const LogItem = ({ date, task, status, isUpcoming }) => (
    <div className="log-item">
      <div className="log-info">
        <span className="log-date">{date}</span>
        <span className="log-task">{task}</span>
      </div>
      <div className={`log-status ${isUpcoming ? 'upcoming' : 'completed'}`}>
        {status.toUpperCase()}
      </div>
    </div>
  );

  return (
    <div className="machines-container">
      {isWide ? (
        <div className="machines-layout">
          <div className="layout-left"><MachineSelector /></div>
          <div className="layout-divider"></div>
          <div className="layout-center">
            <Header />
            <div className="spacer-24"></div>
            <ControlPanel />
            <div className="spacer-24"></div>
            <div className="metrics-row">
              <MetricCard label="TEMPERATURE" value={currentTemp.toFixed(1)} unit="°C" icon={Thermometer} color="var(--color-orange)" />
              <MetricCard label="SPEED" value={currentSpeed.toFixed(1)} unit="RPM" icon={Gauge} color="var(--color-success)" />
              <MetricCard label="FEED RATE" value={currentFeed.toFixed(1)} unit="t/h" icon={Activity} color="var(--color-purple)" />
            </div>
          </div>
          <div className="layout-divider"></div>
          <div className="layout-right">
            <ComponentHealth />
            <div className="spacer-24"></div>
            <MaintenanceLog />
          </div>
        </div>
      ) : (
        <div className="machines-mobile-layout">
           <select 
            className="mobile-machine-selector panel-card" 
            value={selectedMachine} 
            onChange={e => setSelectedMachine(e.target.value)}
          >
            {machines.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="spacer-16"></div>
          <Header />
          <div className="spacer-24"></div>
          <ControlPanel />
          <div className="spacer-24"></div>
          <div className="metrics-col">
            <MetricCard label="TEMPERATURE" value={currentTemp.toFixed(1)} unit="°C" icon={Thermometer} color="var(--color-orange)" />
            <MetricCard label="SPEED" value={currentSpeed.toFixed(1)} unit="RPM" icon={Gauge} color="var(--color-success)" />
            <MetricCard label="FEED RATE" value={currentFeed.toFixed(1)} unit="t/h" icon={Activity} color="var(--color-purple)" />
          </div>
          <div className="spacer-24"></div>
          <ComponentHealth />
          <div className="spacer-24"></div>
          <MaintenanceLog />
        </div>
      )}
    </div>
  );
};

export default MachinesScreen;
