import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { callOpenRouter } from '../utils/ai';
import { allLessonsFlat } from '../utils/curriculum';
import { speak } from '../utils/tts';
import { useStore } from '../store/useStore';

export default function ReviewPage() {
  const { units, stats, rateWord, setFullScreen, setToast, authSession } = useStore();
  const navigate = useNavigate();

  const cards = useMemo(() => {
    if (!units) return [];
    const today = new Date().toISOString().split('T')[0];
    const vocab = allLessonsFlat(units).flatMap((l) => l.vocab);

    return vocab.filter((v) => {
      const srs = stats.wordSRS[v.id];
      if (!srs) {
        return (stats.completedLessons || []).some((id) => {
          const lesson = allLessonsFlat(units).find((l) => l.id === id);
          return lesson?.vocab.some((vv) => vv.id === v.id);
        });
      }
      return srs.nextReviewDate <= today;
    });
  }, [units, stats.wordSRS, stats.completedLessons]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [loadingMnemonic, setLoadingMnemonic] = useState(false);

  useEffect(() => {
    return () => {
      setFullScreen(false);
    };
  }, [setFullScreen]);

  const handleExit = () => {
    navigate(-1);
    setFullScreen(false);
  };

  if (!cards.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary-light text-primary flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display text-primary">All Caught Up!</h2>
          <p className="text-on-surface-variant text-sm">
            You have reviewed all due flashcards for today. Check back tomorrow!
          </p>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="touch-target w-full px-6 py-3.5 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark"
        >
          Back to Hub
        </button>
      </div>
    );
  }

  const card = cards[idx % cards.length];

  const handleGenerateMnemonic = async (e: React.MouseEvent) => {
    e.stopPropagation();

    setLoadingMnemonic(true);
    try {
      const response = await callOpenRouter(
        [{ role: 'user', content: `Give a short memory tip for the word "${card.hanzi}" (${card.meaning}).` }],
        {
          context: {
            mode: 'explain-word',
            hskLevel: card.hskLevel === 2 ? 2 : 1,
            targetWord: `${card.hanzi} (${card.pinyin}: ${card.meaning})`,
          },
          authToken: authSession.token || undefined,
        }
      );
      setMnemonic(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service temporarily unavailable';
      setToast(msg.length < 60 ? msg : 'AI connection issue — please try again.');
      setMnemonic('Memory tip unavailable at this moment.');
    } finally {
      setLoadingMnemonic(false);
    }
  };

  const handleRate = (rating: 'Hard' | 'Good' | 'Easy') => {
    rateWord(card.id, rating);
    setFlipped(false);
    setMnemonic('');
    if (idx + 1 >= cards.length) {
      handleExit();
    } else {
      setIdx(idx + 1);
    }
  };

  const remaining = cards.length - idx;

  return (
    <div className="flex-1 flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={handleExit}
          className="touch-target flex items-center gap-2 text-primary font-bold hover:underline"
          aria-label="Exit review session"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Exit</span>
        </button>

        <div className="text-center">
          <span className="text-sm font-bold text-on-surface">Spaced Review</span>
          <span className="text-xs text-on-surface-variant block">{remaining} cards remaining</span>
        </div>

        <div className="w-12" />
      </header>

      {/* Flashcard Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full">
        <div
          role="region"
          aria-label="Flashcard"
          className="bg-surface-card rounded-3xl p-8 border border-border shadow-md w-full text-center space-y-6 min-h-[320px] flex flex-col justify-between"
        >
          {!flipped ? (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="flex-1 flex flex-col items-center justify-center space-y-4 cursor-pointer w-full"
              aria-label="Reveal flashcard answer"
            >
              <span className="text-xs font-bold text-outline uppercase tracking-wider">Character (汉字)</span>
              <div className="text-6xl font-chinese font-bold text-on-surface">{card.hanzi}</div>
              {stats.revealPinyin === 'always' && (
                <div className="text-xl font-bold text-primary">{card.pinyin}</div>
              )}
              <span className="text-xs text-on-surface-variant font-bold mt-4">Tap to reveal meaning</span>
            </button>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-outline uppercase tracking-wider">Meaning & Pinyin</span>
                <div className="text-3xl font-bold text-on-surface">{card.meaning}</div>
                <div className="text-xl font-bold text-primary">{card.pinyin}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(card.hanzi);
                  }}
                  className="touch-target p-2 rounded-xl bg-surface-container text-primary hover:bg-primary-light transition-colors inline-flex items-center gap-1.5 text-xs font-bold mx-auto mt-2"
                  aria-label={`Listen pronunciation for ${card.hanzi}`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Listen</span>
                </button>
              </div>

              {/* Mnemonic Generation */}
              <div className="pt-4 border-t border-border w-full text-center">
                {!mnemonic && !loadingMnemonic && (
                  <button
                    type="button"
                    onClick={handleGenerateMnemonic}
                    className="touch-target px-4 py-2 rounded-xl bg-surface-container text-primary hover:bg-primary-light transition-all text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Mnemonic</span>
                  </button>
                )}
                {loadingMnemonic && (
                  <div className="text-xs font-bold text-on-surface-variant flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>Composing memory tip...</span>
                  </div>
                )}
                {mnemonic && (
                  <div className="bg-surface-container rounded-2xl p-3 text-xs text-on-surface-variant leading-relaxed text-left">
                    <span className="font-bold text-primary block mb-1">AI Memory Tip:</span>
                    {mnemonic}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="bg-surface-card border-t border-border p-4">
        <div className="max-w-xl mx-auto flex gap-3">
          {!flipped ? (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="touch-target w-full py-4 rounded-2xl bg-primary text-on-primary font-bold text-base shadow-md hover:bg-primary-dark transition-all"
            >
              Show Answer
            </button>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => handleRate('Hard')}
                className="touch-target flex-1 py-3.5 rounded-2xl bg-red-accessible text-white font-bold text-sm shadow-xs hover:bg-red-800 transition-all"
              >
                Hard (1 Day)
              </button>
              <button
                type="button"
                onClick={() => handleRate('Good')}
                className="touch-target flex-1 py-3.5 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-xs hover:bg-primary-dark transition-all"
              >
                Good (Normal)
              </button>
              <button
                type="button"
                onClick={() => handleRate('Easy')}
                className="touch-target flex-1 py-3.5 rounded-2xl bg-green-accessible text-white font-bold text-sm shadow-xs hover:bg-green-800 transition-all"
              >
                Easy (Long)
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
