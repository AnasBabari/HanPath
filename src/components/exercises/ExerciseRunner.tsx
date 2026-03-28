import { useState, useRef, useEffect } from 'react';
import { callOpenRouter } from '../../utils/ai';
import type { Lesson, Exercise } from '../../types';
import { playCorrect, playWrong } from '../../utils/sounds';
import { speak, normPinyin } from '../../utils/tts';

export default function ExerciseRunner({ lesson, onApiUse, onWordResult, onExit, onComplete }: {
  lesson: Lesson;
  onApiUse?: () => void;
  onWordResult?: (wordId: string, correct: boolean) => void;
  onExit: () => void;
  onComplete: (correct: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'ok' | 'no'>('idle');
  const [correctCount, setCorrectCount] = useState(0);
  const [showXP, setShowXP] = useState(false);
  const [shake, setShake] = useState(false);

  const [lastWrongAnswer, setLastWrongAnswer] = useState<string | undefined>(undefined);
  const [explanationText, setExplanationText] = useState('');
  const [explanationLoading, setExplanationLoading] = useState(false);

  const total = lesson.exercises.length;
  const ex = lesson.exercises[idx];

  const advance = () => {
    setFeedback('idle');
    setShake(false);
    setExplanationText('');
    setExplanationLoading(false);
    setLastWrongAnswer(undefined);
    if (idx + 1 >= total) { onComplete(correctCount, total); return; }
    setIdx(i => i + 1);
  };

  if (!ex) return null;
  const progress = ((idx + (feedback === 'ok' ? 1 : 0)) / total) * 100;

  const handleExplain = async () => {
    setExplanationLoading(true);
    try {
      let prompt = '';
      if (lastWrongAnswer) {
        prompt = `A beginner Chinese learner saw "${ex.prompt}" and answered "${lastWrongAnswer}" but the correct answer is "${ex.answer}". In 1-2 encouraging sentences, explain why "${ex.answer}" is correct and briefly clarify what "${lastWrongAnswer}" means if it is a real Chinese word. Keep it simple and beginner-friendly.`;
      } else {
        prompt = `A beginner Chinese learner got this wrong. The question was "${ex.prompt}" and the correct answer is "${ex.answer}". In 1-2 encouraging sentences, explain what this means and give a quick memory tip. Keep it beginner-friendly.`;
      }
      
      const response = await callOpenRouter([{ role: 'user', content: prompt }]);
      setExplanationText(response);
      onApiUse?.();
    } catch (err: unknown) {
      setExplanationText("Could not load explanation — check your API key in Profile.");
    } finally {
      setExplanationLoading(false);
    }
  };

  return (
    <div className="shell exercise-shell">
      {showXP && <div className="xp-float">+10 XP</div>}

      <div className="exercise-topbar">
        <button className="exit-btn" onClick={onExit}>✕ Exit</button>
        <span className="step-count">{idx + 1} / {total}</span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <ExerciseCard
        key={`${lesson.id}-${idx}`}
        exercise={ex}
        locked={feedback !== 'idle'}
        shake={shake}
        onCorrect={() => {
          setFeedback('ok');
          setCorrectCount(c => c + 1);
          if (ex.wordId) onWordResult?.(ex.wordId, true);
          playCorrect();
          setShowXP(true);
          setTimeout(() => setShowXP(false), 1000);
          const shouldSpeakAnswer =
            ex.type !== 'listening-select' &&
            ex.type !== 'listening-meaning' &&
            /[\u4e00-\u9fff]/.test(ex.answer);
          if (shouldSpeakAnswer) speak(ex.answer);
        }}
        onWrong={(wrongAns) => {
          setFeedback('no');
          setShake(true);
          setLastWrongAnswer(wrongAns);
          if (ex.wordId) onWordResult?.(ex.wordId, false);
          playWrong();
          setTimeout(() => setShake(false), 400);
        }}
      />

      {feedback === 'ok' && (
        <div className="feedback-strip ok">
          <p>✅ Correct!</p>
          <button className="btn-primary" onClick={advance}>Continue</button>
        </div>
      )}
      {feedback === 'no' && (
        <div className="feedback-strip no" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>❌ Not quite</p>
              <div className="answer-reveal" style={{ margin: '4px 0 0 0' }}>Answer: <strong>{ex.answer}</strong></div>
            </div>
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={advance}>Continue</button>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
            {!explanationText && !explanationLoading && (
              <button className="btn-explain" onClick={handleExplain}>💡 Explain Why</button>
            )}
            {explanationLoading && <div className="explanation-text" style={{ color: 'rgba(255,255,255,0.7)' }}>Thinking...</div>}
            {explanationText && <div className="explanation-text" style={{ color: 'rgba(255,255,255,0.9)' }}>{explanationText}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExerciseCard({ exercise: ex, locked, shake, onCorrect, onWrong }: {
  exercise: Exercise; locked: boolean; shake: boolean;
  onCorrect: () => void; onWrong: (guessed?: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [bankPick, setBankPick] = useState<number[]>([]);
  const submitted = useRef(false);
  const autoPlayTimer = useRef<number | null>(null);

  useEffect(() => {
    submitted.current = false;

    if (autoPlayTimer.current !== null) {
      window.clearTimeout(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }

    if ((ex.type === 'listening-select' || ex.type === 'listening-meaning') && ex.promptAudio) {
      autoPlayTimer.current = window.setTimeout(() => {
        speak(ex.promptAudio!);
      }, 300);
    }

    return () => {
      if (autoPlayTimer.current !== null) {
        window.clearTimeout(autoPlayTimer.current);
        autoPlayTimer.current = null;
      }
    };
  }, [ex.id, ex.type, ex.promptAudio]);

  const isListening = ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isMCQ = ex.type === 'reading-meaning' || ex.type === 'reading-hanzi' || ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isHanziOptions = ex.type === 'reading-hanzi' || ex.type === 'listening-select';
  const isTileBuilder = ex.type === 'compose' || ex.type === 'sentence-build';

  const typeLabel = {
    'reading-meaning': '👁️ Reading',
    'reading-hanzi': '👁️ Reading',
    'listening-select': '👂 Listening',
    'listening-meaning': '👂 Listening',
    'pinyin-type': '✍️ Writing',
    'compose': '🧩 Build',
    'sentence-build': '🧩 Grammar',
  }[ex.type];

  const check = () => {
    if (locked || submitted.current) return;

    if (isMCQ && choice !== null) {
      const selected = ex.options[choice];
      submitted.current = true;
      selected === ex.answer ? onCorrect() : onWrong(selected);
    } else if (ex.type === 'pinyin-type') {
      submitted.current = true;
      normPinyin(typed) === normPinyin(ex.answer) ? onCorrect() : onWrong(typed);
    } else if (isTileBuilder) {
      const built = bankPick.map(i => ex.bank![i]).join('');
      submitted.current = true;
      built === ex.answer ? onCorrect() : onWrong(built);
    }
  };

  const canCheck = isMCQ ? choice !== null
    : ex.type === 'pinyin-type' ? typed.trim() !== ''
    : isTileBuilder ? bankPick.length > 0
    : false;

  return (
    <div className={`exercise-card ${shake ? 'shake' : ''}`}>
      <div className="exercise-type-label">
        <span className="type-icon">{typeLabel?.split(' ')[0]}</span>
        {typeLabel?.split(' ').slice(1).join(' ')}
      </div>

      <div className="exercise-prompt">
        {isListening ? (
          <>
            <button className="listen-play-btn" onClick={() => ex.promptAudio && speak(ex.promptAudio)}>🔊</button>
            <p className="prompt-hint" style={{ textAlign: 'center' }}>{ex.prompt}</p>
          </>
        ) : ex.type === 'reading-hanzi' || ex.type === 'compose' ? (
          <>
            <p className="prompt-english">{ex.prompt}</p>
            {ex.hint && <p className="prompt-hint">{ex.hint}</p>}
          </>
        ) : ex.type === 'sentence-build' ? (
          <>
            <p className="prompt-english">{ex.prompt}</p>
            {ex.hint && <p className="prompt-hint">{ex.hint}</p>}
          </>
        ) : (
          <>
            <p className="prompt-main">{ex.prompt}</p>
            {ex.promptPinyin && <p className="prompt-pinyin">{ex.promptPinyin}</p>}
            {ex.hint && <p className="prompt-hint">{ex.hint}</p>}
          </>
        )}
      </div>

      {isMCQ && (
        <div className="option-grid">
          {ex.options.map((opt, i) => (
            <button
              key={opt}
              className={`option-btn ${choice === i ? 'selected' : ''} ${locked && opt === ex.answer ? 'correct' : ''} ${locked && choice === i && opt !== ex.answer ? 'wrong' : ''}`}
              disabled={locked}
              onClick={() => setChoice(i)}
            >
              {isHanziOptions ? (
                <div className="hanzi-option-wrap">
                  <span className="hanzi-option">{opt}</span>
                  {ex.optionsPinyin?.[i] && <span className="option-pinyin">{ex.optionsPinyin[i]}</span>}
                </div>
              ) : opt}
            </button>
          ))}
        </div>
      )}

      {ex.type === 'pinyin-type' && (
        <input
          className="pinyin-input"
          value={typed}
          disabled={locked}
          placeholder="Type pinyin here…"
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canCheck && !locked && check()}
          autoComplete="off"
        />
      )}

      {isTileBuilder && ex.bank && (
        <div className="compose-area">
          <div className="compose-slot">
            {bankPick.map((ti, order) => (
              <button key={`${ti}-${order}`} className={`char-tile placed ${ex.type === 'sentence-build' ? 'word-tile' : ''}`} disabled={locked}
                onClick={() => setBankPick(p => p.filter((_, j) => j !== order))}>
                {ex.bank![ti]}
              </button>
            ))}
          </div>
          <div className="compose-bank">
            {ex.bank.map((ch, i) => {
              const used = bankPick.includes(i);
              return (
                <button key={`${ch}-${i}`} className={`char-tile ${ex.type === 'sentence-build' ? 'word-tile' : ''} ${used ? 'used' : ''}`}
                  disabled={used || locked} onClick={() => setBankPick(p => [...p, i])}>
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="exercise-actions">
        <button className="btn-primary" disabled={locked || !canCheck} onClick={check}>Check</button>
      </div>
    </div>
  );
}
