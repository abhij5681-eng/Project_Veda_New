import React, { useState } from 'react';
import { loginUser, requestOtp, verifyOtp } from '../api';
import { GraduationCap, LogIn, UserPlus, Key } from 'lucide-react';

export default function Auth({ onLoginSuccess }) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [signupStage, setSignupStage] = useState('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // ... [Keep your existing handleLogin, handleSendOtp, and handleVerifyOtp functions exactly the same] ...
  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { const res = await loginUser(email, password); onLoginSuccess(res.user_email); } 
    catch (err) { setError('Login failed. Please check your credentials.'); } 
    finally { setLoading(false); }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault(); if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError(''); setMessage('');
    try { await requestOtp(email, password); setMessage('✅ Code sent to your email!'); setSignupStage('otp'); } 
    catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await verifyOtp(email, otp, password); setMessage('🎉 Account created! Please log in.'); setSignupStage('details'); setIsLoginTab(true); setOtp(''); setPassword(''); } 
    catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-panel)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', width: '100%', maxWidth: '420px', border: '1px solid var(--border)' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <GraduationCap size={40} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Project Veda</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Your personal AI tutor</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.3rem', borderRadius: '10px' }}>
          <button onClick={() => { setIsLoginTab(true); setError(''); setMessage(''); }} style={{ flex: 1, background: isLoginTab ? 'var(--bg-panel)' : 'transparent', color: isLoginTab ? 'white' : 'var(--text-muted)', boxShadow: isLoginTab ? '0 2px 5px rgba(0,0,0,0.2)' : 'none' }}>
            <LogIn size={18} /> Log In
          </button>
          <button onClick={() => { setIsLoginTab(false); setError(''); setMessage(''); setSignupStage('details'); }} style={{ flex: 1, background: !isLoginTab ? 'var(--bg-panel)' : 'transparent', color: !isLoginTab ? 'white' : 'var(--text-muted)', boxShadow: !isLoginTab ? '0 2px 5px rgba(0,0,0,0.2)' : 'none' }}>
            <UserPlus size={18} /> Sign Up
          </button>
        </div>

        {error && <p style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{error}</p>}
        {message && <p style={{ color: 'var(--success)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{message}</p>}

        {isLoginTab ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Authenticating...' : 'Access Workspace'}</button>
          </form>
        ) : (
          signupStage === 'details' ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Create Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Sending Code...' : 'Send Verification Code'}</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', textAlign: 'center', color: 'var(--text-muted)' }}>Enter the code sent to <strong>{email}</strong></p>
              <input type="text" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }} />
              <button type="submit" className="btn-primary" disabled={loading}><Key size={18}/> Verify & Complete</button>
            </form>
          )
        )}
      </div>
    </div>
  );
}