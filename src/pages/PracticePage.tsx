import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Exercise } from '../types';
import { allLessonsFlat, genExercisesForVocab, genSentenceBuildExercises, genToneDrillExercises } from '../utils/curriculum';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import { fetchSentences } from '../utils/api';
import { useStore } from '../store/useStore';

export default function PracticePage() {
  const { units, stats, hskLevel, addXP, updateWordResult, setFullScreen } = useStore();
  const navigate = useNavigate();
  const [drillMode, setDrillMode] = useState<'menu' | 'weak' | 'random' | 'sentence' | 'tone'>('menu');
  const [drillExercises, setDrillExercises] = useState<Exercise[]>([]);
  const [loadingDrill, setLoadingDrill] = useState(false);

  useEffect(() => {
    return () => {
      setFullScreen(false);
    };
  }, [setFullScreen]);

  const dueCount = useStore(state => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(state.stats.wordSRS).filter((w) => w.nextReviewDate <= today).length;
  });

  const allDone = useMemo(() => {
    if (!units) return [];
    const setCompleted = new Set(stats.completedLessons);
    return allLessonsFlat(units).filter(l => setCompleted.has(l.id));
  }, [units, stats.completedLessons]);

  const flatVocab = useMemo(() => units ? allLessonsFlat(units).flatMap(l => l.vocab) : [], [units]);

  const weakWords = useMemo(() => {
    const list = Object.entries(stats.wordAccuracy)
      .reduce<{ wordId: string; correct: number; total: number }[]>((acc, [wordId, data]) => {
        if (data.total >= 3 && (data.correct / data.total) < 0.70) {
          acc.push({ wordId, ...data });
        }
        return acc;
      }, [])
      .toSorted((a, b) => (a.correct / a.total) - (b.correct / b.total))
      .slice(0, 10);

    const vocabMap = new Map(flatVocab.map(v => [v.id, v]));

    return list.flatMap(d => {
      const v = vocabMap.get(d.wordId);
      return v ? [{ ...v, accuracy: Math.round((d.correct / d.total) * 100) }] : [];
    });
  }, [stats.wordAccuracy, flatVocab]);

  const startDrill = async (mode: 'weak' | 'random' | 'sentence' | 'tone') => {
    setLoadingDrill(true);
    try {
      if (mode === 'weak') {
        const allVocab = flatVocab.length >= 4 ? flatVocab : weakWords;
        setDrillExercises(genExercisesForVocab(weakWords, allVocab));
      } else if (mode === 'sentence') {
        const sentences = await fetchSentences(hskLevel);
        setDrillExercises(genSentenceBuildExercises(sentences));
      } else if (mode === 'tone') {
        setDrillExercises(genToneDrillExercises(flatVocab));
      } else {
        const all = allDone.flatMap(l => l.exercises);
        const shuffled = all.toSorted(() => Math.random() - 0.5);
        setDrillExercises(shuffled.slice(0, 20)); // Random 20
      }
      setDrillMode(mode);
      setFullScreen(true);
    } finally {
      setLoadingDrill(false);
    }
  };

  const handleExitDrill = () => {
    setDrillMode('menu');
    setFullScreen(false);
  };

  // If we are in a drill session, render the runner
  if (drillMode !== 'menu') {
    if (drillExercises.length === 0) {
      return (
        <div className="shell">
          <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
            <button type="button" className="back-btn" onClick={handleExitDrill}>← Back</button>
            <h2 style={{ margin: 0, marginLeft: 12 }}>Drill Complete!</h2>
          </div>
          <div className="practice-empty">
            <div className="empty-icon">💪</div>
            <p>Great session! Keep it up.</p>
            <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={handleExitDrill}>Back to Menu</button>
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
        onWordResult={updateWordResult}
        onExit={handleExitDrill}
        onComplete={(correct) => {
          addXP(correct * 5); // 5 XP per correct in drill
          setDrillExercises([]);
          setFullScreen(false);
        }}
      />
    );
  }

  // Otherwise, render the main menu
  if (allDone.length === 0) {
    return (
      <div className="shell">
        <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Practice</h2>
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
          <span className="topbar-brand">Hàn Practice</span>
        </div>
      </div>

      {loadingDrill && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span className="font-display" style={{ fontWeight: 800, color: 'var(--primary)' }}>Loading Drill...</span>
        </div>
      )}

      {weakWords.length >= 3 && (
        <div className="path-section" style={{ borderTop: 'none', paddingTop: 8 }}>
          <h3 className="font-display" style={{ marginBottom: 4, fontSize: 16, color: 'var(--error)' }}>⚡ Needs Practice</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>Review your weak words</p>
          
          <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 16, margin: '0 -16px', paddingInline: 16 }}>
            {weakWords.map(w => (
              <div key={w.id} style={{
                background: `color-mix(in srgb, #ff4b4b ${100 - w.accuracy}%, var(--bg-card))`,
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
          <button type="button" className="btn-primary btn-error" onClick={() => startDrill('weak')}>
            Drill Weaknesses
          </button>
        </div>
      )}

      <div className="path-section">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>General Drills</h3>
        
        <button 
          type="button"
          onClick={() => {
            navigate('/review');
            setFullScreen(true);
          }}
          style={{
            width: '100%', textTransform: 'none', textAlign: 'left', fontStyle: 'normal',
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: dueCount > 0 ? '2px solid var(--accent)' : '1px solid var(--border)', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 32 }}>📇</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                Spaced Review
                {dueCount > 0 && <span className="due-badge-inline">{dueCount}</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>Classic SM-2 flashcards for long-term memory</div>
            </div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--text-dim)' }}>→</div>
        </button>

        <button 
          type="button"
          onClick={() => startDrill('random')}
          style={{
            width: '100%', textTransform: 'none', textAlign: 'left', fontStyle: 'normal',
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>Random Review</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>20 mixed exercises from all completed lessons</div>
          </div>
          <div style={{ fontSize: 24 }}>🎲</div>
        </button>

        <button 
          type="button"
          onClick={() => startDrill('sentence')}
          style={{
            width: '100%', textTransform: 'none', textAlign: 'left', fontStyle: 'normal',
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>Sentence Builder</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>Practice HSK 1 & 2 grammar structures</div>
          </div>
          <div style={{ fontSize: 24 }}>🧩</div>
        </button>

        <button 
          type="button"
          onClick={() => startDrill('tone')}
          style={{
            width: '100%', textTransform: 'none', textAlign: 'left', fontStyle: 'normal',
            background: 'var(--bg-card)', padding: 16, borderRadius: 16, marginBottom: 12,
            border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>Tone Practice</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>Train your ear to identify the 4 tones</div>
          </div>
          <div style={{ fontSize: 24 }}>🎵</div>
        </button>

      </div>

    </div>
  );
}
