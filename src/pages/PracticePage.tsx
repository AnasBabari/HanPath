import { useState, useMemo } from 'react';
import type { Unit } from '../types';
import { allLessonsFlat } from '../utils/curriculum';
import { ExerciseCard } from '../components/exercises/ExerciseRunner';
import { playCorrect, playWrong } from '../utils/sounds';

export default function PracticePage({ units, completedLessons, onBack, onXP }: {
  units: Unit[]; completedLessons: string[];
  onBack: () => void; onXP: (amt: number) => void;
}) {
  const allDone = useMemo(() =>
    allLessonsFlat(units).filter(l => completedLessons.includes(l.id)),
    [units, completedLessons]
  );

  const randomExercises = useMemo(() => {
    const all = allDone.flatMap(l => l.exercises);
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 20);
  }, [allDone]);

  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'ok' | 'no'>('idle');
  const [shake, setShake] = useState(false);

  if (allDone.length === 0) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Practice</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">📚</div>
          <p>Complete at least one lesson to unlock practice mode!</p>
        </div>
      </div>
    );
  }

  if (idx >= randomExercises.length) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Practice Complete!</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">💪</div>
          <p>Great session! Keep it up.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setIdx(0)}>Practice Again</button>
        </div>
      </div>
    );
  }

  const ex = randomExercises[idx];

  return (
    <div className="shell exercise-shell">
      <div className="exercise-topbar">
        <button className="exit-btn" onClick={onBack}>← Back</button>
        <span className="step-count">{idx + 1} / {randomExercises.length}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${((idx + (feedback === 'ok' ? 1 : 0)) / randomExercises.length) * 100}%` }} />
      </div>

      <ExerciseCard
        key={`${ex.id}-prac-${feedback}`}
        exercise={ex} locked={feedback !== 'idle'} shake={shake}
        onCorrect={() => { setFeedback('ok'); playCorrect(); onXP(5); }}
        onWrong={() => { setFeedback('no'); setShake(true); playWrong(); setTimeout(() => setShake(false), 400); }}
      />

      {feedback === 'ok' && (
        <div className="feedback-strip ok">
          <p>✅ Correct! +5 XP</p>
          <button className="btn-primary" onClick={() => { setFeedback('idle'); setIdx(i => i + 1); }}>Continue</button>
        </div>
      )}
      {feedback === 'no' && (
        <div className="feedback-strip no">
          <p>❌ Not quite</p>
          <div className="answer-reveal">Answer: <strong>{ex.answer}</strong></div>
          <button className="btn-primary" onClick={() => { setFeedback('idle'); setIdx(i => i + 1); }}>Continue</button>
        </div>
      )}
    </div>
  );
}
