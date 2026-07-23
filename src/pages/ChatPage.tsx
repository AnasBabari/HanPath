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
      addChatMessage({
        role: 'model',
        content: "你好(nǐ hǎo)！I had trouble reaching the AI server. Let's practice: 你喜欢学中文吗(nǐ xǐ huān xué zhōng wén ma)? (Do you like learning Chinese?)"
      });
      setToast('AI connection issue. (Check server logs)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-deep)' }}>
      {/* TopBar */}
      <div className="topbar">
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
           <span className="topbar-brand">AI Buddy</span>
        </div>
        <div className="topbar-stats" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
           <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--primary)' }}>ONLINE</span>
           <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--primary)' }} />
        </div>
      </div>
      
      {/* Chat Messages */}
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
        {chatHistory.map(m => (
          <div 
            key={m.id} 
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
            fontSize: '14px',
            fontWeight: 700,
            border: '2px solid var(--border)'
          }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div style={{ 
        padding: '12px 16px 85px 16px', 
        background: '#fff', 
        borderTop: '2px solid var(--border)',
        display: 'flex',
        gap: '12px'
      }}>
        <input 
          type="text" 
          value={input} 
          aria-label="Type in Chinese or English..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type in Chinese or English..."
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: '16px',
            border: '2px solid var(--border)',
            fontSize: '15px',
            fontWeight: 700,
            outline: 'none'
          }}
        />
        <button 
          type="button"
          onClick={handleSend}
          className="btn-primary"
          style={{ padding: '0 24px', borderRadius: '16px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
