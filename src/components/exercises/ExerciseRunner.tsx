import React, { useState, useRef, useEffect, useReducer } from 'react';
import { callOpenRouter } from '../../utils/ai';
import type { Lesson, Exercise } from '../../types';
import { playCorrect, playWrong } from '../../utils/sounds';
import { speak } from '../../utils/tts';
import { evaluateExercise } from '../../utils/exerciseEvaluator';
import StrokeOrderPractice from './StrokeOrderPractice';

type RunnerState = {
  idx: number;
  feedback: 'idle' | 'ok' | 'no';
  showXP: boolean;
  shake: boolean;
  explanationText: React.ReactNode;
  explanationLoading: boolean;
};

type RunnerAction =
  | { type: 'ADVANCE' }
  | { type: 'SET_FEEDBACK'; feedback: 'idle' | 'ok' | 'no'; shake?: boolean }
  | { type: 'SET_SHOW_XP'; showXP: boolean }
  | { type: 'SET_SHAKE'; shake: boolean }
  | { type: 'SET_EXPLANATION'; text?: React.ReactNode; loading?: boolean };

function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'ADVANCE':
      return {
        ...state,
        idx: state.idx + 1,
        feedback: 'idle',
        shake: false,
        explanationText: '',
        explanationLoading: false,
      };
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.feedback, shake: action.shake ?? state.shake };
    case 'SET_SHOW_XP':
      return { ...state, showXP: action.showXP };
    case 'SET_SHAKE':
      return { ...state, shake: action.shake };
    case 'SET_EXPLANATION':
      return {
        ...state,
        explanationText: action.text !== undefined ? action.text : state.explanationText,
        explanationLoading: action.loading !== undefined ? action.loading : state.explanationLoading,
      };
    default:
      return state;
  }
}

export default function ExerciseRunner({ lesson, onWordResult, onExit, onComplete }: {
  lesson: Lesson;
  onWordResult?: (wordId: string, correct: boolean) => void;
  onExit: () => void;
  onComplete: (correct: number, total: number) => void;
}) {
  const [state, dispatch] = useReducer(runnerReducer, {
    idx: 0,
    feedback: 'idle',
    showXP: false,
    shake: false,
    explanationText: '',
    explanationLoading: false,
  });

  const { idx, feedback, showXP, shake, explanationText, explanationLoading } = state;
  const correctCountRef = useRef(0);
  const lastWrongAnswerRef = useRef<string | undefined>(undefined);

  const total = lesson.exercises.length;
  const ex = lesson.exercises[idx];

  const advance = () => {
    lastWrongAnswerRef.current = undefined;
    if (idx + 1 >= total) { onComplete(correctCountRef.current, total); return; }
    dispatch({ type: 'ADVANCE' });
  };

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (feedback !== 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [feedback]);

  if (!ex) return null;
  const progress = ((idx + (feedback === 'ok' ? 1 : 0)) / total) * 100;

  const handleExplain = async () => {
    dispatch({ type: 'SET_EXPLANATION', loading: true });
    try {
      const response = await callOpenRouter(
        [{ role: 'user', content: 'Please explain this question.' }],
        {
          context: {
            mode: 'explain-mistake',
            hskLevel: (lesson.vocab[0]?.hskLevel === 2 ? 2 : 1),
            userAnswer: lastWrongAnswerRef.current,
            correctAnswer: ex.answer,
            exercisePrompt: ex.prompt,
          },
        }
      );
      dispatch({ type: 'SET_EXPLANATION', text: response, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load explanation.';
      dispatch({
        type: 'SET_EXPLANATION',
        text: msg.length < 120 ? msg : 'Could not load explanation — please try again shortly.',
        loading: false,
      });
    }
  };

  return (
    <div className="shell" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-elevated)', overflowY: 'auto' }}>
      {showXP && <div className="xp-float">+10 XP</div>}

      <div className="exercise-topbar">
        <button
          type="button"
          className="exit-btn"
          onClick={onExit}
          aria-label="Exit exercise"
          style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '28px', border: 'none', cursor: 'pointer', padding: '0 12px 0 0' }}
        >
          ×
        </button>
        <div className="progress-track" style={{ flex: 1, height: '16px', background: 'var(--surface-border)', borderRadius: '99px', overflow: 'hidden' }}>
          <div className="progress-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '99px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
        <span className="step-count" style={{ marginLeft: '16px', fontWeight: 800, color: 'var(--text-muted)' }}>{idx + 1}/{total}</span>
      </div>

      <ExerciseCard
        key={`${lesson.id}-${idx}`}
        exercise={ex}
        locked={feedback !== 'idle'}
        shake={shake}
        onCorrect={() => {
          dispatch({ type: 'SET_FEEDBACK', feedback: 'ok' });
          correctCountRef.current += 1;
          if (ex.wordId) onWordResult?.(ex.wordId, true);
          playCorrect();
          dispatch({ type: 'SET_SHOW_XP', showXP: true });
          setTimeout(() => dispatch({ type: 'SET_SHOW_XP', showXP: false }), 1000);
          const shouldSpeakAnswer =
            ex.type !== 'listening-select' &&
            ex.type !== 'listening-meaning' &&
            /[\u4e00-\u9fff]/.test(ex.answer);
          if (shouldSpeakAnswer) speak(ex.answer);
        }}
        onWrong={(wrongAns) => {
          dispatch({ type: 'SET_FEEDBACK', feedback: 'no', shake: true });
          lastWrongAnswerRef.current = wrongAns;
          if (ex.wordId) onWordResult?.(ex.wordId, false);
          playWrong();
          setTimeout(() => dispatch({ type: 'SET_SHAKE', shake: false }), 400);
        }}
      />

      {feedback === 'ok' && (
        <div className="feedback-strip ok" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px 24px 40px', background: 'var(--correct-bg)', borderTop: '2px solid rgba(0,0,0,0.05)', color: 'var(--correct)', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="font-display" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--correct)' }}>Excellent! 🎉</p>
          <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={advance}>CONTINUE (Enter)</button>
        </div>
      )}
      {feedback === 'no' && (
        <div className="feedback-strip no" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px 24px 40px', background: 'var(--error-bg)', borderTop: '2px solid rgba(0,0,0,0.05)', color: 'var(--error)', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p className="font-display" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--error)' }}>Correct Solution:</p>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--error)', marginTop: '4px' }}>{ex.answer}</div>
            </div>
            <button type="button" className="btn-primary" style={{ width: 'auto', background: 'var(--error)', borderBottomColor: 'var(--rose-shadow)' }} onClick={advance}>Continue</button>
          </div>
          {!explanationText && !explanationLoading && (
            <button type="button" onClick={handleExplain} style={{ background: 'none', color: 'var(--error)', fontWeight: 800, fontSize: '14px', textDecoration: 'underline', border: 'none', cursor: 'pointer', textAlign: 'left' }}>Wait, why?</button>
          )}
          {explanationLoading && <p style={{ fontSize: '14px' }}>Thinking...</p>}
          {explanationText && <p style={{ fontSize: '14px', lineHeight: 1.4 }}>{explanationText}</p>}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise: ex, locked, shake, onCorrect, onWrong }: {
  exercise: Exercise; locked: boolean; shake: boolean;
  onCorrect: () => void; onWrong: (guessed?: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [bankPick, setBankPick] = useState<number[]>([]);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    submitted.current = false;
    let timer: ReturnType<typeof setTimeout>;
    if ((ex.type === 'listening-select' || ex.type === 'listening-meaning') && ex.promptAudio) {
      timer = setTimeout(() => speak(ex.promptAudio!), 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ex.id, ex.type, ex.promptAudio]);

  const isMCQ = ex.type === 'reading-meaning' || ex.type === 'reading-hanzi' || ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isTileBuilder = ex.type === 'compose' || ex.type === 'sentence-build';
  const isAudioType = ex.type === 'listening-select' || ex.type === 'listening-meaning';

  const check = () => {
    if (locked || submitted.current) return;
    const result = evaluateExercise(ex, {
      choiceIndex: choice,
      typedText: typed,
      bankPickIndices: bankPick,
    });

    submitted.current = true;
    if (result.isCorrect) {
      onCorrect();
    } else {
      onWrong(result.userAnswer || undefined);
    }
  };

  const canCheck = isMCQ ? choice !== null
    : ex.type === 'pinyin-type' ? typed.trim() !== ''
    : isTileBuilder ? bankPick.length > 0
    : false;

  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (locked || submitted.current) return;

      if (isMCQ && ['1', '2', '3', '4'].includes(e.key)) {
        const optIndex = parseInt(e.key, 10) - 1;
        if (optIndex >= 0 && optIndex < ex.options.length) {
          setChoice(optIndex);
        }
      }

      if (isTileBuilder && e.key === 'Backspace') {
        setBankPick((prev) => prev.slice(0, -1));
      }

      if (e.key === 'Enter' && canCheck && ex.type !== 'pinyin-type') {
        checkRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [locked, isMCQ, isTileBuilder, canCheck, ex.options.length, ex.type]);

  return (
    <div className={`exercise-card ${shake ? 'shake' : ''}`} style={{ marginTop: '20px', paddingBottom: '160px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px' }}>
          {ex.type === 'listening-select' ? 'What did you hear?' : ex.prompt}
        </h2>
        {ex.promptPinyin && (
          <div style={{ fontSize: '1.125rem', color: 'var(--primary)', fontWeight: 800 }}>
            {ex.promptPinyin}
          </div>
        )}

        {/* Audio Exercise Controls & Accessibility Fallback */}
        {isAudioType && ex.promptAudio && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => speak(ex.promptAudio!)}
              aria-label="Replay audio prompt"
              className="btn-secondary"
              style={{ padding: '8px 16px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700 }}
            >
              <span className="material-symbols-outlined text-lg">volume_up</span>
              Replay Audio
            </button>
            <button
              type="button"
              onClick={() => setShowAudioHint((prev) => !prev)}
              aria-label="Toggle visual transcript hint"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
            >
              {showAudioHint ? 'Hide Transcript' : 'Audio Hint'}
            </button>
            {showAudioHint && (
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 800, background: 'var(--surface-container)', padding: '4px 10px', borderRadius: '8px' }}>
                {ex.promptAudio}
              </span>
            )}
          </div>
        )}
      </div>

      {isMCQ && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {ex.options.map((opt, i) => (
            <button
              type="button"
              key={opt}
              className={`option-btn ${choice === i ? 'selected' : ''}`}
              style={{
                padding: '16px', borderRadius: '16px', border: '2px solid var(--surface-border)', borderBottom: '4px solid var(--surface-border)',
                background: choice === i ? 'var(--blue-bg)' : 'var(--bg-card)', borderColor: choice === i ? 'var(--blue-shadow)' : 'var(--surface-border)', color: choice === i ? 'var(--blue)' : 'var(--text-main)',
                fontSize: '1.125rem', fontWeight: 800, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s',
                transform: choice === i ? 'translateY(2px)' : 'none', borderBottomWidth: choice === i ? '2px' : '4px'
              }}
              disabled={locked}
              onClick={() => setChoice(i)}
            >
              <span style={{ width: '32px', height: '32px', borderRadius: '8px', border: `2px solid ${choice === i ? 'var(--blue)' : 'var(--surface-border)'}`, display: 'grid', placeItems: 'center', fontSize: '14px', color: choice === i ? 'var(--blue)' : 'var(--text-muted)' }}>{i + 1}</span>
              {opt}
            </button>
          ))}
        </div>
      )}

      {ex.type === 'pinyin-type' && (
        <input
          style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid var(--surface-border)', fontSize: '1.25rem', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 800 }}
          value={typed}
          disabled={locked}
          placeholder="Type Pinyin (e.g. ni hao)..."
          aria-label="Type Pinyin..."
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canCheck && !locked && check()}
          autoFocus
        />
      )}

      {ex.type === 'stroke-order' && (
        <StrokeOrderPractice
          character={ex.answer[0]}
          onComplete={() => {
            submitted.current = true;
            onCorrect();
          }}
        />
      )}

      {isTileBuilder && ex.bank && (
        <div>
          <div style={{ minHeight: '64px', padding: '12px', borderBottom: '2px solid var(--surface-border)', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {bankPick.map((ti, order) => {
              const pickItem = { id: `picked-${ti}-${order}`, char: ex.bank![ti] };
              return (
                <button type="button" key={pickItem.id} style={{ padding: '12px 16px', borderRadius: '16px', border: '2px solid var(--surface-border)', borderBottom: '4px solid var(--surface-border)', background: 'var(--bg-card)', fontWeight: 800, color: 'var(--text-main)', fontSize: '1.125rem' }}
                  onClick={() => setBankPick(p => p.filter((_, j) => j !== order))}>
                  {pickItem.char}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {(() => {
              const bankPickSet = new Set(bankPick);
              const tiles = ex.bank.map((ch, idx) => ({ id: `tile-${ex.id}-${ch}-${idx * 13}`, char: ch, index: idx }));
              return tiles.map((tile) => {
                const used = bankPickSet.has(tile.index);
                return (
                  <button type="button" key={tile.id} style={{ padding: '12px 20px', borderRadius: '16px', border: '2px solid var(--surface-border)', borderBottom: '4px solid var(--surface-border)', background: used ? 'var(--surface-border)' : 'var(--bg-card)', color: used ? 'transparent' : 'var(--text-main)', fontWeight: 800, fontSize: '1.125rem' }}
                    disabled={used || locked} onClick={() => setBankPick(p => [...p, tile.index])}>
                    {tile.char}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

      {!locked && ex.type !== 'stroke-order' && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px', background: 'var(--bg-elevated)', borderTop: '2px solid var(--surface-border)' }}>
          <button type="button" className="btn-primary" style={{ width: '100%', background: canCheck ? 'var(--primary)' : 'var(--surface-border)', borderBottomColor: canCheck ? 'var(--primary-shadow)' : 'rgba(0,0,0,0.1)', color: canCheck ? 'white' : 'var(--text-muted)' }} disabled={!canCheck} onClick={check}>CHECK</button>
        </div>
      )}
    </div>
  );
}
