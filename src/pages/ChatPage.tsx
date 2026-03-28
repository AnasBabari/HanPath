import { useState, useRef, useEffect } from 'react';
import { callOpenRouter } from '../utils/ai';
import type { ChatMessage } from '../types';

export default function ChatPage({ onApiUse }: {
  onApiUse?: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('hanpath_chat_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { role: 'model', content: "你好！I'm your AI Language Buddy. What would you like to practice today?" }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('hanpath_chat_history', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const systemPrompt = "You are a friendly, encouraging Chinese learning AI buddy for a beginner student. You MUST converse primarily in simple Chinese characters (Hanzi) and English only. NEVER use Pinyin in your responses. If the user makes a mistake in grammar or word choice, gently point it out in English. Keep your responses short.";
      
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // Add the current message to history for the call
      history.push({ role: 'user', content: userMsg });

      const response = await callOpenRouter(history, systemPrompt);
      
      setMessages(prev => [...prev, { role: 'model', content: response }]);
      onApiUse?.();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Unknown error';
      console.error("AI Error:", msg);
      setMessages(prev => [...prev, { role: 'model', content: `Sorry, I hit an error: ${msg}. Please check your connection or .env file.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', paddingBottom: 0 }}>
      <div className="sub-header" style={{ flexShrink: 0 }}>
        <h2>AI Learning Buddy</h2>
      </div>
      
      <div className="chat-container" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-typing">Typing...</div>}
      </div>
      
      <div className="chat-input-area" style={{ paddingBottom: 80 }}>
        <input 
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          ↑
        </button>
      </div>
    </div>
  );
}
