import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RefreshCw, Trash2, WifiOff, AlertCircle } from 'lucide-react';
import { callOpenRouter } from '../utils/ai';
import { useStore } from '../store/useStore';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { chatHistory, addChatMessage, clearChatHistory, hskLevel, authSession } = useStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading || !isOnline) return;

    if (!textToSend) {
      setInput('');
    }
    setErrorMsg(null);

    addChatMessage({ role: 'user', content: text });
    setLoading(true);

    try {
      const history = chatHistory.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      history.push({ role: 'user', content: text });

      const response = await callOpenRouter(history, {
        context: {
          mode: 'chat',
          hskLevel: hskLevel === 2 ? 2 : 1,
        },
        authToken: authSession.token || undefined,
      });

      addChatMessage({ role: 'model', content: response });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service temporarily unavailable.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    const lastUserMsg = [...chatHistory].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      void handleSend(lastUserMsg.content);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface">
      {/* Header */}
      <header className="bg-surface-card border-b border-border px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold font-display text-lg text-primary leading-none">AI Language Tutor</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                HSK {hskLevel} Tutor
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-border" />
              <span
                className={`text-[11px] font-bold flex items-center gap-1 ${
                  isOnline ? 'text-green-accessible' : 'text-amber-accessible'
                }`}
              >
                {isOnline ? 'Online' : 'Offline (Internet Required)'}
              </span>
            </div>
          </div>
        </div>

        {chatHistory.length > 1 && (
          <button
            type="button"
            onClick={clearChatHistory}
            className="touch-target p-2 rounded-xl text-on-surface-variant hover:text-red-accessible transition-colors"
            title="Clear Chat History"
            aria-label="Clear chat history"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Offline Notice Banner */}
      {!isOnline && (
        <div
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs font-bold text-amber-accessible flex items-center justify-center gap-2"
          role="alert"
        >
          <WifiOff className="w-4 h-4" />
          <span>You are currently offline. Connect to the internet to chat with your AI Language Tutor.</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {chatHistory.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isUser ? 'bg-primary text-on-primary' : 'bg-primary-light text-primary'
                }`}
              >
                {isUser ? 'You' : <Sparkles className="w-4 h-4" />}
              </div>

              <div
                className={`p-4 rounded-3xl max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                  isUser
                    ? 'bg-primary text-on-primary rounded-tr-xs'
                    : 'bg-surface-card border border-border text-on-surface rounded-tl-xs'
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-surface-card border border-border p-4 rounded-3xl rounded-tl-xs shadow-xs text-xs font-bold text-on-surface-variant flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Thinking & composing response...</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs space-y-2 max-w-md mx-auto"
            role="alert"
          >
            <div className="flex items-center gap-2 text-red-accessible font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="touch-target px-3 py-1.5 bg-red-accessible text-white rounded-xl font-bold hover:bg-red-800 transition-colors"
            >
              Retry Message
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <footer className="bg-surface-card border-t border-border p-4 pb-20 sm:pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              disabled={!isOnline || loading}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isOnline
                  ? `Ask in Chinese or English (e.g. "How do I say thank you?")...`
                  : 'AI Tutor is offline. Please reconnect.'
              }
              className="w-full bg-surface-container border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary focus:bg-surface-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Message for AI Tutor"
            />
            {input.length > 800 && (
              <span className="absolute right-3 top-3 text-[10px] text-outline font-mono">
                {input.length}/1000
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading || !isOnline}
            className="touch-target px-5 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
