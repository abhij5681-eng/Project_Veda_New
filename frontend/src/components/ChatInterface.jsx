import React, { useState, useEffect, useRef } from 'react';
import { getChatHistory, streamVedaChat, generateToolStream, replaceChatHistory } from '../api';
import { Send, ScrollText, FileQuestion, Pencil, Sparkles, Menu } from 'lucide-react';

const TypewriterMessage = ({ content, isLast, loading, formatMessage }) => {
  const [displayed, setDisplayed] = useState(content);

  useEffect(() => {
    if (!isLast || !loading) {
      setDisplayed(content);
      return;
    }
    if (content.length > displayed.length) {
      const timeout = setTimeout(() => {
        setDisplayed(content.slice(0, displayed.length + 2));
      }, 15); 
      return () => clearTimeout(timeout);
    }
  }, [content, displayed, isLast, loading]);

  return (
    <>
      {formatMessage(displayed)}
      {isLast && loading && <span className="cursor-blink"></span>}
    </>
  );
};

// 💥 NEW: We are accepting chatColor as a prop here!
export default function ChatInterface({ userEmail, activeSubject, isMobile, onOpenSidebar, chatColor }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeQuiz, setActiveQuiz] = useState(null); 
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (activeSubject && userEmail) {
      getChatHistory(userEmail, activeSubject).then(setMessages);
      setActiveQuiz(null); 
      setEditingIndex(null);
    }
  }, [activeSubject, userEmail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, loading]);

  const formatMessage = (text) => {
    if (!text) return null;
    let cleanText = text;
    if (cleanText.startsWith('{"result":"')) {
      cleanText = cleanText
        .replace(/^{"result":"/, '') 
        .replace(/"}$/, '')          
        .replace(/\\n/g, '\n')       
        .replace(/\\"/g, '"');       
    }
    const parts = cleanText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ fontWeight: '700', color: 'inherit' }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleSend = async (overrideText = null) => {
    const userQ = overrideText || input;
    if (!userQ.trim() || !activeSubject) return;
    
    if (!overrideText) setInput('');
    
    if (activeQuiz && !overrideText) {
      handleQuizAnswer(userQ);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: userQ }, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      await streamVedaChat(userEmail, activeSubject, userQ, (chunk) => {
        setMessages((prev) => {
          const last = { ...prev[prev.length - 1] };
          last.content += chunk;
          return [...prev.slice(0, -1), last];
        });
      });
    } catch (error) {
      setMessages((prev) => {
        const last = { ...prev[prev.length - 1] };
        last.content = "*(System Note: I cannot connect to the server right now.)*";
        return [...prev.slice(0, -1), last];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (index) => {
    const newText = editValue.trim();
    if (!newText) return;

    setEditingIndex(null);
    setLoading(true);

    const retainedHistory = messages.slice(0, index);

    try {
      await replaceChatHistory(userEmail, activeSubject, retainedHistory);
      setMessages(retainedHistory);
      await handleSend(newText);
    } catch (err) {
      alert("Failed to edit message. Please check your connection.");
      setLoading(false);
    }
  };

  const startInteractiveQuiz = async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: "Can you quiz me on this material?" }, { role: 'assistant', content: '' }]);
    
    try {
      await generateToolStream(userEmail, activeSubject, "quiz", (fullText) => {
        setMessages((prev) => {
          const last = { ...prev[prev.length - 1] };
          last.content = fullText;
          return [...prev.slice(0, -1), last];
        });
      });
      setActiveQuiz(true);
    } catch (error) {
      setMessages((prev) => {
        const last = { ...prev[prev.length - 1] };
        last.content = "*(System Note: I cannot connect to the server right now.)*";
        return [...prev.slice(0, -1), last];
      });
      setActiveQuiz(false);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizAnswer = async (answer) => {
    setMessages((prev) => [...prev, { role: 'user', content: answer }, { role: 'assistant', content: '' }]);
    setLoading(true);

    const evaluationPrompt = `The student is taking an interactive quiz. Their answer to the previous question is: "${answer}". 
    1. Evaluate if this is correct based on our notes.
    2. Ask the NEXT single multiple-choice question. DO NOT ask more than one.`;

    try {
      await streamVedaChat(userEmail, activeSubject, evaluationPrompt, (chunk) => {
        setMessages((prev) => {
          const last = { ...prev[prev.length - 1] };
          last.content += chunk;
          return [...prev.slice(0, -1), last];
        });
      });
    } catch (error) {
      setMessages((prev) => {
        const last = { ...prev[prev.length - 1] };
        last.content = "*(System Note: Connection error.)*";
        return [...prev.slice(0, -1), last];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTool = async (toolType) => {
    if (toolType === 'quiz') {
      startInteractiveQuiz();
      return;
    }
    
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: "Please generate a summary study guide." }, { role: 'assistant', content: '' }]);
    
    try {
      await generateToolStream(userEmail, activeSubject, toolType, (fullText) => {
        setMessages((prev) => {
          const last = { ...prev[prev.length - 1] };
          last.content = fullText;
          return [...prev.slice(0, -1), last];
        });
      });
    } catch (error) {
      setMessages((prev) => {
        const last = { ...prev[prev.length - 1] };
        last.content = "*(System Note: Connection error.)*";
        return [...prev.slice(0, -1), last];
      });
    } finally {
      setLoading(false);
    }
  };

  if (!activeSubject) {
    return (
      // 💥 NEW: Overrides the CSS variable dynamically with user's saved color
      <div style={{ "--primary": chatColor, flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-dark)' }}>
        {isMobile && (
          <div style={{ flexShrink: 0, padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <button onClick={onOpenSidebar} style={{ background: 'transparent', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Menu size={24} /> <span style={{ fontWeight: '600' }}>Menu</span>
            </button>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Select or create a workspace in the sidebar to begin.
        </div>
      </div>
    );
  }

  return (
    // 💥 NEW: Overrides the CSS variable dynamically with user's saved color
    <div style={{ "--primary": chatColor, flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-dark)' }}>
      
      <div style={{ flexShrink: 0, padding: isMobile ? '1rem' : '1rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isMobile && (
            <button onClick={onOpenSidebar} style={{ background: 'transparent', color: 'var(--text-main)', padding: '0.25rem' }}>
              <Menu size={24} />
            </button>
          )}
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)' }}>{activeSubject}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => handleTool('quiz')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <FileQuestion size={16}/> {!isMobile && "Quiz Me"}
          </button>
          <button onClick={() => handleTool('summary')} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ScrollText size={16}/> {!isMobile && "Study Guide"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: isMobile ? '1rem' : '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '1.5rem', marginTop: '5vh' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1.5rem', borderRadius: '50%', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <Sparkles size={48} color="var(--primary)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--text-main)', fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Project Veda</h2>
              <p style={{ color: 'var(--primary)', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Your Context-Aware AI Tutor</p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'user' ? (
              editingIndex === i ? (
                <div style={{ width: '100%', maxWidth: '80%', background: 'var(--bg-panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <textarea 
                    value={editValue} 
                    onChange={(e) => setEditValue(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.75rem', borderRadius: '8px', minHeight: '80px', resize: 'vertical', marginBottom: '0.5rem', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button onClick={() => setEditingIndex(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.4rem 0.8rem' }}>Cancel</button>
                    {/* 💥 NEW: Save Button uses the dynamic user color */}
                    <button onClick={() => handleSaveEdit(i)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', backgroundColor: chatColor, borderColor: chatColor, color: '#ffffff' }}>Save & Submit</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', maxWidth: '80%' }}>
                  {/* 💥 NEW: Chat Bubbles use the dynamic user color */}
                  <div className="chat-bubble chat-user" style={{ backgroundColor: chatColor, color: '#ffffff' }}>
                    {formatMessage(m.content)}
                  </div>
                  <button 
                    onClick={() => { setEditingIndex(i); setEditValue(m.content); }} 
                    style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              )
            ) : (
              <div className="chat-bubble chat-veda">
                <TypewriterMessage 
                  content={m.content} 
                  isLast={i === messages.length - 1} 
                  loading={loading} 
                  formatMessage={formatMessage} 
                />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ flexShrink: 0, padding: isMobile ? '1rem' : '1.5rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '800px', margin: '0 auto' }}>
          <input 
            style={{ flex: 1, padding: '1rem 1.25rem', fontSize: '1rem', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px' }} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={activeQuiz ? "Type your answer..." : `Ask Veda...`}
            disabled={loading}
          />
          {/* 💥 NEW: Send Button uses the dynamic user color */}
          <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="btn-primary" style={{ padding: isMobile ? '0 1rem' : '0 1.25rem', backgroundColor: chatColor, borderColor: chatColor, color: '#ffffff' }}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}