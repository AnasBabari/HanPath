import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callOpenRouter } from '../utils/ai';
import { allLessonsFlat } from '../utils/curriculum';
import { speak } from '../utils/tts';
import { useStore } from '../store/useStore';

export default function ReviewPage() {
  const { units, stats, rateWord, setFullScreen, setToast } = useStore();
  const navigate = useNavigate();

  const cards = useMemo(() => {
    if (!units) return [];
    const today = new Date().toISOString().split('T')[0];
    const vocab = allLessonsFlat(units).flatMap(l => l.vocab);
    
    // Filter words that are learned AND due today
    return vocab.filter(v => {
      const srs = stats.wordSRS[v.id];
      // If srs exists, check if it's due. If it doesn't exist, it's not "learned" via SRS yet, 
      // but the original code used completedLessons. Let's stick to showing what's due 
      // but also include any completed words that don't have SRS data yet (initial review).
      if (!srs) {
        return stats.completedLessons.some(id => {
          const lesson = allLessonsFlat(units).find(l => l.id === id);
          return lesson?.vocab.some(vv => vv.id === v.id);
        });
      }
      return srs.nextReviewDate <= today;
    });
  }, [units, stats.wordSRS, stats.completedLessons]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);

  const handleExit = () => {
    navigate(-1);
    setFullScreen(false);
  };

  if (!cards.length) {
    return (
      <div className="shell">
        <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
          <button type="button" className="back-btn" onClick={handleExit}>← Back</button>
          <h2 style={{ margin: 0, marginLeft: 12 }}>Review</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">✅</div>
          <p>You're all caught up for today!</p>
          <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={handleExit}>Back</button>
        </div>
      </div>
    );
  }

  const card = cards[idx % cards.length];
  
  const handleGenerateMnemonic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    setLoadingMnemonic(true);
    try {
      const prompt = `Provide a short, memorable, and creative visual mnemonic device to help me remember the Chinese character "${card.hanzi}" (${card.pinyin}) which means "${card.meaning}". Break down the radicals if helpful. Limit your response to 2 or 3 sentences max. Do NOT use markdown formatting.`;
      
      const response = await callOpenRouter([{ role: 'user', content: prompt }]);
      setMnemonic(response);
    } catch (err: unknown) {
      console.error('Mnemonic Error:', err);
      setToast('Failed to contact AI. Please check your connection.');
      setMnemonic("Mnemonic generation failed.");
    } finally {
      setLoadingMnemonic(false);
    }
  };

  const handleRate = (rating: 'Hard' | 'Good' | 'Easy') => {
    rateWord(card.id, rating);
    setFlipped(false);
    setMnemonic('');
    if (idx + 1 >= cards.length) {
      // Finished the due deck
      handleExit();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="shell">
      <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" className="back-btn" onClick={handleExit}>← Back</button>
        <h2 style={{ margin: 0, marginLeft: 12 }}>Review · {cards.length - (idx >= cards.length ? cards.length : idx)} left</h2>
      </div>

      <div className="flashcard" role="region" aria-label="Flashcard">
        {!flipped ? (
          <button 
            type="button" 
            className="fc-inner-btn"
            onClick={() => setFlipped(true)}
            style={{ background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'center', padding: 0, color: 'inherit', font: 'inherit' }}
          >
            <p className="fc-label">汉字</p>
            <p className="fc-hanzi">{card.hanzi}</p>
            {stats.revealPinyin === 'always' && <p className="fc-pinyin">{card.pinyin}</p>}
            <p className="fc-tap">Tap to reveal meaning</p>
          </button>
        ) : (
          <>
            <p className="fc-label">Meaning</p>
            <p className="fc-meaning">{card.meaning}</p>
            <p className="fc-pinyin">{card.pinyin}</p>
            <button type="button" className="speak-btn" style={{ marginTop: 10 }} onClick={e => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
            
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', width: '100%', textAlign: 'center' }}>
              {!mnemonic && !loadingMnemonic && (
                <button type="button" className="btn-explain" onClick={handleGenerateMnemonic}>✨ Generate Mnemonic</button>
              )}
              {loadingMnemonic && <div className="explanation-text">Thinking...</div>}
              {mnemonic && <div className="explanation-text" style={{ textAlign: 'left', color: 'var(--text-mid)', marginTop: 8 }}>{mnemonic}</div>}
            </div>
          </>
        )}
      </div>

      <div className="review-controls" style={{ paddingBottom: 40 }}>
        {!flipped ? (
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={handleExit}>Quit</button>
            <button type="button" className="btn-primary" style={{ flex: 2 }} onClick={() => setFlipped(true)}>Show Answer</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button 
              type="button"
              className="btn-primary btn-error" 
              style={{ flex: 1, fontSize: 14 }}
              onClick={() => handleRate('Hard')}
            >
              Hard
            </button>
            <button 
              type="button"
              className="btn-primary" 
              style={{ flex: 1, background: 'var(--primary)', borderBottomColor: 'var(--primary-dim)', fontSize: 14 }}
              onClick={() => handleRate('Good')}
            >
              Good
            </button>
            <button 
              type="button"
              className="btn-primary btn-success" 
              style={{ flex: 1, fontSize: 14 }}
              onClick={() => handleRate('Easy')}
            >
              Easy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
