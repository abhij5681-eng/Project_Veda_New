import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import { getInventory } from './api';

export default function App() {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('veda_user') || null); 
  const [inventory, setInventory] = useState({});
  const [activeSubject, setActiveSubject] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // 💥 NEW: View Router State
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'settings'
  
  // 💥 NEW: Separated Color States
  const [theme, setTheme] = useState(localStorage.getItem('veda_theme') || 'dark');
  const [chatColor, setChatColor] = useState(localStorage.getItem('veda_chat_color') || '#3b82f6');
  const [workspaceColor, setWorkspaceColor] = useState(localStorage.getItem('veda_workspace_color') || '#10b981');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (userEmail) refreshInventory();
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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('veda_theme', newTheme);
  };

  const handleChatColorChange = (color) => {
    setChatColor(color);
    localStorage.setItem('veda_chat_color', color);
  };

  const handleWorkspaceColorChange = (color) => {
    setWorkspaceColor(color);
    localStorage.setItem('veda_workspace_color', color);
  };

  if (!userEmail) {
    return <div className={theme === 'light' ? 'light-mode' : ''}><Auth onLoginSuccess={handleLoginSuccess} /></div>;
  }

  return (
    <div className={theme === 'light' ? 'light-mode' : ''} style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', position: 'fixed', top: 0, left: 0, backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)' }}>
      
      {isMobile && sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, backdropFilter: 'blur(2px)' }}
        />
      )}

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
            setCurrentView('chat'); // Auto-switch to chat when picking a workspace
            if(isMobile) setSidebarOpen(false); 
          }}
          refreshInventory={refreshInventory}
          onLogout={handleLogout}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => { setCurrentView('settings'); if(isMobile) setSidebarOpen(false); }}
          workspaceColor={workspaceColor} // 💥 Passed Down!
        />
      </div>

      {/* 💥 NEW: Router renders Settings OR Chat */}
      <div style={{ flex: 1, height: '100%', minHeight: 0, width: isMobile ? '100%' : 'calc(100% - 280px)', display: 'flex', flexDirection: 'column' }}>
        {currentView === 'settings' ? (
          <Settings 
            theme={theme} toggleTheme={toggleTheme}
            chatColor={chatColor} onChatColorChange={handleChatColorChange}
            workspaceColor={workspaceColor} onWorkspaceColorChange={handleWorkspaceColorChange}
            onBack={() => setCurrentView('chat')}
            isMobile={isMobile}
          />
        ) : (
          <ChatInterface 
            userEmail={userEmail}
            activeSubject={activeSubject}
            isMobile={isMobile}
            onOpenSidebar={() => setSidebarOpen(true)}
            chatColor={chatColor}
          />
        )}
      </div>
    </div>
  );
}