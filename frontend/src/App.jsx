import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { getInventory } from './api';

export default function App() {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('veda_user') || null); 
  const [inventory, setInventory] = useState({});
  const [activeSubject, setActiveSubject] = useState(null);

  // Responsive Screen States
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Listen for screen size changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    localStorage.setItem('veda_user', email); 
  };

  const handleLogout = () => {
    setUserEmail(null);
    setActiveSubject(null);
    setInventory({});
    localStorage.removeItem('veda_user'); 
  };

  if (!userEmail) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
   <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      
      {/* Mobile Dark Overlay (closes sidebar when clicked) */}
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Sliding Sidebar Container */}
      <div style={{
        position: isMobile ? 'absolute' : 'relative',
        left: isMobile ? (sidebarOpen ? '0' : '-280px') : '0',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 20,
        height: '100%'
      }}>
        <Sidebar 
          userEmail={userEmail}
          inventory={inventory}
          activeSubject={activeSubject}
          setActiveSubject={(sub) => { 
            setActiveSubject(sub); 
            if(isMobile) setSidebarOpen(false); // Auto-close sidebar on mobile after selecting a subject!
          }}
          refreshInventory={refreshInventory}
          onLogout={handleLogout}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, width: isMobile ? '100%' : 'calc(100% - 280px)', display: 'flex', flexDirection: 'column' }}>
        <ChatInterface 
          userEmail={userEmail}
          activeSubject={activeSubject}
          isMobile={isMobile}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </div>
      
    </div>
  );
}