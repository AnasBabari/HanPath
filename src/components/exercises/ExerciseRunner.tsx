import { useState, useRef, useEffect } from 'react';
import type { Lesson, Exercise } from '../../types';
import { playCorrect, playWrong } from '../../utils/sounds';
import { speak, normPinyin } from '../../utils/tts';

export default function ExerciseRunner({ lesson, onExit, onComplete }: {
  lesson: Lesson;
  onExit: () => void;
  onComplete: (correct: number, total: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'ok' | 'no'>('idle');
  const [correctCount, setCorrectCount] = useState(0);
  const [showXP, setShowXP] = useState(false);
  const [shake, setShake] = useState(false);
  const total = lesson.exercises.length;
  const ex = lesson.exercises[idx];

  const advance = () => {
    setFeedback('idle');
    setShake(false);
    if (idx + 1 >= total) { onComplete(correctCount, total); return; }
    setIdx(i => i + 1);
  };

  if (!ex) return null;
  const progress = ((idx + (feedback === 'ok' ? 1 : 0)) / total) * 100;

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
        key={`${ex.id}-${feedback}`}
        exercise={ex}
        locked={feedback !== 'idle'}
        shake={shake}
        onCorrect={() => {
          setFeedback('ok');
          setCorrectCount(c => c + 1);
          playCorrect();
          setShowXP(true);
          setTimeout(() => setShowXP(false), 1000);
          if (ex.promptAudio || /[\u4e00-\u9fff]/.test(ex.answer)) speak(ex.promptAudio || ex.answer);
        }}
        onWrong={() => {
          setFeedback('no');
          setShake(true);
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
        <div className="feedback-strip no">
          <p>❌ Not quite</p>
          <div className="answer-reveal">Answer: <strong>{ex.answer}</strong></div>
          <button className="btn-primary" onClick={advance}>Continue</button>
        </div>
      )}
    </div>
  );
}

export function ExerciseCard({ exercise: ex, locked, shake, onCorrect, onWrong }: {
  exercise: Exercise; locked: boolean; shake: boolean;
  onCorrect: () => void; onWrong: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [bankPick, setBankPick] = useState<number[]>([]);
  const played = useRef(false);

  useEffect(() => {
    if (!played.current && (ex.type === 'listening-select' || ex.type === 'listening-meaning') && ex.promptAudio) {
      played.current = true;
      setTimeout(() => speak(ex.promptAudio!), 300);
    }
  }, [ex]);

  const isListening = ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isMCQ = ex.type === 'reading-meaning' || ex.type === 'reading-hanzi' || ex.type === 'listening-select' || ex.type === 'listening-meaning';
  const isHanziOptions = ex.type === 'reading-hanzi' || ex.type === 'listening-select';

  const typeLabel = {
    'reading-meaning': '👁️ Reading',
    'reading-hanzi': '👁️ Reading',
    'listening-select': '👂 Listening',
    'listening-meaning': '👂 Listening',
    'pinyin-type': '✍️ Writing',
    'compose': '🧩 Build',
  }[ex.type];

  // We have a problem here: type mapping can not cover some keys if TS strict is ON for strings.
  // Actually ex.type is strictly typed to ExerciseType.

  const check = () => {
    if (isMCQ && choice !== null) {
      ex.options[choice] === ex.answer ? onCorrect() : onWrong();
    } else if (ex.type === 'pinyin-type') {
      normPinyin(typed) === normPinyin(ex.answer) ? onCorrect() : onWrong();
    } else if (ex.type === 'compose') {
      const built = bankPick.map(i => ex.bank![i]).join('');
      built === ex.answer ? onCorrect() : onWrong();
    }
  };

  const canCheck = isMCQ ? choice !== null
    : ex.type === 'pinyin-type' ? typed.trim() !== ''
    : ex.type === 'compose' ? bankPick.length > 0
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

      {ex.type === 'compose' && ex.bank && (
        <div className="compose-area">
          <div className="compose-slot">
            {bankPick.map((ti, order) => (
              <button key={`${ti}-${order}`} className="char-tile placed" disabled={locked}
                onClick={() => setBankPick(p => p.filter((_, j) => j !== order))}>
                {ex.bank![ti]}
              </button>
            ))}
          </div>
          <div className="compose-bank">
            {ex.bank.map((ch, i) => {
              const used = bankPick.includes(i);
              return (
                <button key={`${ch}-${i}`} className={`char-tile ${used ? 'used' : ''}`}
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
