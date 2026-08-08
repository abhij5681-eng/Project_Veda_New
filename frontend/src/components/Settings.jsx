import React from 'react';
import { Sun, Moon, ArrowLeft, PaintBucket, Layout } from 'lucide-react';

const PREMIUM_COLORS = [
  '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', 
  '#10b981', '#84cc16', '#f59e0b', '#f97316', 
  '#ef4444', '#f43f5e', '#ec4899', '#d946ef',
  '#a855f7', '#8b5cf6', '#6366f1', '#64748b'
];

export default function Settings({ theme, toggleTheme, chatColor, onChatColorChange, workspaceColor, onWorkspaceColorChange, onBack, isMobile }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-dark)', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ flexShrink: 0, padding: isMobile ? '1rem' : '1.5rem 3rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: 'var(--text-main)', display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>Settings</h2>
      </div>

      {/* Settings Content */}
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '3rem', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* Appearance Section */}
        <section>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={18} color="var(--primary)" /> Appearance
          </h3>
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Choose between a light reading environment or a dark, high-contrast workspace.</p>
            <button onClick={toggleTheme} style={{ width: isMobile ? '100%' : 'auto', padding: '0.75rem 2rem', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', borderRadius: '8px' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} 
              Switch to {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </section>

        {/* Colors Section */}
        <section>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PaintBucket size={18} color="var(--primary)" /> Personalization
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            
            {/* Chat Color Picker */}
            <div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '500', marginBottom: '0.25rem' }}>Chat Bubble Color</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>This color applies to your messages and primary action buttons.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {PREMIUM_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => onChatColorChange(color)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color,
                      border: chatColor === color ? '3px solid var(--text-main)' : '3px solid transparent',
                      cursor: 'pointer', padding: 0, transition: 'transform 0.1s ease',
                      transform: chatColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: chatColor === color ? `0 0 15px ${color}60` : 'none'
                    }}
                    title={`Select chat color`}
                  />
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

            {/* Workspace Color Picker */}
            <div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '500', marginBottom: '0.25rem' }}>Active Workspace Color</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>This highlights your currently selected subject in the sidebar.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {PREMIUM_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => onWorkspaceColorChange(color)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color,
                      border: workspaceColor === color ? '3px solid var(--text-main)' : '3px solid transparent',
                      cursor: 'pointer', padding: 0, transition: 'transform 0.1s ease',
                      transform: workspaceColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: workspaceColor === color ? `0 0 15px ${color}60` : 'none'
                    }}
                    title={`Select workspace color`}
                  />
                ))}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}