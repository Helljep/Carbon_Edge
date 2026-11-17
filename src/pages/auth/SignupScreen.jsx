import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/firebaseConfig';
import NeonCard from '../../components/NeonCard';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

const SignupScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [obscurePassword, setObscurePassword] = useState(true);
  const [obscureConfirm, setObscureConfirm] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isWeb, setIsWeb] = useState(window.innerWidth > 900);

  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsWeb(window.innerWidth > 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!email || !password || !confirmPassword) {
      setErrorMsg('Please completely fill the form.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (e) {
      console.error(e);
      let msg = 'Error creating account.';
      switch (e.code) {
        case 'auth/email-already-in-use': msg = 'The email address is already in use.'; break;
        case 'auth/invalid-email': msg = 'Invalid email format.'; break;
        case 'auth/weak-password': msg = 'The password is too weak.'; break;
        default: msg = `Error: ${e.message}`;
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formSection = (
    <div className="auth-form-container">
      <NeonCard borderColor="rgba(38, 229, 162, 0.3)" glow={true} padding="40px">
        <form onSubmit={handleSignup} className="auth-form">
          <h2 className="auth-title">System Access</h2>
          
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input 
              type={obscurePassword ? 'password' : 'text'} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />
            <button type="button" className="eye-btn" onClick={() => setObscurePassword(!obscurePassword)}>
              {obscurePassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input 
              type={obscureConfirm ? 'password' : 'text'} 
              placeholder="Confirm Password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-input"
              required
            />
            <button type="button" className="eye-btn" onClick={() => setObscureConfirm(!obscureConfirm)}>
              {obscureConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errorMsg && <div className="error-message">{errorMsg}</div>}

          {isLoading ? (
            <div className="loader-container">
              <div className="auth-loader"></div>
            </div>
          ) : (
            <button type="submit" className="auth-btn">
              CREATE ACCOUNT
            </button>
          )}
        </form>
      </NeonCard>

      <div className="auth-redirect">
        <span>Already Registered? </span>
        <Link to="/login" className="auth-link">Access Terminal</Link>
      </div>
    </div>
  );

  const brandingSection = (title, subtitle) => (
    <div className="branding-section">
      <img src="/assets/logo.png" alt="CarbonEdge Logo" className="branding-logo signup-logo" />
      <h1 className="branding-title">{title}</h1>
      <p className="branding-subtitle">{subtitle}</p>
    </div>
  );

  if (isWeb) {
    return (
      <div className="auth-layout web-layout">
        <div className="auth-left">
          {brandingSection('New Operator', 'Register for Access')}
        </div>
        <div className="auth-right">
          {formSection}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout mobile-layout">
      <div className="bg-blur-circle"></div>
      <div className="mobile-content">
        {brandingSection('New Operator', 'Register for Access')}
        {formSection}
      </div>
    </div>
  );
};

export default SignupScreen;
