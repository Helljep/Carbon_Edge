import React, { useState, useEffect } from 'react';
import { useRealPlant } from '../../services/realPlantContext';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ShieldAlert, XCircle, AlertTriangle, AlertCircle, TrendingUp, Info } from 'lucide-react';
import './DashboardPages.css';

/**
 * Alerts built by rules (services/alertRules.js) from the real replayed model outputs:
 * bearing anomaly alarms, hydraulic component diagnoses and unexpected plant energy use.
 */
const AlertsScreen = () => {
  const { feeds, alerts, lastMessageAt, ackAlert, deleteAlert, clearAlerts } = useRealPlant();
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [severityFilters, setSeverityFilters] = useState({
    High: true, Warning: true, Low: true
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const running = Object.values(feeds).some((f) => f.phase === 'running');
  const connectionStatus = running ? 'Connected' : 'Disconnected';
  const secondsAgo = lastMessageAt ? Math.max(0, Math.round((now - lastMessageAt) / 1000)) : null;

  const filteredAlerts = alerts.filter(a => severityFilters[a.severity]);
  const selectedAlert = filteredAlerts.find(a => a.id === selectedId) || filteredAlerts[0];
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
      {(connectionStatus === 'Connected' && secondsAgo !== null) && (
        <span className="last-update">Last update: {secondsAgo}s ago</span>
      )}
      <span className="last-update">Replayed real data: NASA bearings, ZeMA hydraulics, steel-plant energy</span>
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
      <button className="clear-all-btn" onClick={clearAlerts}>
        Clear All Alerts
      </button>
    </div>
  );

  const AlertCard = ({ alert }) => {
    const isSelected = selectedAlert && selectedAlert.id === alert.id;
    const isAck = alert.acknowledged;
    const { color } = getSeverityObj(alert.severity);

    return (
      <div 
        className={`alert-card ${isSelected ? 'selected' : ''} ${isAck ? 'ack' : ''}`}
        style={{ borderColor: isSelected ? color : 'rgba(255,255,255,0.1)' }}
        onClick={() => setSelectedId(alert.id)}
      >
        <div className="alert-card-edge" style={{ backgroundColor: color }}></div>
        <div className="alert-card-content">
          <div className="alert-card-header">
            <span className="alert-title">{alert.title}</span>
            {isAck && <span className="ack-badge">ACK</span>}
            <div className="flex-spacer"></div>
            <XCircle size={16} className="del-btn" onClick={(e) => { e.stopPropagation(); deleteAlert(alert.id); }} />
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
    const alert = selectedAlert;
    if (!alert) return null;
    const { color } = getSeverityObj(alert.severity);
    const isAck = alert.acknowledged;

    // Convert chart data
    const topCauses = alert.rawData?.top_causes || [];
    const chartData = topCauses.map((c, i) => ({
      name: c.sensor,
      impact: Number(c.impact.toFixed(2))
    }));

    return (
      <div className="alert-detail-panel">
        <div className="detail-header">
          <h2>{alert.title}</h2>
          <div className="severity-badge" style={{ backgroundColor: color }}>{alert.severity}</div>
        </div>

        <h3 className="section-title">{alert.chartTitle || 'Sensor Impact Analysis'}</h3>
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

        <h3 className="section-title">Likely Cause (rule-based)</h3>
        <div className="detail-box">
          <p className="box-title">{alert.rootCause}</p>
          <p className="box-sub">{alert.rootCauseDetail}</p>
        </div>

        <h3 className="section-title">Suggested Checks (rule-based)</h3>
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

        <h3 className="section-title">Why this alert fired</h3>
        <pre className="detail-box" style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{alert.eventLog}</pre>

        <div className="detail-actions">
          <button 
            className={`action-btn outline ${isAck ? 'disabled' : ''}`}
            style={{ color: isAck ? 'rgba(38,229,162,0.5)' : 'var(--color-accent)', borderColor: isAck ? 'rgba(38,229,162,0.5)' : 'var(--color-accent)' }}
            onClick={() => !isAck && ackAlert(alert.id)}
            disabled={isAck}
          >
            {isAck ? "Acknowledged" : "Acknowledge"}
          </button>
          <button 
            className="action-btn outline"
            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
            onClick={() => deleteAlert(alert.id)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="alerts-container">
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
                filteredAlerts.map((a) => <div key={a.id}>{AlertCard({ alert: a })}</div>)
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
                  <p>Monitoring the replayed streams. Alerts appear when a rule fires...</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle size={48} color="rgba(255,255,255,0.2)" />
                  <p>Not connected to the replay backend</p>
                </div>
              ) : (
                filteredAlerts.map((a) => <div key={a.id}>{AlertCard({ alert: a })}</div>)
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
