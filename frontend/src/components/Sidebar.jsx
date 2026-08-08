import React, { useState } from 'react';
import { uploadFile, deleteFile, deleteWorkspace } from '../api';
// 💥 NEW: Imported Sun and Moon icons!
import { BookOpen, Plus, LogOut, UploadCloud, Library, Trash2, FileText, Info, X, Sun, Moon } from 'lucide-react';

export default function Sidebar({ userEmail, inventory, activeSubject, setActiveSubject, refreshInventory, onLogout, isMobile, onClose, theme, toggleTheme }) {
  const [newSubject, setNewSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [hiddenFiles, setHiddenFiles] = useState([]);
  
  const subjects = Object.keys(inventory || {});
  const activeFiles = activeSubject && inventory && inventory[activeSubject] 
    ? inventory[activeSubject].filter(file => !hiddenFiles.includes(file)) 
    : [];

  const handleCreateWorkspace = () => {
    if (newSubject.trim()) { 
      setActiveSubject(newSubject.trim()); 
      setNewSubject(''); 
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !activeSubject) return;
    
    setUploading(true);
    setUploadStatus(`🔮 Memorizing ${files.length} file(s)...`);
    
    try {
      for (const file of files) {
        await uploadFile(userEmail, activeSubject, file);
        setHiddenFiles(prev => prev.filter(f => f !== file.name));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshInventory();
      setUploadStatus('✨ All texts mastered!');
    } catch (err) { 
      setUploadStatus('❌ Failed to upload some files.'); 
    } finally { 
      setUploading(false); 
      e.target.value = null; 
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const handleDeleteFile = async (filename) => {
    if (window.confirm(`Are you sure you want to remove "${filename}" from Veda's memory?`)) {
      setHiddenFiles(prev => [...prev, filename]);
      try {
        await deleteFile(userEmail, activeSubject, filename);
        await refreshInventory();
      } catch (err) {
        alert("Failed to delete the file.");
        setHiddenFiles(prev => prev.filter(f => f !== filename));
      }
    }
  };

  const handleDeleteWorkspace = async (subjectToDelete, e) => {
    e.stopPropagation(); 
    if (window.confirm(`Are you sure you want to delete the entire "${subjectToDelete}" workspace, including its chat history and files?`)) {
      try {
        await deleteWorkspace(userEmail, subjectToDelete);
        if (activeSubject === subjectToDelete) {
          setActiveSubject(null); 
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        await refreshInventory();
      } catch (err) {
        alert("Failed to delete the workspace.");
      }
    }
  };

  return (
    <div style={{ width: '280px', backgroundColor: 'var(--bg-panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* Profile & Info Area */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontWeight: '600' }}>
            <Library size={20} color="var(--primary)"/> Project Veda
          </h3>
          {isMobile && (
            <button onClick={onClose} style={{ background: 'transparent', padding: '0.25rem', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          )}
        </div>
        
        <div style={{ background: 'var(--bg-dark)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', margin: '0 0 0.4rem 0' }}>
            <Info size={14} color="var(--primary)"/> Who is Veda?
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            Your personal, context-aware AI tutor. Veda learns strictly from your uploaded notes and provides exact citations for every answer.
          </p>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', wordBreak: 'break-all' }}>{userEmail}</p>
        
        {/* 💥 NEW: Theme Toggle and Logout Buttons side-by-side */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={toggleTheme} style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} 
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={onLogout} style={{ flex: 1, padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1px solid transparent' }}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>

      {/* Workspace List */}
      <div style={{ padding: '1.5rem 1rem', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="New Workspace..." 
            value={newSubject} 
            onChange={(e) => setNewSubject(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()} 
            style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border)' }} 
          />
          <button onClick={handleCreateWorkspace} className="btn-primary" style={{ padding: '0.5rem' }}>
            <Plus size={18}/>
          </button>
        </div>

        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Your Workspaces</h4>
        
        {subjects.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '0.5rem' }}>No workspaces yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {subjects.map((sub) => (
              <div 
                key={sub} 
                onClick={() => setActiveSubject(sub)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: activeSubject === sub ? 'var(--primary)' : 'transparent',
                  color: activeSubject === sub ? 'white' : 'var(--text-main)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <BookOpen size={16} /> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{sub}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteWorkspace(sub, e)} 
                  title={`Delete ${sub}`}
                  style={{ padding: '0.25rem', background: 'transparent', color: activeSubject === sub ? 'white' : 'var(--danger)', height: 'auto', opacity: 0.8 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manage Files & Upload Area */}
      {activeSubject && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-dark)' }}>
          
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
            Knowledge Base
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '150px', overflowY: 'auto' }}>
            {activeFiles.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No files uploaded yet.</span>}
            {activeFiles.map(file => (
              <div key={file} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <FileText size={14} color="var(--primary)" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={file}>{file}</span>
                </div>
                <button onClick={() => handleDeleteFile(file)} style={{ padding: '0.25rem', background: 'transparent', color: 'var(--danger)', height: 'auto' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UploadCloud size={16} /> Offer Texts
          </p>
          
          <input 
            type="file" 
            accept=".pdf,.png,.jpg,.jpeg" 
            multiple 
            onChange={handleFileUpload} 
            disabled={uploading} 
            style={{ width: '100%', fontSize: '0.75rem', padding: '0.5rem' }} 
          />
          
          {uploadStatus && (
            <p style={{ fontSize: '0.8rem', color: uploadStatus.includes('❌') ? 'var(--danger)' : 'var(--success)', marginTop: '0.75rem', textAlign: 'center' }}>
              {uploadStatus}
            </p>
          )}
        </div>
      )}
    </div>
  );
}