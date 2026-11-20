import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import SimulationPopup from './SimulationPopup';
import { RealPlantProvider } from '../../services/RealPlantFeed';
import { useRealPlant } from '../../services/realPlantContext';
import { LayoutDashboard, Link as LinkIcon, Bell, Lightbulb, BarChart2, User } from 'lucide-react';
import './MainLayout.css';

// number of unacknowledged alerts, shown next to the Alerts nav item
const AlertCount = () => {
  const { alerts } = useRealPlant();
  const n = alerts.filter((a) => !a.acknowledged).length;
  if (!n) return null;
  return (
    <span style={{ background: 'var(--color-error)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 4 }}>
      {n > 99 ? '99+' : n}
    </span>
  );
};

const MainLayout = () => {
  const [showSimulationPopup, setShowSimulationPopup] = useState(true);
  const [isWeb, setIsWeb] = useState(window.innerWidth > 800);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsWeb(window.innerWidth > 800);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { path: '/home/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/home/connect', label: 'Connect SCADA', icon: LinkIcon },
    { path: '/home/alerts', label: 'Alerts', icon: Bell },
    { path: '/home/ai', label: 'AI Recommendations', icon: Lightbulb },
    { path: '/home/reports', label: 'Reports', icon: BarChart2 },
  ];

  const currentItem = navItems.find((n) => location.pathname.includes(n.path)) || navItems[0];

  const handleNav = (path) => {
    navigate(path);
  };

  const TopNav = () => (
    <div className="top-nav">
      <div className="top-nav-brand">
        <img src="/assets/logo.png" alt="Logo" className="top-nav-logo" />
        <span className="top-nav-title">CarbonEdge</span>
      </div>
      <div className="top-nav-links">
        {navItems.map((item) => {
          const isActive = location.pathname.includes(item.path);
          return (
            <div
              key={item.path}
              className={`top-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.path === '/home/alerts' && <AlertCount />}
            </div>
          );
        })}
        <div 
          className={`top-nav-item ${location.pathname.includes('/home/profile') ? 'active' : ''}`}
          onClick={() => handleNav('/home/profile')}
        >
          <User size={18} />
          <span>Profile</span>
        </div>
      </div>
    </div>
  );

  const MobileAppbar = () => (
    <div className="mobile-appbar">
      <div className="mobile-appbar-title">{currentItem.label}</div>
      <div className="mobile-appbar-actions" onClick={() => handleNav('/home/profile')}>
        <User size={24} color="var(--color-accent)" />
      </div>
    </div>
  );

  const BottomNav = () => (
    <div className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname.includes(item.path);
        return (
          <div
            key={item.path}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => handleNav(item.path)}
          >
            <item.icon size={22} />
            <span className="bottom-nav-label">{item.label}</span>
            {item.path === '/home/alerts' && <AlertCount />}
          </div>
        );
      })}
    </div>
  );

  return (
    <RealPlantProvider enabled={!showSimulationPopup}>
    <div className="main-layout-root">
      {isWeb ? <TopNav /> : <MobileAppbar />}
      
      <div className="main-layout-content">
        <Outlet />
      </div>

      {!isWeb && <BottomNav />}

      {showSimulationPopup && (
        <SimulationPopup onConnect={() => setShowSimulationPopup(false)} />
      )}
    </div>
    </RealPlantProvider>
  );
};

export default MainLayout;
