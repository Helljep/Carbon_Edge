import React, { useState, useEffect, useRef } from 'react';
import MachineData from '../../data/machineData';
import SimulationState from '../../services/SimulationState';
import NeonCard from '../../components/NeonCard';
import { Router as RouterIcon, Factory, Wifi, Activity, Shield, ChevronRight } from 'lucide-react';
import './DashboardPages.css';
import SimulatedBadge from '../../components/SimulatedBadge';

const ConnectScadaScreen = () => {
  const [selectedProtocol, setSelectedProtocol] = useState("OPC-UA");
  const [isConnected, setIsConnected] = useState(SimulationState.isConnected);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState([]);
  
  useEffect(() => {
    const unsub = SimulationState.onChange((val) => setIsConnected(val));
    if (SimulationState.isConnected) {
      setDiscoveredMachines(4);
      setConnectionLogs(["Connection established."]);
    }
    return unsub;
  }, []);
  
  const [latency, setLatency] = useState(0);
  const [dataRate, setDataRate] = useState(0.0);
  const [activeTags, setActiveTags] = useState(0);
  const [discoveredMachines, setDiscoveredMachines] = useState(0);

  const [opcUrl, setOpcUrl] = useState("opc.tcp://192.168.100.21:4840");
  const [opcSecurityMode, setOpcSecurityMode] = useState("Sign & Encrypt");
  
  const [mqttBroker, setMqttBroker] = useState("mqtt://192.168.100.50:1883");
  const [mqttTopic, setMqttTopic] = useState("/plant1/kiln1/data");
  const [mqttClientId, setMqttClientId] = useState("carbonedge_sim_01");
  const [mqttQos, setMqttQos] = useState("1");
  
  const [modbusIp, setModbusIp] = useState("192.168.100.90");
  const [modbusPort, setModbusPort] = useState("502");
  const [modbusSlaveId, setModbusSlaveId] = useState("1");

  const logEndRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        setLatency(12 + Math.floor(Math.random() * 8));
        setDataRate(1.0 + Math.random() * 0.4);
        setActiveTags(238 + Math.floor(Math.random() * 5));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [connectionLogs]);

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const toggleConnection = async () => {
    if (isConnected) {
      setIsConnected(false);
      SimulationState.setConnected(false);
      setConnectionLogs([]);
      setActiveTags(0);
      setDataRate(0.0);
      setLatency(0);
      setDiscoveredMachines(0);
      return;
    }

    setIsConnecting(true);
    setConnectionLogs(["Initializing connection sequence..."]);
    
    const steps = [
      "Establishing secure handshake...",
      "Handshake initiated...",
      "Reading server nodes...",
      "Fetching machine registry...",
      "Syncing tags...",
      "Connection established."
    ];

    for (const step of steps) {
      await delay(800);
      setConnectionLogs(prev => [...prev, step]);
    }

    setIsConnected(true);
    SimulationState.setConnected(true);
    setIsConnecting(false);
    setDiscoveredMachines(4);
  };

  const TechCard = ({ children, className = "" }) => (
    <div className={`tech-card ${className}`}>
      <div className="tech-corner tl"></div>
      <div className="tech-corner tr"></div>
      <div className="tech-corner bl"></div>
      <div className="tech-corner br"></div>
      {children}
    </div>
  );

  return (
    <div className="scada-container">
      <div className="scada-header">
        <h1>Connect SCADA</h1>
        <SimulatedBadge />
      </div>

      <div className="scada-content">
        <div className="scada-left">
          <TechCard>
            <div className="protocol-tabs">
              {["OPC-UA", "MQTT", "Modbus TCP"].map(p => (
                <div 
                  key={p} 
                  className={`protocol-tab ${selectedProtocol === p ? 'active' : ''}`}
                  onClick={() => setSelectedProtocol(p)}
                >
                  {p}
                </div>
              ))}
            </div>
          </TechCard>

          <NeonCard className="scada-form" glow={false} padding="24px">
            {selectedProtocol === "OPC-UA" && (
              <>
                <div className="input-group">
                  <label>Server URL</label>
                  <input type="text" value={opcUrl} onChange={e => setOpcUrl(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Security Mode</label>
                  <select value={opcSecurityMode} onChange={e => setOpcSecurityMode(e.target.value)}>
                    <option>None</option>
                    <option>Sign</option>
                    <option>Sign & Encrypt</option>
                  </select>
                </div>
              </>
            )}
            {selectedProtocol === "MQTT" && (
              <>
                <div className="input-group">
                  <label>Broker URL</label>
                  <input type="text" value={mqttBroker} onChange={e => setMqttBroker(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Topic</label>
                  <input type="text" value={mqttTopic} onChange={e => setMqttTopic(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Client ID</label>
                  <input type="text" value={mqttClientId} onChange={e => setMqttClientId(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>QoS</label>
                  <select value={mqttQos} onChange={e => setMqttQos(e.target.value)}>
                    <option>0</option><option>1</option><option>2</option>
                  </select>
                </div>
              </>
            )}
            {selectedProtocol === "Modbus TCP" && (
              <>
                <div className="input-group">
                  <label>IP Address</label>
                  <input type="text" value={modbusIp} onChange={e => setModbusIp(e.target.value)} />
                </div>
                <div className="input-row">
                  <div className="input-group flex-1">
                    <label>Port</label>
                    <input type="text" value={modbusPort} onChange={e => setModbusPort(e.target.value)} />
                  </div>
                  <div className="input-group flex-1">
                    <label>Slave ID</label>
                    <input type="text" value={modbusSlaveId} onChange={e => setModbusSlaveId(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <button 
              className={`connect-btn ${isConnecting ? 'loading' : ''}`} 
              onClick={toggleConnection}
              disabled={isConnecting}
            >
              {isConnecting ? <div className="spinner"></div> : (isConnected ? "Disconnect" : "Connect to Gateway")}
            </button>
          </NeonCard>
          
          <TechCard>
            <h4 className="tech-title">Network Diagnostics</h4>
            <div className="diag-grid">
              <div className="diag-item">
                <Wifi size={16} />
                <span className="diag-val">{isConnected ? (latency + "ms") : "---"}</span>
                <span className="diag-lbl">Ping</span>
              </div>
              <div className="diag-item">
                <Activity size={16} />
                <span className="diag-val">{isConnected ? "-42dBm" : "---"}</span>
                <span className="diag-lbl">Signal</span>
              </div>
              <div className="diag-item">
                <Shield size={16} />
                <span className="diag-val">{isConnected ? "TLS 1.2" : "---"}</span>
                <span className="diag-lbl">Security</span>
              </div>
            </div>
            <div className="diag-bar-bg">
              <div className={`diag-bar-fill ${isConnected ? 'active' : ''}`}></div>
            </div>
          </TechCard>

          <TechCard>
            <h4 className="tech-title">Saved Gateways</h4>
            <div className="saved-gwt">
              <div className="gwt-info">
                <span className="gwt-name">Kiln Main PLC</span>
                <span className="gwt-ip">opc.tcp://192.168.100.21:4840</span>
              </div>
              <ChevronRight size={16} color="var(--color-accent)" />
            </div>
          </TechCard>
        </div>

        <div className="scada-right">
          <NeonCard glow={isConnected} borderColor={isConnected ? "var(--color-success)" : "grey"} className="status-card">
            <div className="status-header">
              <div className={`status-dot ${isConnected ? 'active' : ''}`}></div>
              <span className="status-text">{isConnected ? "Connected" : "Not Connected"}</span>
            </div>
            {isConnected ? (
              <div className="status-grid">
                <div className="stat-item">
                  <span className="stat-label">Latency</span>
                  <span className="stat-value">{latency}ms</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Tags</span>
                  <span className="stat-value">{activeTags}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Data Rate</span>
                  <span className="stat-value">{dataRate.toFixed(1)} MB/s</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Sync</span>
                  <span className="stat-value">Just now</span>
                </div>
              </div>
            ) : (
              <p className="no-status-text">Connect to a gateway to view live statistics.</p>
            )}
          </NeonCard>

          {(isConnecting || isConnected) && (
            <NeonCard className="terminal-card" borderColor="var(--color-accent)">
              <div className="terminal-content">
                {connectionLogs.map((log, i) => (
                  <div key={i} className="terminal-line">{`> ${log}`}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </NeonCard>
          )}

          <div className="map-card-wrapper">
            <div className="map-header">
              <h3 className="section-title text-white" style={{ color: 'white', fontFamily: 'Orbitron, sans-serif', fontSize: '18px' }}>Plant Map</h3>
              {isConnected && <span className="live-badge">LIVE</span>}
            </div>
            
            <div className={`twin-map ${isConnected ? 'glow-map' : ''}`}>
              <div className="gateway-node">
                <div className={`node-icon ${isConnected ? 'active' : ''}`}>
                  <RouterIcon size={32} />
                </div>
                <span>Gateway</span>
              </div>

              {isConnected && (
                <>
                  <div className="machine-node m-tl">
                    <div className="m-icon pulse"><Factory size={24} /></div>
                    <div className="m-data">
                      <span className="m-name">{MachineData.machines[0]}</span>
                      <span className="m-val">145°C | 0.59g</span>
                    </div>
                  </div>
                  <div className="machine-node m-tr">
                    <div className="m-icon pulse"><Factory size={24} /></div>
                    <div className="m-data">
                      <span className="m-name">{MachineData.machines[1]}</span>
                      <span className="m-val">142°C | 0.45g</span>
                    </div>
                  </div>
                  <div className="machine-node m-bl">
                    <div className="m-icon pulse"><Factory size={24} /></div>
                    <div className="m-data">
                      <span className="m-name">Fan 3</span>
                      <span className="m-val">850rpm | 0.12g</span>
                    </div>
                  </div>
                  <div className="machine-node m-br">
                    <div className="m-icon pulse"><Factory size={24} /></div>
                    <div className="m-data">
                      <span className="m-name">Power</span>
                      <span className="m-val">480V | 81%</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {isConnected && (
              <div className="map-info">
                <div className="info-chip">
                  <span className="chip-label">Machines Discovered</span>
                  <span className="chip-value">{discoveredMachines}</span>
                </div>
                <div className="info-chip">
                  <span className="chip-label">Tags Detected</span>
                  <span className="chip-value">{activeTags}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectScadaScreen;
