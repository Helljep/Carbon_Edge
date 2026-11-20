import React, { useState, useEffect } from 'react';
import SimulationState from '../../services/SimulationState';
import './MainLayout.css';

const SimulationPopup = ({ onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      SimulationState.isConnected = true;
      setIsConnecting(false);
      if (onConnect) onConnect();
    }, 3000);
  };

  return (
    <div className="sim-popup-overlay">
      <div className="sim-popup-card">
        <h2 className="sim-popup-title">Welcome to CarbonEdge</h2>
        <div className="sim-popup-content">
          <p>CarbonEdge monitors industrial machines and flags faults and energy waste early.</p>
          <p>No live factory is connected in this demo. The Dashboard replays <b>recorded real data</b> from public datasets: NASA IMS bearing run-to-failure data, the ZeMA hydraulic test rig, and a steel plant&apos;s 2018 energy readings.</p>
          <p>The other pages (Connect SCADA) still uses <b>simulated</b> numbers and is labelled as such.</p>
        </div>

        {isConnecting ? (
          <div className="sim-popup-connecting">
            <div className="auth-loader"></div>
            <span>Starting replay...</span>
          </div>
        ) : (
          <button className="sim-popup-btn" onClick={handleConnect}>
            Connect Model
          </button>
        )}
      </div>
    </div>
  );
};

export default SimulationPopup;
