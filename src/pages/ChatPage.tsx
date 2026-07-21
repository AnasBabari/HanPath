import { useState, useRef, useEffect } from 'react';
import { callOpenRouter } from '../utils/ai';
import type { ChatMessage } from '../types';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('hanpath_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { role: 'model', content: "你好(nǐ hǎo)！I'm your AI Language Buddy. What would you like to practice today?" }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('hanpath_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const systemPrompt = "You are a friendly, encouraging Chinese learning AI buddy for a beginner student. You MUST converse primarily in simple Chinese characters (Hanzi) followed by Pinyin in brackets, like this: 你好(nǐ hǎo). Use English only for brief explanations or encouragement. NEVER respond with only English or only Hanzi. If the user makes a mistake in grammar or word choice, gently point it out in English. Keep your responses short.";
      
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      history.push({ role: 'user', content: userMsg });

      const response = await callOpenRouter(history, systemPrompt);
      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Unknown error';
      setMessages(prev => [...prev, { role: 'model', content: `Sorry, I hit an error: ${msg}. Please check your connection.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-root" style={{ background: 'var(--bg-deep)', height: '100dvh' }}>
      <div className="topbar">
        <div className="topbar-left">
           <span className="topbar-brand">AI Buddy</span>
        </div>
        <div className="topbar-stats">
           <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)' }}>ONLINE</span>
           <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)' }} />
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          scrollBehavior: 'smooth'
        }}
      >
        <div style={{ flex: 1 }} /> {/* Spacer to push messages to bottom */}
        {messages.map((m, i) => (
          <div 
            key={i} 
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '14px 20px',
              borderRadius: '24px',
              borderBottomRightRadius: m.role === 'user' ? '4px' : '24px',
              borderBottomLeftRadius: m.role === 'model' ? '4px' : '24px',
              background: m.role === 'user' ? 'var(--secondary)' : '#fff',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              fontSize: '16px',
              fontWeight: 700,
              lineHeight: 1.5,
              border: m.role === 'model' ? '2px solid var(--border)' : 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              animation: 'fadeIn 0.3s ease forwards'
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ 
            alignSelf: 'flex-start', 
            background: '#fff', 
            padding: '14px 20px', 
            borderRadius: '24px', 
            borderBottomLeftRadius: '4px',
            color: 'var(--text-dim)',
            border: '2px solid var(--border)',
            fontSize: '14px',
            fontWeight: 800
          }}>
            AI Buddy is typing...
          </div>
        )}
      </div>
      
      <div style={{ 
        padding: '16px 20px 40px', 
        background: 'var(--bg-deep)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        position: 'sticky',
        bottom: 0
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            style={{
              width: '100%',
              background: '#fff',
              border: '2px solid var(--border)',
              borderRadius: '28px',
              padding: '14px 56px 14px 24px',
              color: 'var(--text)',
              fontSize: '16px',
              fontWeight: 700,
              outline: 'none',
              boxShadow: 'var(--shadow-sm)'
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Send a message..."
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            style={{ 
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px', 
              height: '40px', 
              padding: 0, 
              borderRadius: '50%', 
              background: input.trim() ? 'var(--secondary)' : 'var(--bg-elevated)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '20px',
              transition: 'all 0.2s'
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
