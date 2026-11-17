import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';

const SplashScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/auth'); // Route handled by App.jsx
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <img src="/assets/logo.png" alt="Logo" width="180" height="180" onError={(e) => { e.target.style.display = 'none'; }} />
        <div className="splash-spacer-1"></div>
        <h1 className="splash-title">CarbonEdge</h1>
        <div className="splash-spacer-2"></div>
        <p className="splash-subtitle">Industrial Energy Optimization</p>
        <div className="splash-spacer-3"></div>
        <div className="splash-loader"></div>
      </div>
    </div>
  );
};

export default SplashScreen;
