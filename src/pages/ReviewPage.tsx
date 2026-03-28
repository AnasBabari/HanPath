import { useMemo, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Unit } from '../types';
import { allLessonsFlat } from '../utils/curriculum';
import { speak } from '../utils/tts';



export default function ReviewPage({ units, completedLessons, revealPinyin, apiKey, geminiCallsToday = 0, onApiUse, onBack }: {
  units: Unit[]; completedLessons: string[]; revealPinyin: 'always' | 'peek'; apiKey: string | null;
  geminiCallsToday?: number;
  onApiUse?: () => void;
  onBack: () => void;
}) {
  const cards = useMemo(() => {
    const done = new Set(completedLessons);
    return allLessonsFlat(units).filter(l => done.has(l.id)).flatMap(l => l.vocab);
  }, [units, completedLessons]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);

  if (!cards.length) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Review</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">🔄</div>
          <p>Complete a lesson first to build your review deck!</p>
        </div>
      </div>
    );
  }

  const card = cards[idx % cards.length];
  
  const handleGenerateMnemonic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!apiKey || apiKey.trim().length <= 10) return;
    if (geminiCallsToday >= 50) {
      setMnemonic("Daily AI limit reached (50/50). More mnemonics available tomorrow!");
      return;
    }
    setLoadingMnemonic(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Provide a short, memorable, and creative visual mnemonic device to help me remember the Chinese character "${card.hanzi}" (${card.pinyin}) which means "${card.meaning}". Break down the radicals if helpful. Limit your response to 2 or 3 sentences max. Do NOT use markdown formatting.`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      setMnemonic(response.text());
      onApiUse?.();
    } catch (err: unknown) {
      setMnemonic("Oops, could not generate a mnemonic. Please check your API key and connection.");
    } finally {
      setLoadingMnemonic(false);
    }
  };

  return (
    <div className="shell">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Review · {cards.length} cards</h2>
      </div>

      <div className="flashcard" onClick={() => setFlipped(f => !f)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}>
        {!flipped ? (
          <>
            <p className="fc-label">汉字</p>
            <p className="fc-hanzi">{card.hanzi}</p>
            {revealPinyin === 'always' && <p className="fc-pinyin">{card.pinyin}</p>}
            <p className="fc-tap">Tap to reveal meaning</p>
          </>
        ) : (
          <>
            <p className="fc-label">Meaning</p>
            <p className="fc-meaning">{card.meaning}</p>
            <p className="fc-pinyin">{card.pinyin}</p>
            <button className="speak-btn" style={{ marginTop: 10 }} onClick={e => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
            
            {apiKey && apiKey.trim().length > 10 && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                {!mnemonic && !loadingMnemonic && (
                  <button className="btn-explain" onClick={handleGenerateMnemonic}>✨ Generate Mnemonic</button>
                )}
                {loadingMnemonic && <div className="explanation-text">Thinking...</div>}
                {mnemonic && <div className="explanation-text" style={{ textAlign: 'left', color: 'var(--text-mid)', marginTop: 8 }}>{mnemonic}</div>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="review-controls">
        <button className="btn-ghost" onClick={() => { setFlipped(false); setMnemonic(''); setIdx(i => (i - 1 + cards.length) % cards.length); }}>← Prev</button>
        <button className="btn-primary" onClick={() => { setFlipped(false); setMnemonic(''); setIdx(i => (i + 1) % cards.length); }}>Next →</button>
      </div>
    </div>
  );
}
