import { useState, useMemo } from 'react';
import type { Unit, UserStats, Exercise, VocabCard } from '../types';
import { allLessonsFlat, genExercisesForVocab, genSentenceBuildExercises, genToneDrillExercises } from '../utils/curriculum';
import ExerciseRunner from '../components/exercises/ExerciseRunner';

export default function PracticePage({ units, stats, onBack, onXP, onWordResult, onLaunchReview }: {
  units: Unit[]; stats: UserStats;
  onBack: () => void; onXP: (amt: number) => void;
  onWordResult?: (wordId: string, correct: boolean) => void;
  onLaunchReview?: () => void;
}) {
  const [drillMode, setDrillMode] = useState<'menu' | 'weak' | 'random' | 'sentence' | 'tone'>('menu');
  const [drillExercises, setDrillExercises] = useState<Exercise[]>([]);

  const allDone = useMemo(() =>
    allLessonsFlat(units).filter(l => stats.completedLessons.includes(l.id)),
    [units, stats.completedLessons]
  );

  const flatVocab = useMemo(() => allLessonsFlat(units).flatMap(l => l.vocab), [units]);

  const weakWords = useMemo(() => {
    const list = Object.entries(stats.wordAccuracy)
      .map(([wordId, data]) => ({ wordId, ...data }))
      .filter(d => d.total >= 3 && (d.correct / d.total) < 0.70)
      .sort((a, b) => (a.correct / a.total) - (b.correct / b.total))
      .slice(0, 10);

    const vocabMap = new Map(flatVocab.map(v => [v.id, v]));

    return list.map(d => {
      const v = vocabMap.get(d.wordId);
      return v ? { ...v, accuracy: Math.round((d.correct / d.total) * 100) } : null;
    }).filter(Boolean) as (VocabCard & { accuracy: number })[];
  }, [stats.wordAccuracy, flatVocab]);

  const startDrill = (mode: 'weak' | 'random' | 'sentence' | 'tone') => {
    if (mode === 'weak') {
      setDrillExercises(genExercisesForVocab(weakWords, flatVocab));
    } else if (mode === 'sentence') {
      setDrillExercises(genSentenceBuildExercises());
    } else if (mode === 'tone') {
      setDrillExercises(genToneDrillExercises(flatVocab));
    } else {
      const all = allDone.flatMap(l => l.exercises);
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      setDrillExercises(shuffled.slice(0, 20)); // Random 20
    }
    setDrillMode(mode);
  };

  // If we are in a drill session, render the runner
  if (drillMode !== 'menu') {
    if (drillExercises.length === 0) {
      return (
        <div className="shell">
          <div className="sub-header">
            <button className="back-btn" onClick={() => setDrillMode('menu')}>← Back</button>
            <h2>Drill Complete!</h2>
          </div>
          <div className="practice-empty">
            <div className="empty-icon">💪</div>
            <p>Great session! Keep it up.</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setDrillMode('menu')}>Back to Menu</button>
          </div>
        </div>
      );
    }

    return (
      <ExerciseRunner
        lesson={{
          id: 'drill', unitId: 'none', index: 0, title: 'Practice Drill',
          summary: '', vocab: [], exercises: drillExercises
        }}
        geminiApiKey={stats.geminiApiKey}
        onWordResult={onWordResult}
        onExit={() => setDrillMode('menu')}
        onComplete={(correct, total) => {
          onXP(correct * 5); // 5 XP per correct in drill
          setDrillExercises([]);
        }}
      />
    );
  }

  // Otherwise, render the main menu
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

  return (
    <div className="shell" style={{ paddingBottom: 80 }}>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-brand">汉 Practice</span>
        </div>
      </div>

      {weakWords.length >= 3 && (
        <div className="path-section" style={{ borderTop: 'none', paddingTop: 8 }}>
          <h3 style={{ marginBottom: 4, fontSize: 16, color: 'var(--rose)' }}>⚠️ Trouble Words</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>Words you've struggled with most</p>
          
          <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 16, margin: '0 -16px', paddingInline: 16 }}>
            {weakWords.map(w => (
              <div key={w.id} style={{
                background: `color-mix(in srgb, var(--rose) ${100 - w.accuracy}%, var(--bg-card))`,
                padding: '16px 20px',
                borderRadius: 16,
                minWidth: 80,
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{w.hanzi}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700 }}>{w.accuracy}%</div>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ background: 'var(--rose)' }} onClick={() => startDrill('weak')}>
            Drill Weaknesses →
          </button>
        </div>
      )}

      <div className="path-section">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>General Drills</h3>
        
        <div 
          onClick={() => onLaunchReview?.()}
          style={{
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Flashcard Deck</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Classic spaced recognition with ✨ AI Mnemonics</div>
          </div>
          <div style={{ fontSize: 24 }}>📇</div>
        </div>

        <div 
          onClick={() => startDrill('random')}
          style={{
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Random Review</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>20 mixed exercises from all completed lessons</div>
          </div>
          <div style={{ fontSize: 24 }}>🎲</div>
        </div>

        <div 
          onClick={() => startDrill('sentence')}
          style={{
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Sentence Builder</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Practice HSK 1 & 2 grammar structures</div>
          </div>
          <div style={{ fontSize: 24 }}>🧩</div>
        </div>

        <div 
          onClick={() => startDrill('tone')}
          style={{
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Tone Practice</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Train your ear to identify the 4 tones</div>
          </div>
          <div style={{ fontSize: 24 }}>🎵</div>
        </div>

      </div>

    </div>
  );
}
