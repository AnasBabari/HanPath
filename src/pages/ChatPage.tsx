import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../types';

export default function ChatPage({ onBack, apiKey }: { onBack: () => void, apiKey: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "你好！(nǐ hǎo) I'm your AI Language Buddy. What would you like to practice today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const hasKey = !!apiKey && apiKey.trim().length > 10;

  const handleSend = async () => {
    if (!input.trim() || !hasKey || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are a friendly, encouraging Chinese learning AI buddy for a beginner student. You must converse primarily in very simple HSK 1 and HSK 2 level Chinese, ALWAYS accompanied by pinyin in brackets (e.g. 汉语(hàn yǔ)). If the user makes a mistake in grammar or word choice, gently point it out. You can use English to explain concepts, but try to keep the interactive conversation in Chinese as much as possible. Keep your responses short."
      });
      
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMsg);
      const response = await result.response;
      
      setMessages(prev => [...prev, { role: 'model', content: response.text() }]);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Unknown error';
      let cleanMsg = "Oops, something went wrong connecting to the AI. Please try again later.";
      if (msg.includes('API key not valid') || msg.includes('API key')) {
        cleanMsg = "Oops, your Gemini API key appears to be invalid or missing. Please double-check it in the Profile tab.";
      } else if (msg.includes('fetch') || msg.includes('network')) {
        cleanMsg = "Oops, I couldn't connect to the server. Please check your internet connection and make sure your API key is correct.";
      }
      setMessages(prev => [...prev, { role: 'model', content: cleanMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', paddingBottom: 0 }}>
      <div className="sub-header" style={{ flexShrink: 0 }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>AI Learning Buddy</h2>
      </div>
      
      {!hasKey ? (
        <div className="practice-empty">
          <div className="empty-icon">🤖</div>
          <p>Please enter your Gemini API Key in the Profile tab to use the AI Chatbot!</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
