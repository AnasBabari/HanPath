import { useState, useRef, useEffect } from 'react';
import { callOpenRouter, getActiveApiKey } from '../utils/ai';
import { useStore } from '../store/useStore';

export default function ChatPage() {
  const { chatHistory, addChatMessage, setToast } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState(() => {
    try { return localStorage.getItem('hanpath-custom-api-key') || ''; } catch { return ''; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  const saveKey = (key: string) => {
    try {
      if (key.trim()) {
        localStorage.setItem('hanpath-custom-api-key', key.trim());
      } else {
        localStorage.removeItem('hanpath-custom-api-key');
      }
      setCustomKey(key.trim());
      setShowKeyModal(false);
      setToast('API Key updated!');
    } catch {
      setToast('Failed to save key');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    addChatMessage({ role: 'user', content: userMsg });
    setLoading(true);

    const hasKey = !!getActiveApiKey();

    try {
      if (!hasKey) {
        // Fallback response for devices without API key
        setTimeout(() => {
          addChatMessage({
            role: 'model',
            content: "你好(nǐ hǎo)！Great to meet you! (Tip: You can add an API key in the top right ⚙️ icon to unlock live AI responses on any device!)"
          });
          setLoading(false);
        }, 500);
        return;
      }

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
      setToast('AI connection issue. Click ⚙️ to set custom API key.');
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
           <button 
             onClick={() => setShowKeyModal(true)}
             style={{ 
               background: 'transparent', 
               border: 'none', 
               cursor: 'pointer', 
               fontSize: 18, 
               padding: 4, 
               display: 'flex', 
               alignItems: 'center' 
             }}
             title="AI Settings"
           >
             ⚙️
           </button>
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
          onClick={handleSend}
          className="btn-primary"
          style={{ padding: '0 24px', borderRadius: '16px' }}
        >
          Send
        </button>
      </div>

      {/* Key Setup Modal */}
      {showKeyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'grid', placeItems: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: 24, maxWidth: 400, width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--primary)' }}>⚙️ AI Key Setup</h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '8px 0 16px 0', lineHeight: 1.5 }}>
              Enter an OpenRouter or Gemini API Key to enable AI Buddy on this device:
            </p>
            <input 
              type="password"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="sk-or-v1-..."
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '2px solid var(--border)', fontSize: 14, fontWeight: 700,
                boxSizing: 'border-box', marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowKeyModal(false)}
                className="btn-ghost"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => saveKey(customKey)}
                className="btn-primary"
                style={{ padding: '8px 20px', borderRadius: 12 }}
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
