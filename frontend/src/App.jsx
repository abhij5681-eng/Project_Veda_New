import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { getInventory } from './api';

export default function App() {
  // 💥 FIX: Check local storage first so hot-reloads don't log you out!
  // If nothing is in local storage, it defaults to null (or you can put your email here for testing).
  const [userEmail, setUserEmail] = useState(localStorage.getItem('veda_user') || null); 
  const [inventory, setInventory] = useState({});
  const [activeSubject, setActiveSubject] = useState(null);

  useEffect(() => {
    if (userEmail) {
      refreshInventory();
    }
  }, [userEmail]);

  const refreshInventory = async () => {
    if (!userEmail) return;
    try {
      const data = await getInventory(userEmail);
      setInventory(data);
    } catch (err) {
      console.error("Failed to load inventory", err);
    }
  };

  const handleLoginSuccess = (email) => {
    setUserEmail(email);
    // Save to browser memory so it survives code updates
    localStorage.setItem('veda_user', email); 
  };

  const handleLogout = () => {
    setUserEmail(null);
    setActiveSubject(null);
    setInventory({});
    // Wipe from browser memory on logout
    localStorage.removeItem('veda_user'); 
  };

  if (!userEmail) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar 
        userEmail={userEmail}
        inventory={inventory}
        activeSubject={activeSubject}
        setActiveSubject={setActiveSubject}
        refreshInventory={refreshInventory}
        onLogout={handleLogout}
      />
      <ChatInterface 
        userEmail={userEmail}
        activeSubject={activeSubject}
      />
    </div>
  );
}