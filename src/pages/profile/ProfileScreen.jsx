import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/firebaseConfig';
import NeonCard from '../../components/NeonCard';
import { User, Mail, Phone, Settings, Moon, ArrowRight, LogOut } from 'lucide-react';
import './Profile.css';

const ProfileScreen = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [isDarkMode, setIsDarkMode] = useState(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (e) {
      console.error('Error logging out:', e);
    }
  };

  const InfoTile = ({ icon: IconNode, title, value }) => (
    <NeonCard glow={false} padding="15px" className="profile-info-tile">
      <IconNode color="var(--color-accent)" size={24} />
      <div className="profile-info-content">
        <div className="profile-info-title">{title}</div>
        <div className="profile-info-value">{value}</div>
      </div>
    </NeonCard>
  );

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1 className="profile-title">Profile & Settings</h1>
      </div>

      <div className="profile-body">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            <User size={50} color="var(--color-accent)" />
          </div>
          <h2 className="profile-name">{user?.displayName || "User Name"}</h2>
          <p className="profile-email">{user?.email || "user@example.com"}</p>
        </div>

        <h3 className="section-title">Account Details</h3>
        <InfoTile icon={User} title="Name" value={user?.displayName || "Not set"} />
        <InfoTile icon={Mail} title="Email" value={user?.email || "Not set"} />
        <InfoTile icon={Phone} title="Phone" value={"Not set"} />

        <h3 className="section-title" style={{ marginTop: '30px' }}>Settings</h3>
        
        <div className="profile-list-tile">
          <div className="tile-content">
            {/* The icon represents Dark Mode */}
            <Moon color="var(--color-accent)" size={24} />
            <span className="tile-title">Dark Mode</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={isDarkMode} onChange={(e) => setIsDarkMode(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="profile-list-tile clickable">
          <div className="tile-content">
            <Settings color="var(--color-accent)" size={24} />
            <span className="tile-title">Connection Settings</span>
          </div>
          <ArrowRight color="var(--color-text-secondary)" size={16} />
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
