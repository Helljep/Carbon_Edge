import React, { useState, useEffect } from 'react';
import MachineData from '../../data/machineData';
import KilnService from '../../services/KilnService';
import MachineSimulationService from '../../services/MachineSimulationService';
import SimulationState from '../../services/SimulationState';
import PlantExplorer from '../../components/PlantExplorer';
import DashboardRightPanel from '../../components/DashboardRightPanel';
import KPICard from '../../components/KPICard';
import NeonCard from '../../components/NeonCard';
import PlantHeatmap from '../../components/PlantHeatmap';
import LiveTelemetryChart from '../../components/LiveTelemetryChart';
import BearingHealthPanel from '../../components/BearingHealthPanel';

import { 
  Thermometer, Wind, Fuel, Zap, Settings, Activity, 
  Info, TrendingUp, ChevronDown, PieChart as PieIcon, LineChart as LineIcon,
  Minimize2
} from 'lucide-react';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell,
  PieChart, Pie
} from 'recharts';

import './Dashboard.css';

const DashboardScreen = () => {
  const [selectedMachine, setSelectedMachine] = useState(MachineData.defaultMachine || 'Kiln A');
  const [selectedChartTab, setSelectedChartTab] = useState('Temperature');
  const [isWide, setIsWide] = useState(window.innerWidth > 1200);
  
  const [kilnData, setKilnData] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);
  const [xValue, setXValue] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth > 1200);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Generate initial flat data
    regenerateData(selectedMachine);

    KilnService.connect();

    const handleData = (data) => {
      if (!SimulationState.isConnected) return;
      if (data?.latest_sensor_values?.plant_1?.values) {
        setKilnData(data.latest_sensor_values.plant_1.values);
      }
    };

    const unsubscribe = KilnService.onData(handleData);

    const interval = setInterval(() => {
      if (SimulationState.isConnected) {
        updateData(selectedMachine);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  const hashCode = (s) => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);

  const regenerateData = (machineName) => {
    let seed = Math.abs(hashCode(machineName) % 100);
    let newSeries = [];
    for (let i = 0; i < 30; i++) {
      newSeries.push({
        x: i,
        energy: 40 + Math.sin(i * 0.2 + seed) * 10 + Math.random() * 5,
        fuel: 30 + Math.cos(i * 0.2 + seed) * 8 + Math.random() * 4,
        pressure: 25 + Math.sin(i * 0.15 + seed) * 6 + Math.random() * 3,
      });
    }
    setTimeSeries(newSeries);
    setXValue(30);
  };

  const updateData = (machineName) => {
    let offset = Math.abs(hashCode(machineName) % 100);
    setXValue(prevX => {
      const nextX = prevX + 1;
      const energy = 40 + Math.sin(nextX * 0.2 + offset) * 10 + Math.random() * 5;
      const fuel = 30 + Math.cos(nextX * 0.2 + offset) * 8 + Math.random() * 4;
      const pressure = 25 + Math.sin(nextX * 0.15 + offset) * 6 + Math.random() * 3;

      setTimeSeries(prev => {
        const newSeries = [...prev, { x: nextX, energy, fuel, pressure }];
        if (newSeries.length > 30) newSeries.shift();
        return newSeries;
      });

      return nextX;
    });
  };

  const handleMachineSelect = (m) => {
    setSelectedMachine(m);
    if (m !== 'Kiln A') setKilnData(null);
  };

  // ----- Data Helpers -----
  const getKPIs = () => {
    let rs = Math.abs(hashCode(selectedMachine));
    const random = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
    const getTrend = () => random() > 0.5 ? "↗" : "↓";
    const getPos = () => random() > 0.5;
    const fmt = (v, dec=0) => (v != null && !isNaN(v)) ? Number(v).toFixed(dec) : "--";

    if (selectedMachine === "Kiln A") {
      const data = kilnData || MachineSimulationService.getKilnData();
      return [
        { title: "Kiln Temp", value: fmt(data.kiln_temperature, 0), unit: "°C", trend: getTrend(), isPos: getPos(), Icon: Thermometer, color: "var(--color-warning)" },
        { title: "Feed Rate", value: fmt(data.feed_rate, 1), unit: "t/h", trend: getTrend(), isPos: getPos(), Icon: Wind, color: "var(--color-accent)" },
        { title: "Fuel Flow", value: fmt(data.fuel_flow_rate, 0), unit: "kg/h", trend: getTrend(), isPos: getPos(), Icon: Fuel, color: "var(--color-error)" },
        { title: "Kiln Pressure", value: fmt(data.kiln_pressure, 2), unit: "mbar", trend: getTrend(), isPos: getPos(), Icon: Minimize2, color: "var(--color-success)" },
        { title: "Exhaust O2", value: fmt(data.exhaust_o2, 2), unit: "%", trend: getTrend(), isPos: getPos(), Icon: Activity, color: "var(--color-success)" },
        { title: "Exhaust CO", value: fmt(data.exhaust_co, 0), unit: "ppm", trend: getTrend(), isPos: getPos(), Icon: Info, color: "var(--color-error)" },
        { title: "Clinker Temp", value: fmt(data.clinker_temp, 0), unit: "°C", trend: getTrend(), isPos: getPos(), Icon: Thermometer, color: "var(--color-warning)" },
        { title: "Rotary Speed", value: fmt(data.rotary_speed_rpm, 2), unit: "rpm", trend: getTrend(), isPos: getPos(), Icon: Settings, color: "var(--color-accent)" },
      ];
    } 
    
    if (selectedMachine.includes("Kiln")) {
      return [
        { title: "Kiln Temp", value: (1000 + random() * 300).toFixed(0), unit: "°C", trend: getTrend(), isPos: getPos(), Icon: Thermometer, color: "var(--color-warning)" },
        { title: "Airflow Rate", value: (15000 + random() * 8000).toFixed(0), unit: "m³/s", trend: getTrend(), isPos: getPos(), Icon: Wind, color: "var(--color-accent)" },
        { title: "Fuel Usage", value: (200 + random() * 300).toFixed(0), unit: "L/hr", trend: getTrend(), isPos: getPos(), Icon: Fuel, color: "var(--color-error)" },
        { title: "O2 Level", value: (2 + random() * 3).toFixed(1), unit: "%", trend: getTrend(), isPos: getPos(), Icon: Activity, color: "var(--color-success)" },
        { title: "Outlet Pressure", value: (10 + random() * 20).toFixed(0), unit: "Pa", trend: getTrend(), isPos: getPos(), Icon: Minimize2, color: "var(--color-success)" },
        { title: "Power Factor", value: (0.85 + random() * 0.1).toFixed(2), unit: "", trend: getTrend(), isPos: getPos(), Icon: Zap, color: "var(--color-accent)" },
        { title: "Shell Temp", value: (250 + random() * 100).toFixed(0), unit: "°C", trend: getTrend(), isPos: getPos(), Icon: Thermometer, color: "var(--color-warning)" },
        { title: "Grate Speed", value: (4 + random() * 2).toFixed(1), unit: "m/min", trend: getTrend(), isPos: getPos(), Icon: Settings, color: "var(--color-accent)" },
      ];
    } 
    
    if (selectedMachine.includes("Motor") || selectedMachine.includes("Unit") || selectedMachine.includes("Belt") || selectedMachine.includes("Fan") || selectedMachine.includes("Mill")) {
      return [
        { title: "Vibration", value: (0.2 + random() * 2.0).toFixed(2), unit: "mm/s", trend: getTrend(), isPos: getPos(), Icon: Activity, color: "var(--color-accent)" },
        { title: "RPM", value: (1400 + random() * 100).toFixed(0), unit: "rpm", trend: getTrend(), isPos: getPos(), Icon: Settings, color: "var(--color-success)" },
        { title: "Current", value: (45 + random() * 10).toFixed(1), unit: "A", trend: getTrend(), isPos: getPos(), Icon: Zap, color: "var(--color-warning)" },
        { title: "Bearing Temp", value: (60 + random() * 20).toFixed(0), unit: "°C", trend: getTrend(), isPos: getPos(), Icon: Thermometer, color: "var(--color-error)" },
      ];
    }

    return [
      { title: "Status", value: "Active", unit: "", trend: "-", isPos: true, Icon: Info, color: "var(--color-success)" },
      { title: "Efficiency", value: (80 + random() * 15).toFixed(0), unit: "%", trend: getTrend(), isPos: true, Icon: TrendingUp, color: "var(--color-accent)" },
    ];
  };

  const kpis = getKPIs();

  // ----- Renders -----

  const MobileHeader = () => (
    <div className="mobile-dashboard-header">
      <span className="view-label">View:</span>
      <div className="dropdown-container">
        <select value={selectedMachine} onChange={(e) => handleMachineSelect(e.target.value)}>
          {MachineData.machines.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <ChevronDown size={16} />
      </div>
    </div>
  );

  const Header = () => (
    <div className="header-section">
      <h1 className="header-title">{selectedMachine} Dashboard</h1>
      <p className="header-subtitle">Real-time metrics from SCADA and IIoT sensors.</p>
    </div>
  );

  const MainChart = () => {
    if (!SimulationState.isConnected) {
      return (
        <NeonCard>
          <div className="locked-chart-container main-locked">
            <LineIcon size={64} color="rgba(38, 229, 162, 0.3)" />
            <h3 className="locked-title">Connection Required</h3>
            <p className="locked-subtitle">Connect simulation to view real-time analysis</p>
          </div>
        </NeonCard>
      );
    }

    const chartData = {
      labels: timeSeries.map(d => d.x.toString()),
      datasets: [
        {
          label: 'Temperature',
          data: timeSeries.map(d => d.energy),
          borderColor: '#FFB300',
          backgroundColor: 'rgba(255, 179, 0, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        },
        {
          label: 'Vibration',
          data: timeSeries.map(d => d.fuel),
          borderColor: '#00E5FF',
          backgroundColor: 'rgba(0, 229, 255, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        },
        {
          label: 'Pressure',
          data: timeSeries.map(d => d.pressure),
          borderColor: '#00E676',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0
        }
      ]
    };

    return (
      <NeonCard>
        <div className="chart-tabs">
          {['Temperature', 'Vibration', 'Pressure', 'Load', 'Airflow'].map(tab => (
            <div 
              key={tab} 
              className={`chart-tab ${selectedChartTab === tab ? 'active' : ''} ${isWide ? 'wide' : ''}`}
              onClick={() => setSelectedChartTab(tab)}
            >
              {tab}
            </div>
          ))}
        </div>
        
        <LiveTelemetryChart data={chartData} title="" />
      </NeonCard>
    );
  };

  const SecondaryCharts = () => {
    if (!SimulationState.isConnected) {
      return (
        <NeonCard>
          <div className="locked-chart-container secondary-locked">
            <PieIcon size={48} color="rgba(38, 229, 162, 0.3)" />
            <h3 className="locked-title">Detailed Metrics Locked</h3>
            <p className="locked-subtitle">Connect to reveal performance breakdowns</p>
          </div>
        </NeonCard>
      );
    }

    const RadarC = () => {
      let rs = Math.abs(hashCode(selectedMachine));
      const rand = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
      const data = [
        { subject: 'Temp', A: 60 + rand() * 40 },
        { subject: 'Vibration', A: 60 + rand() * 40 },
        { subject: 'Pressure', A: 60 + rand() * 40 },
        { subject: 'Flow', A: 60 + rand() * 40 },
        { subject: 'Power', A: 60 + rand() * 40 },
        { subject: 'Efficiency', A: 60 + rand() * 40 },
      ];
      return (
        <NeonCard className="flex-1 min-h-[300px]">
          <h3 className="section-title">Equipment Health Score</h3>
          <p className="section-subtitle">Multi-dimensional analysis</p>
          <div style={{ height: 250, width: '100%', marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-text-primary)', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Machine" dataKey="A" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </NeonCard>
      );
    };

    const BarC = () => {
      let rs = Math.abs(hashCode(selectedMachine));
      const rand = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
      const hours = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
      const data = hours.map((h) => {
        let v = 60 + rand() * 50;
        let c = v > 100 ? 'var(--color-error)' : (v > 80 ? 'var(--color-accent)' : 'var(--color-warning)');
        return { name: h, rate: v, fill: c };
      });

      return (
        <NeonCard className="flex-1 min-h-[300px]">
          <h3 className="section-title">Hourly Production Rate</h3>
          <p className="section-subtitle">Last 6 hours comparison</p>
          <div style={{ height: 250, width: '100%', marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={false} axisLine={false} tickLine={false} domain={[0, 120]} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </NeonCard>
      );
    };

    const PieC = () => {
      let rs = Math.abs(hashCode(selectedMachine));
      const rand = () => { rs = (rs * 9301 + 49297) % 233280; return rs / 233280; };
      let v1 = Math.floor(20 + rand() * 20);
      let v2 = Math.floor(20 + rand() * 20);
      let v3 = Math.floor(20 + rand() * 20);
      let v4 = 100 - v1 - v2 - v3;
      
      const data = [
        { name: 'Kiln', value: v1, fill: 'var(--color-warning)' },
        { name: 'Motors', value: v2, fill: 'var(--color-accent)' },
        { name: 'HVAC', value: v3, fill: 'var(--color-success)' },
        { name: 'Other', value: v4, fill: 'var(--color-error)' },
      ];

      return (
        <NeonCard className="flex-1 min-h-[300px]">
          <h3 className="section-title">Energy Distribution</h3>
          <p className="section-subtitle">Current consumption breakdown</p>
          <div style={{ height: 220, width: '100%', marginTop: '24px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} stroke="none" labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold">
                        {`${value}%`}
                      </text>
                    );
                  }}
                >
                  {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center-text">
              <span className="pie-center-value">4,500</span>
              <span className="pie-center-label">kW Total</span>
            </div>
          </div>
          <div className="chart-legend" style={{marginTop: '16px'}}>
            <div className="legend-item"><div className="legend-dot" style={{backgroundColor: 'var(--color-warning)'}}></div>Kiln</div>
            <div className="legend-item"><div className="legend-dot" style={{backgroundColor: 'var(--color-accent)'}}></div>Motors</div>
            <div className="legend-item"><div className="legend-dot" style={{backgroundColor: 'var(--color-success)'}}></div>HVAC</div>
            <div className="legend-item"><div className="legend-dot" style={{backgroundColor: 'var(--color-error)'}}></div>Other</div>
          </div>
        </NeonCard>
      );
    }

    return (
      <div className={`secondary-charts ${isWide ? 'wide' : 'column'}`}>
        {RadarC()}
        {BarC()}
        {PieC()}
      </div>
    );
  };

  const MobileContent = () => (
    <div className="dashboard-content mobile-pd">
      {MobileHeader()}
      <div className="spacer-24"></div>
      
      <div className="kpi-grid mobile-grid">
        {kpis.map((kpi, idx) => (
          <KPICard 
            key={idx}
            title={kpi.title} 
            value={SimulationState.isConnected ? kpi.value : "---"}
            unit={SimulationState.isConnected ? kpi.unit : ""}
            trend={SimulationState.isConnected ? kpi.trend : "-"}
            isPositiveTrend={kpi.isPos}
            icon={kpi.Icon}
            accentColor={SimulationState.isConnected ? kpi.color : 'rgba(255,255,255,0.2)'}
            isWeb={false}
          />
        ))}
      </div>
      <div className="spacer-24"></div>
      
      {MainChart()}
      <div className="spacer-24"></div>
      
      {SecondaryCharts()}
      <div className="spacer-24"></div>

      <BearingHealthPanel />
      <div className="spacer-24"></div>
      
      <PlantHeatmap isMobile={true} selectedMachine={selectedMachine} />
      <div className="spacer-24"></div>
      
      <DashboardRightPanel isMobile={true} />
    </div>
  );

  const WebContent = () => (
    <div className="dashboard-web-layout">
      <div className="dashboard-sidebar">
        <PlantExplorer onMachineSelected={handleMachineSelect} />
      </div>
      <div className="dashboard-main-scroll">
        <div className="dashboard-content web-pd">
          {Header()}
          <div className="spacer-24"></div>
          
          <div className="kpi-grid web-grid">
            {kpis.map((kpi, idx) => (
              <KPICard 
                key={idx}
                title={kpi.title} 
                value={SimulationState.isConnected ? kpi.value : "---"}
                unit={SimulationState.isConnected ? kpi.unit : ""}
                trend={SimulationState.isConnected ? kpi.trend : "-"}
                isPositiveTrend={kpi.isPos}
                icon={kpi.Icon}
                accentColor={SimulationState.isConnected ? kpi.color : 'rgba(255,255,255,0.2)'}
                isWeb={true}
              />
            ))}
          </div>
          <div className="spacer-24"></div>

          {MainChart()}
          <div className="spacer-24"></div>

          {SecondaryCharts()}
          <div className="spacer-24"></div>

          <BearingHealthPanel />
          <div className="spacer-24"></div>

          <PlantHeatmap isMobile={false} selectedMachine={selectedMachine} />
        </div>
      </div>
      <div className="dashboard-right">
        <DashboardRightPanel isMobile={false} />
      </div>
    </div>
  );

  return isWide ? WebContent() : MobileContent();
};

export default DashboardScreen;
