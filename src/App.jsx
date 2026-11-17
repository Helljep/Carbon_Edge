import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthWrapper from './components/AuthWrapper';
import SplashScreen from './pages/SplashScreen';
import LoginScreen from './pages/auth/LoginScreen';
import SignupScreen from './pages/auth/SignupScreen';
import MainLayout from './pages/layout/MainLayout';
import ProfileScreen from './pages/profile/ProfileScreen';
import DashboardScreen from './pages/dashboard/DashboardScreen';
import ConnectScadaScreen from './pages/dashboard/ConnectScadaScreen';
import AlertsScreen from './pages/dashboard/AlertsScreen';
import MachinesScreen from './pages/dashboard/MachinesScreen';
import ReportsScreen from './pages/dashboard/ReportsScreen';
import AIOptimizationPage from './pages/dashboard/AIOptimizationPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/auth" element={<AuthWrapper />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        
        <Route path="/home" element={<MainLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardScreen />} />
          <Route path="connect" element={<ConnectScadaScreen />} />
          <Route path="alerts" element={<AlertsScreen />} />
          <Route path="machines" element={<MachinesScreen />} />
          <Route path="ai" element={<AIOptimizationPage />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
