import { useState, useRef, useEffect } from 'react';
import { callOpenRouter } from '../../utils/ai';
import type { Lesson, Exercise } from '../../types';
import { playCorrect, playWrong } from '../../utils/sounds';
import { speak, normPinyin } from '../../utils/tts';

export default function ExerciseRunner({ lesson, onWordResult, onExit, onComplete }: {
  lesson: Lesson;
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
    } catch (err: unknown) {
      setExplanationText("Could not load explanation — check your API key in Profile.");
    } finally {
      setExplanationLoading(false);
    }
  };

  return (
    <div className="shell" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-elevated)', overflowY: 'auto' }}>
      {showXP && <div className="xp-float">+10 XP</div>}

      <div className="exercise-topbar">
        <button className="exit-btn" onClick={onExit} style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: '28px', border: 'none', cursor: 'pointer', padding: '0 12px 0 0' }}>×</button>
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
        <div className="feedback-strip ok" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px 24px 40px', background: '#D7FFB8', borderTop: '2px solid rgba(0,0,0,0.05)', color: '#58CC02', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#58CC02' }}>Excellent!</p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={advance}>CONTINUE</button>
        </div>
      )}
      {feedback === 'no' && (
        <div className="feedback-strip no" style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px 24px 40px', background: '#FFDFE0', borderTop: '2px solid rgba(0,0,0,0.05)', color: '#FF4B4B', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#FF4B4B' }}>Correct Solution:</p>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#FF4B4B', marginTop: '4px' }}>{ex.answer}</div>
            </div>
            <button className="btn-primary" style={{ width: 'auto', background: '#ff4b4b', borderBottomColor: '#ea2b2b' }} onClick={advance}>Continue</button>
          </div>
          {!explanationText && !explanationLoading && (
            <button onClick={handleExplain} style={{ background: 'none', color: '#ff4b4b', fontWeight: 800, fontSize: '14px', textDecoration: 'underline' }}>Wait, why?</button>
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
  const submitted = useRef(false);

  useEffect(() => {
    submitted.current = false;
    if ((ex.type === 'listening-select' || ex.type === 'listening-meaning') && ex.promptAudio) {
      setTimeout(() => speak(ex.promptAudio!), 300);
    }
  }, [ex.id, ex.type, ex.promptAudio]);

  const isMCQ = ex.type === 'reading-meaning' || ex.type === 'reading-hanzi' || ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isTileBuilder = ex.type === 'compose' || ex.type === 'sentence-build';

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
    <div className={`exercise-card ${shake ? 'shake' : ''}`} style={{ marginTop: '20px', paddingBottom: '160px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px', textAlign: 'center' }}>
        {ex.type === 'listening-select' ? 'What did you hear?' : ex.prompt}
      </h2>

      {isMCQ && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {ex.options.map((opt, i) => (
            <button
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
          placeholder="Type Pinyin..."
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canCheck && !locked && check()}
          autoFocus
        />
      )}

      {isTileBuilder && ex.bank && (
        <div>
          <div style={{ minHeight: '64px', padding: '12px', borderBottom: '2px solid var(--surface-border)', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {bankPick.map((ti, order) => (
              <button key={`${ti}-${order}`} style={{ padding: '12px 16px', borderRadius: '16px', border: '2px solid var(--surface-border)', borderBottom: '4px solid var(--surface-border)', background: 'var(--bg-card)', fontWeight: 800, color: 'var(--text-main)', fontSize: '1.125rem' }}
                onClick={() => setBankPick(p => p.filter((_, j) => j !== order))}>
                {ex.bank![ti]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {ex.bank.map((ch, i) => {
              const used = bankPick.includes(i);
              return (
                <button key={`${ch}-${i}`} style={{ padding: '12px 20px', borderRadius: '16px', border: '2px solid var(--surface-border)', borderBottom: '4px solid var(--surface-border)', background: used ? 'var(--surface-border)' : 'var(--bg-card)', color: used ? 'transparent' : 'var(--text-main)', fontWeight: 800, fontSize: '1.125rem' }}
                  disabled={used || locked} onClick={() => setBankPick(p => [...p, i])}>
                  {ch}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!locked && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', padding: '24px', background: 'var(--bg-elevated)', borderTop: '2px solid var(--surface-border)' }}>
          <button className="btn-primary" style={{ width: '100%', background: canCheck ? 'var(--primary)' : 'var(--surface-border)', borderBottomColor: canCheck ? 'var(--primary-shadow)' : 'rgba(0,0,0,0.1)', color: canCheck ? 'white' : 'var(--text-muted)' }} disabled={!canCheck} onClick={check}>CHECK</button>
        </div>
      )}
    </div>
  );
}
