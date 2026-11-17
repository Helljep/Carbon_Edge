import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

const AuthWrapper = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('AuthWrapper: HasData=', !!currentUser);
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-background)' }}>
        <div className="splash-loader" style={{ borderColor: 'var(--color-surface)', borderTopColor: 'var(--color-accent)' }}></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" />; // We will map the MainHomeScreen to /home route
  }

  return <Navigate to="/login" />;
};

export default AuthWrapper;
