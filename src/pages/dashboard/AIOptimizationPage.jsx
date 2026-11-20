import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Brain, BarChart2, TrendingUp, Activity, Cpu, CheckCircle, ShieldCheck, Scale, AlertOctagon } from 'lucide-react';
import SimulationState from '../../services/SimulationState';
import './DashboardPages.css';
import './AIOptimization.css'; // Create specific styles if needed
import SimulatedBadge from '../../components/SimulatedBadge';

class HardcodedDataSimulator {
  constructor() {
    this.intervalId = null;
    this.currentSeverity = 'normal';
    this.subscribers = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  emit(data) {
    this.subscribers.forEach(cb => cb(data));
  }

  connect() {
    this.currentSeverity = 'low';
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      const prediction = this._generatePrediction();
      this.emit(prediction);
    }, 1000);

    this.emit(this._generatePrediction());
  }

  _generatePrediction() {
    const now = new Date();
    const seconds = SimulationState.currentSeconds;

    const isAnomaly = seconds >= 60 && seconds < 80;

    if (seconds === 0) {
      this.currentSeverity = 'normal';
    }

    if (isAnomaly) {
      return this._generateAnomalyPrediction(now);
    } else {
      return this._generateNormalPrediction(now);
    }
  }

  _generateNormalPrediction(timestamp) {
    const anomalyScore = SimulationState.getAnomalyScore('normal', Math.random);
    const confidence = 88.0 + Math.random() * 4.0;
    const stability = 92.0 + Math.random() * 4.0;

    return {
      plantId: 'cement_kiln_01',
      timestamp: this._formatTimestamp(timestamp),
      severity: 'normal',
      anomalyScore: anomalyScore,
      confidence: confidence,
      stability: stability,
      rollingAvg: 0.16 + Math.random() * 0.1,
      rollingStd: 0.025 + Math.random() * 0.01,
      topCauses: [
        { sensor: 'vibration_level', impact: 2.2 + Math.random() * 0.3 },
        { sensor: 'kiln_pressure', impact: 1.9 + Math.random() * 0.2 },
        { sensor: 'exhaust_co2', impact: 1.6 + Math.random() * 0.2 }
      ],
      rootCause: 'System operating within normal parameters',
      recommendation: 'Continue monitoring - all systems nominal',
      bufferFilled: true,
      bufferLen: 50
    };
  }

  _generateAnomalyPrediction(timestamp) {
    const targetSeverity = SimulationState.currentCycleSeverity;
    const anomalyScore = SimulationState.getAnomalyScore(targetSeverity, Math.random);
    const confidence = 78.0 + Math.random() * 8.0;
    const stability = 65.0 + Math.random() * 8.0;

    if (this.currentSeverity === 'normal') {
      this.currentSeverity = targetSeverity;
    }

    return {
      plantId: 'cement_kiln_01',
      timestamp: this._formatTimestamp(timestamp),
      severity: this.currentSeverity,
      anomalyScore: anomalyScore,
      confidence: confidence,
      stability: stability,
      rollingAvg: 0.68 + Math.random() * 0.15,
      rollingStd: 0.12 + Math.random() * 0.08,
      topCauses: [
        { sensor: 'vibration_level', impact: 8.2 + Math.random() * 1.5 },
        { sensor: 'temperature_zone_3', impact: 7.5 + Math.random() * 1.2 },
        { sensor: 'kiln_pressure', impact: 6.8 + Math.random() * 1.0 },
        { sensor: 'exhaust_co2', impact: 5.9 + Math.random() * 0.8 },
        { sensor: 'feed_rate', impact: 4.5 + Math.random() * 0.7 }
      ],
      rootCause: 'Abnormal vibration pattern detected in kiln rotation system',
      recommendation: 'Immediate inspection of kiln bearings and drive system recommended. Reduce feed rate by 15% and monitor temperature zones.',
      bufferFilled: true,
      bufferLen: 50
    };
  }

  _formatTimestamp(dt) {
    const pad = n => n.toString().padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  }

  dispose() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.subscribers = [];
  }
}

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

const AIOptimizationPage = () => {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [anomalyHistory, setAnomalyHistory] = useState([]);
  
  const timerRef = useRef(0);
  const simulatorRef = useRef(null);

  useEffect(() => {
    simulatorRef.current = new HardcodedDataSimulator();
    
    const unsubscribe = simulatorRef.current.subscribe((data) => {
      setPrediction(data);
      setError(null);
      
      timerRef.current += 1;
      setAnomalyHistory(prev => {
        const newHist = [...prev, { time: timerRef.current, score: data.anomalyScore }];
        if (newHist.length > 50) newHist.shift();
        return newHist;
      });
    });

    simulatorRef.current.connect();

    return () => {
      unsubscribe();
      if (simulatorRef.current) simulatorRef.current.dispose();
    };
  }, []);

  const isWide = window.innerWidth > 1200;

  if (error) {
    return (
      <div className="ai-container center-content">
        <AlertOctagon size={64} className="error-icon" />
        <h2 className="error-title">Connection Error</h2>
        <p className="error-text">{error}</p>
        <button className="btn-retry" onClick={() => simulatorRef.current.connect()}>Retry Connection</button>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="ai-container center-content">
        <div className="spinner"></div>
        <p className="loading-text">Connecting to AI System...</p>
      </div>
    );
  }

  const isNormal = !prediction.severity || ['normal', 'low'].includes(prediction.severity.toLowerCase());
  const displayCauses = isNormal 
    ? [
        { sensor: 'VIBRATION LEVEL', impact: 10.0 },
        { sensor: 'KILN PRESSURE', impact: 10.0 },
        { sensor: 'EXHAUST CO2', impact: 10.0 }
      ]
    : prediction.topCauses;

  const getBarColor = (impact) => {
    if (isNormal) return 'var(--color-accent)';
    if (impact >= 7) return 'var(--color-error)';
    if (impact >= 4) return 'var(--color-orange)';
    return 'var(--color-lime)';
  };

  return (
    <div className="ai-container">
      <div className="ai-layout-wrapper">
        <div className="ai-header">
          <div className="header-left">
            <div className="live-status-row">
              <LivePulse />
              <span className="live-text">SIMULATED MONITORING</span>
              <SimulatedBadge style={{ marginLeft: 8 }} />
            </div>
            <h1 className="plant-id">{prediction.plantId.toUpperCase()}</h1>
            <div className="timestamp-text">{prediction.timestamp}</div>
          </div>
          <div className="header-right">
            <div className="buffer-badge">
              <Cpu size={18} />
              <span>BUFFER: {prediction.bufferLen}</span>
            </div>
          </div>
        </div>

        <div className={`ai-grid ${isWide ? 'grid-desktop' : 'grid-mobile'}`}>
          <div className="grid-cell">
            <NeonPanel title="AI DIAGNOSTICS" icon={Brain} color="var(--color-orange)" expand>
              <div className="diag-group">
                <div className="diag-label root-cause">ROOT CAUSE</div>
                <div className="diag-value">{prediction.rootCause}</div>
              </div>
              <div className="diag-group">
                <div className="diag-label recommendation">RECOMMENDATION</div>
                <div className="diag-value">{prediction.recommendation}</div>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title="SYSTEM HEALTH" icon={Activity} color="var(--color-lime)" expand>
              <div className="health-content-row">
                <div className="health-gauge-area">
                  <SeverityGauge severity={prediction.severity} />
                </div>
                <div className="health-metrics-area">
                  <GlowingMetricCard label="CONFIDENCE" value={`${prediction.confidence.toFixed(1)}%`} icon={ShieldCheck} color="var(--color-accent)" />
                  <GlowingMetricCard label="STABILITY" value={`${prediction.stability.toFixed(1)}%`} icon={Scale} color="var(--color-lime)" />
                  <GlowingMetricCard label="ROLLING AVG" value={prediction.rollingAvg.toFixed(3)} icon={TrendingUp} color="var(--color-orange)" />
                </div>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title="ANOMALY SCORE TREND" icon={TrendingUp} color="var(--color-accent)" expand>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={anomalyHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 1.0]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="score" stroke="var(--color-accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </NeonPanel>
          </div>

          <div className="grid-cell">
            <NeonPanel title="SENSOR IMPACT ANALYSIS" icon={BarChart2} color="var(--color-lime)" expand>
              {isNormal ? (
                <div className="normal-impact-state">
                  <CheckCircle size={32} color="var(--color-lime)" />
                  <span>SYSTEM STATUS NORMAL</span>
                </div>
              ) : (
                <div className="impact-bars-scroll">
                  {displayCauses.map((cause, i) => (
                    <div className="impact-bar-item" key={i}>
                      <div className="impact-bar-header">
                        <span>{cause.sensor.toUpperCase().replace(/_/g, ' ')}</span>
                        { !isNormal && <span style={{ color: getBarColor(cause.impact) }}>{cause.impact.toFixed(2)}</span> }
                      </div>
                      <div className="impact-bar-bg">
                        <div className="impact-bar-fill" style={{ 
                          width: `${Math.min(100, (cause.impact / 10.0) * 100)}%`,
                          backgroundColor: getBarColor(cause.impact)
                        }}></div>
                      </div>
                    </div>
                  ))}
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
