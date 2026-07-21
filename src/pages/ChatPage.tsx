import { useState, useRef, useEffect } from 'react';
import { callOpenRouter } from '../utils/ai';
import { useStore } from '../store/useStore';

export default function ChatPage() {
  const { chatHistory, addChatMessage, setToast } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    addChatMessage({ role: 'user', content: userMsg });
    setLoading(true);

    try {
      const systemPrompt = "You are a friendly, encouraging Chinese learning AI buddy for a beginner student. You MUST converse primarily in simple Chinese characters (Hanzi) followed by Pinyin in brackets, like this: 你好(nǐ hǎo). Use English only for brief explanations or encouragement. NEVER respond with only English or only Hanzi. If the user makes a mistake in grammar or word choice, gently point it out in English. Keep your responses short.";
      
      const history = chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant' as const,
        content: m.content
      }));

      history.push({ role: 'user', content: userMsg });

      const response = await callOpenRouter(history, systemPrompt);
      addChatMessage({ role: 'model', content: response });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Unknown error';
      console.error('Chat error:', msg);
      setToast('Failed to reach AI Buddy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-deep)' }}>
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
        {chatHistory.map((m, i) => (
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
        padding: '16px 20px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', 
        background: 'var(--bg-deep)',
        display: 'flex',
        flexShrink: 0,
        gap: '12px',
        alignItems: 'center',
        borderTop: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input 
            style={{
              flex: 1,
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
