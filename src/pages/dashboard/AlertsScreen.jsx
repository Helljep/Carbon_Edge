import React, { useState, useEffect, useRef } from 'react';
import SimulationState from '../../services/SimulationState';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, AlertCircle, TrendingUp, Info } from 'lucide-react';
import './DashboardPages.css';
import SimulatedBadge from '../../components/SimulatedBadge';

// Global Config
const AlertConfig = {
  anomalyDuration: 2000, // 2 seconds
  coolDownDuration: 5000, // 5 seconds
  pollInterval: 1000,
  maxAlerts: 100,
};

const AlertsScreen = () => {
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [processError, setProcessError] = useState(null);
  const [lastDataReceived, setLastDataReceived] = useState(null);
  
  const [severityFilters, setSeverityFilters] = useState({
    High: true, Warning: true, Low: true
  });

  // Trackers and state that don't need to trigger re-renders directly
  const trackersRef = useRef({});
  const currentSeverityRef = useRef('low');
  const lastAlertTimeRef = useRef(null);
  const isPollingRef = useRef(false);
  const timeSinceRef = useRef(0);

  useEffect(() => {
    let timer;
    if (SimulationState.isConnected) {
      setConnectionStatus('Connected');
      timer = setInterval(() => {
        fetchHealthData();
        timeSinceRef.current = timeSinceRef.current + 1;
      }, AlertConfig.pollInterval);
    } else {
      setConnectionStatus('Disconnected');
    }

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHealthData = () => {
    if (isPollingRef.current || !SimulationState.isConnected) return;
    isPollingRef.current = true;

    try {
      setLastDataReceived(new Date());
      setProcessError(null);
      timeSinceRef.current = 0;

      const data = generateHardcodedHealthData();
      processHealthData(data);
    } catch (e) {
      setProcessError('Processing Error: ' + e.message);
    } finally {
      isPollingRef.current = false;
    }
  };

  const generateHardcodedHealthData = () => {
    const seconds = new Date().getSeconds(); // Use real seconds for faster cycling
    const isAnomaly = (seconds % 15) >= 5; // 5s nominal, 10s anomaly loop
    const threshold = 0.65;

    if (!isAnomaly) {
      currentSeverityRef.current = 'normal';
    }

    if (isAnomaly) {
      return generateAnomalyHealthData(threshold);
    } else {
      return generateNormalHealthData(threshold);
    }
  };

  const generateNormalHealthData = (threshold) => {
    return {
      threshold,
      latest_predictions: {
        'cement_kiln_01': {
          severity: 'normal',
          raw_anomaly_score: Math.random() * 0.2 + 0.1,
          confidence: 88.0 + Math.random() * 4.0,
          stability: 92.0 + Math.random() * 4.0,
          rolling_avg: 0.15 + Math.random() * 0.1,
          rolling_std: 0.02 + Math.random() * 0.03,
          top_causes: [],
          root_cause: 'System operating within normal parameters',
          recommendation: 'Continue monitoring - all systems nominal',
        }
      },
      latest_sensor_values: {
        'cement_kiln_01': {
          values: {
            vibration_level: 2.1 + Math.random() * 0.5,
            kiln_pressure: 98.5 + Math.random() * 1.5,
            exhaust_co2: 4.2 + Math.random() * 0.3,
            temperature_zone_1: 850.0 + Math.random() * 10.0,
          }
        }
      }
    };
  };

  const generateAnomalyHealthData = (threshold) => {
    const targetSeverity = SimulationState.currentCycleSeverity;
    if (currentSeverityRef.current === 'normal') {
      currentSeverityRef.current = targetSeverity;
    }

    return {
      threshold,
      latest_predictions: {
        'cement_kiln_01': {
          severity: currentSeverityRef.current,
          raw_anomaly_score: Math.random() * 0.4 + 0.6,
          confidence: 78.0 + Math.random() * 8.0,
          stability: 65.0 + Math.random() * 8.0,
          rolling_avg: 0.65 + Math.random() * 0.15,
          rolling_std: 0.05 + Math.random() * 0.05,
          top_causes: [
            { sensor: 'vibration_level', impact: 7.5 + Math.random() * 1.2 },
            { sensor: 'kiln_pressure', impact: 6.8 + Math.random() * 1.0 },
            { sensor: 'exhaust_co2', impact: 5.9 + Math.random() * 0.8 },
            { sensor: 'temperature_zone_3', impact: 5.2 + Math.random() * 0.7 },
          ],
          root_cause: 'Abnormal vibration pattern detected in kiln rotation system',
          recommendation: 'Immediate inspection of kiln bearings and drive system recommended. Reduce feed rate by 15% and monitor temperature zones.',
        }
      },
      latest_sensor_values: {
        'cement_kiln_01': {
          values: {
            vibration_level: 8.5 + Math.random() * 1.5,
            kiln_pressure: 105.0 + Math.random() * 3.0,
            exhaust_co2: 6.8 + Math.random() * 0.5,
            temperature_zone_1: 870.0 + Math.random() * 15.0,
          }
        }
      }
    };
  };

  const processHealthData = (data) => {
    const predictions = data.latest_predictions;
    if (!predictions) return;

    for (const [plantId, prediction] of Object.entries(predictions)) {
      trackAnomaly(plantId, prediction, data);
    }
  };

  const trackAnomaly = (plantId, prediction, healthData) => {
    const rawSeverity = (prediction.severity || 'normal').toLowerCase();

    if (rawSeverity === 'normal') {
      if (trackersRef.current[plantId]) {
        trackersRef.current[plantId].isTracking = false;
      }
      return;
    }

    if (!trackersRef.current[plantId]) {
      trackersRef.current[plantId] = { isTracking: false, startTime: null };
    }

    const tracker = trackersRef.current[plantId];

    if (!tracker.isTracking) {
      tracker.isTracking = true;
      tracker.startTime = new Date();
    } else {
      const now = new Date();
      const duration = now - tracker.startTime;

      if (duration >= AlertConfig.anomalyDuration) {
        if (!lastAlertTimeRef.current || (now - lastAlertTimeRef.current) >= AlertConfig.coolDownDuration) {
          createAlert(plantId, prediction, healthData, duration / 1000);
          lastAlertTimeRef.current = now;
          // restart tracking
          tracker.startTime = now;
        }
      }
    }
  };

  const mapSeverity = (apiSeverity) => {
    switch (apiSeverity.toLowerCase()) {
      case 'critical': case 'high': case 'danger': return 'High';
      case 'warning': return 'Warning';
      default: return 'Low';
    }
  };

  const createAlert = (plantId, prediction, healthData, durationSecs) => {
    const severity = mapSeverity(prediction.severity || 'normal');
    
    let topCausesDetail = '';
    let topCauses = prediction.top_causes || [];
    if (topCauses.length > 0) {
      const sensors = topCauses.slice(0, 3).map(c => c.sensor).join(', ');
      topCausesDetail = `Top contributing sensors: ${sensors}`;
    }

    let sensorValuesLog = '';
    const sensors = healthData.latest_sensor_values?.[plantId]?.values;
    if (sensors) {
      sensorValuesLog = Object.entries(sensors)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`)
        .join('\n');
    }

    const newAlert = {
      id: Date.now().toString(),
      title: `AI Anomaly Detected - ${plantId}`,
      description: `Anomaly persisted for ${Math.floor(durationSecs)} seconds`,
      machine: plantId.toUpperCase().replace('_', ' '),
      time: new Date().toLocaleTimeString(),
      timestamp: new Date(),
      severity,
      rootCause: prediction.root_cause || 'Anomaly detected',
      rootCauseDetail: topCausesDetail || `Pattern detected by AI model.`,
      action: prediction.recommendation || 'Monitor system closely',
      additionalActions: [
        "Review sensor trends for the past hour",
        "Check maintenance logs for recent work",
        "Verify calibration of top contributing sensors"
      ],
      eventLog: `Auto-generated alert for persistent anomaly\nDuration: ${Math.floor(durationSecs)} seconds\nScore: ${Number(prediction.raw_anomaly_score).toFixed(3)}\n\nRecent Sensors:\n${sensorValuesLog}`,
      rawData: { ...prediction, top_causes: topCauses, duration_seconds: durationSecs },
      acknowledged: false
    };

    setAlerts(prev => {
      const updated = [newAlert, ...prev].slice(0, AlertConfig.maxAlerts);
      return updated;
    });
    setSelectedAlertIndex(0);
  };

  const deleteAlert = (index) => {
    setAlerts(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedAlertIndex >= updated.length) {
        setSelectedAlertIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const acknowledgeAlert = (index) => {
    setAlerts(prev => {
      const updated = [...prev];
      if (updated[index]) updated[index].acknowledged = true;
      return updated;
    });
  };

  const filteredAlerts = alerts.filter(a => severityFilters[a.severity]);
  const isWide = window.innerWidth > 1000;

  // Render Helpers
  const getSeverityObj = (severity) => {
    if (severity === 'High') return { color: 'var(--color-error)', icon: XCircle };
    if (severity === 'Warning') return { color: 'var(--color-orange)', icon: AlertTriangle };
    return { color: 'var(--color-accent)', icon: Info };
  };

  const StatusBar = () => (
    <div className="alerts-status-bar">
      <div className="status-indicator">
        <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}></div>
        <span>{connectionStatus}</span>
      </div>
      {(connectionStatus === 'Connected' && lastDataReceived) && (
        <span className="last-update">Last update: {timeSinceRef.current}s ago</span>
      )}
      {processError && <span className="process-error">{processError}</span>}
      <div className="flex-spacer"></div>
      <span className="active-count">Active Alerts: {filteredAlerts.length}</span>
    </div>
  );

  const FilterPanel = () => (
    <div className="alerts-filter-panel">
      <h3>Alert Filter Controls</h3>
      <div className="filter-chips">
        {['High', 'Warning', 'Low'].map(s => {
          const { color } = getSeverityObj(s);
          const active = severityFilters[s];
          return (
            <div 
              key={s} 
              className={`filter-chip ${active ? 'active' : ''}`}
              style={{ borderColor: active ? color : 'rgba(255,255,255,0.1)', color: active ? color : 'var(--color-text-secondary)', backgroundColor: active ? `${color}20` : 'transparent' }}
              onClick={() => setSeverityFilters(f => ({ ...f, [s]: !f[s] }))}
            >
              {s}
            </div>
          );
        })}
      </div>
      <button className="clear-all-btn" onClick={() => {
        setAlerts([]);
        trackersRef.current = {};
      }}>
        Clear All Alerts
      </button>
    </div>
  );

  const AlertCard = ({ alert, index }) => {
    const isSelected = selectedAlertIndex === index;
    const isAck = alert.acknowledged;
    const { color } = getSeverityObj(alert.severity);

    return (
      <div 
        className={`alert-card ${isSelected ? 'selected' : ''} ${isAck ? 'ack' : ''}`}
        style={{ borderColor: isSelected ? color : 'rgba(255,255,255,0.1)' }}
        onClick={() => setSelectedAlertIndex(index)}
      >
        <div className="alert-card-edge" style={{ backgroundColor: color }}></div>
        <div className="alert-card-content">
          <div className="alert-card-header">
            <span className="alert-title">{alert.title}</span>
            {isAck && <span className="ack-badge">ACK</span>}
            <div className="flex-spacer"></div>
            <XCircle size={16} className="del-btn" onClick={(e) => { e.stopPropagation(); deleteAlert(index); }} />
          </div>
          <p className="alert-desc">{alert.description}</p>
          <div className="alert-meta">
            <span style={{color}}>{alert.machine}</span> • <span>{alert.time}</span>
          </div>
        </div>
      </div>
    );
  };

  const DetailPanel = () => {
    const alert = filteredAlerts[selectedAlertIndex];
    if (!alert) return null;
    const { color } = getSeverityObj(alert.severity);
    const isAck = alert.acknowledged;

    // Convert chart data
    const topCauses = alert.rawData?.top_causes || [];
    const chartData = topCauses.map((c, i) => ({
      name: c.sensor.split('_')[0],
      impact: c.impact
    }));

    return (
      <div className="alert-detail-panel">
        <div className="detail-header">
          <h2>{alert.title}</h2>
          <div className="severity-badge" style={{ backgroundColor: color }}>{alert.severity}</div>
        </div>

        <h3 className="section-title">Sensor Impact Analysis</h3>
        <div className="detail-chart-container">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#828D9F', fontSize: 11}} tickCount={5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#828D9F', fontSize: 11}} dy={10} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#1A202C', border: 'none', borderRadius: '8px', color: '#fff'}}
                  itemStyle={{color: '#fff'}}
                />
                <Area 
                  type="monotone" 
                  dataKey="impact" 
                  stroke={color} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorImpact)" 
                  dot={{ r: 5, fill: color, stroke: '#121820', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-chart-data">No specific sensor impact data available.</div>
          )}
        </div>

        <h3 className="section-title">Root-Cause Analysis</h3>
        <div className="detail-box">
          <p className="box-title">{alert.rootCause}</p>
          <p className="box-sub">{alert.rootCauseDetail}</p>
        </div>

        <h3 className="section-title">Recommended Actions</h3>
        <div className="detail-box action-box">
          <TrendingUp color="var(--color-orange)" size={16} />
          <span>{alert.action}</span>
        </div>
        
        {alert.additionalActions && alert.additionalActions.map((act, i) => (
          <div key={i} className="detail-box action-box mt-2">
            <TrendingUp color="var(--color-orange)" size={16} />
            <span>{act}</span>
          </div>
        ))}

        <div className="detail-actions">
          <button 
            className={`action-btn outline ${isAck ? 'disabled' : ''}`}
            style={{ color: isAck ? 'rgba(38,229,162,0.5)' : 'var(--color-accent)', borderColor: isAck ? 'rgba(38,229,162,0.5)' : 'var(--color-accent)' }}
            onClick={() => !isAck && acknowledgeAlert(selectedAlertIndex)}
            disabled={isAck}
          >
            {isAck ? "Acknowledged" : "Acknowledge"}
          </button>
          <button 
            className="action-btn outline"
            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
            onClick={() => deleteAlert(selectedAlertIndex)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="alerts-container">
      <div style={{ padding: '8px 16px 0' }}><SimulatedBadge /></div>
      {StatusBar()}
      <div className={`alerts-layout ${isWide ? 'wide' : 'narrow'}`}>
        <div className="alerts-left">
          {FilterPanel()}
          {!isWide && <div className="spacer-16"></div>}
          {!isWide && (
             <div className="alerts-list">
              {filteredAlerts.length === 0 ? (
                <div className="empty-state">No alerts to show.</div>
              ) : (
                filteredAlerts.map((a, i) => <div key={a.id}>{AlertCard({ alert: a, index: i })}</div>)
              )}
            </div>
          )}
        </div>
        
        {isWide && (
          <div className="alerts-middle">
            <div className="alerts-list">
              {filteredAlerts.length === 0 && connectionStatus === 'Connected' ? (
                <div className="empty-state">
                  <ShieldAlert size={48} color="rgba(255,255,255,0.2)" />
                  <p>Monitoring for anomalies...</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle size={48} color="rgba(255,255,255,0.2)" />
                  <p>Simulation Disconnected</p>
                </div>
              ) : (
                filteredAlerts.map((a, i) => <div key={a.id}>{AlertCard({ alert: a, index: i })}</div>)
              )}
            </div>
          </div>
        )}

        {isWide && (
          <div className="alerts-right">
            {filteredAlerts.length > 0 ? DetailPanel() : <div className="empty-detail"></div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsScreen;
