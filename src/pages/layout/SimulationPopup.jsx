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
          <p>CarbonEdge is designed to connect with real-time factory machines to analyze operational data using AI.</p>
          <p>Since live factory machines are not available during this demo, the app runs in Simulation Mode by default.</p>
          <p>In this mode, the system generates realistic, real-time machine data and processes it through the same AI model and pipeline used for real-world deployments.</p>
          <p>This allows you to experience the full functionality of CarbonEdge exactly as it would work in a live factory environment.</p>
        </div>

        {isConnecting ? (
          <div className="sim-popup-connecting">
            <div className="auth-loader"></div>
            <span>Connecting to AI Model...</span>
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
