import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  Layers,
  Shuffle,
  Puzzle,
  Volume2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import type { Exercise } from '../types';
import { allLessonsFlat } from '../utils/curriculum';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import { fetchSentencesForLevel } from '../utils/api';
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

  const dueCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(stats.wordSRS || {}).filter((w) => w.nextReviewDate <= today).length;
  }, [stats.wordSRS]);

  const allDone = useMemo(() => {
    if (!units) return [];
    const setCompleted = new Set(stats.completedLessons || []);
    return allLessonsFlat(units).filter((l) => setCompleted.has(l.id));
  }, [units, stats.completedLessons]);

  const flatVocab = useMemo(
    () => (units ? allLessonsFlat(units).flatMap((l) => l.vocab) : []),
    [units]
  );

  const weakWords = useMemo(() => {
    const list = Object.entries(stats.wordAccuracy || {})
      .reduce<{ wordId: string; correct: number; total: number }[]>((acc, [wordId, data]) => {
        if (data.total >= 3 && data.correct / data.total < 0.7) {
          acc.push({ wordId, ...data });
        }
        return acc;
      }, [])
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 10);

    const vocabMap = new Map(flatVocab.map((v) => [v.id, v]));

    return list.flatMap((d) => {
      const v = vocabMap.get(d.wordId);
      return v ? [{ ...v, accuracy: Math.round((d.correct / d.total) * 100) }] : [];
    });
  }, [stats.wordAccuracy, flatVocab]);

  const startDrill = async (mode: 'weak' | 'random' | 'sentence' | 'tone') => {
    setLoadingDrill(true);
    try {
      if (mode === 'sentence') {
        const sentences = await fetchSentencesForLevel(hskLevel);
        const sentenceExercises: Exercise[] = sentences.map((s, i) => ({
          id: `drill-sent-${i}`,
          type: 'sentence-build',
          prompt: s.en,
          hint: s.py,
          answer: s.zh,
          options: [],
          bank: s.tiles.sort(() => Math.random() - 0.5),
        }));
        setDrillExercises(sentenceExercises);
      } else {
        const allExercises = allDone.flatMap((l) => l.exercises);
        const shuffled = allExercises.sort(() => Math.random() - 0.5);
        setDrillExercises(shuffled.slice(0, 15));
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

  // If in active drill session
  if (drillMode !== 'menu') {
    if (drillExercises.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary-light text-primary flex items-center justify-center shadow-sm">
            <Sparkles className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display text-primary">Drill Complete!</h2>
            <p className="text-on-surface-variant text-sm">
              Great practice session! Keep strengthening your retention.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExitDrill}
            className="touch-target w-full px-6 py-3.5 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark"
          >
            Back to Practice Hub
          </button>
        </div>
      );
    }

    return (
      <ExerciseRunner
        lesson={{
          id: 'drill',
          unitId: 'none',
          index: 0,
          title: 'Practice Drill',
          summary: '',
          vocab: [],
          exercises: drillExercises,
        }}
        onWordResult={updateWordResult}
        onExit={handleExitDrill}
        onComplete={(correct) => {
          addXP(correct * 5);
          setDrillExercises([]);
          setFullScreen(false);
        }}
      />
    );
  }

  // Empty state if 0 lessons completed
  if (allDone.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-primary-light text-primary flex items-center justify-center shadow-inner">
          <Dumbbell className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display text-on-surface">Practice Hub Locked</h2>
          <p className="text-on-surface-variant text-sm">
            Complete your very first lesson on the Learn Path to unlock spaced repetition flashcards, weak word drills, and sentence builders!
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="touch-target w-full px-6 py-4 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          <span>Start Lesson 1</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-24 relative">
      {loadingDrill && (
        <div className="absolute inset-0 z-40 bg-surface/80 backdrop-blur-xs flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary-light border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 w-full">
        {/* Header */}
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Daily Mastery</span>
          <h1 className="text-3xl font-bold font-display text-on-surface">Practice Hub</h1>
          <p className="text-sm text-on-surface-variant">
            Target weak areas, train your memory with spaced repetition, and master sentence grammar.
          </p>
        </div>

        {/* Weak Words Alert */}
        {weakWords.length >= 3 && (
          <section className="bg-red-50 border border-red-200 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-display text-red-accessible">Needs Practice</h2>
                <p className="text-xs text-red-800">Words with lower accuracy across your sessions</p>
              </div>
              <button
                type="button"
                onClick={() => startDrill('weak')}
                className="touch-target px-4 py-2 bg-red-accessible text-white rounded-xl text-xs font-bold shadow-xs hover:bg-red-800"
              >
                Drill Now
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {weakWords.map((w) => (
                <div
                  key={w.id}
                  className="bg-white border border-red-200 rounded-xl px-3 py-1.5 text-center shadow-xs"
                >
                  <div className="font-chinese text-base font-bold text-on-surface">{w.hanzi}</div>
                  <div className="text-[10px] font-bold text-red-accessible">{w.accuracy}%</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Practice Options Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Spaced Repetition Review */}
          <button
            type="button"
            onClick={() => {
              navigate('/review');
              setFullScreen(true);
            }}
            className="touch-target bg-surface-card p-6 rounded-3xl border border-border hover:border-primary hover:shadow-md transition-all text-left flex items-start justify-between gap-4 group"
            aria-label={`Spaced Repetition Review: ${dueCount} cards due`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-on-surface">Spaced Review (SM-2)</h3>
                  {dueCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-accessible text-white text-[10px] font-bold rounded-full">
                      {dueCount} due
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Classic SuperMemo SM-2 flashcard intervals for long-term vocabulary retention.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </button>

          {/* Random Review Drill */}
          <button
            type="button"
            onClick={() => startDrill('random')}
            className="touch-target bg-surface-card p-6 rounded-3xl border border-border hover:border-primary hover:shadow-md transition-all text-left flex items-start justify-between gap-4 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center shrink-0">
                <Shuffle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Random Mix Drill</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  15 mixed reading and listening exercises sampled from completed lessons.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </button>

          {/* Sentence Builder */}
          <button
            type="button"
            onClick={() => startDrill('sentence')}
            className="touch-target bg-surface-card p-6 rounded-3xl border border-border hover:border-primary hover:shadow-md transition-all text-left flex items-start justify-between gap-4 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center shrink-0">
                <Puzzle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Sentence Builder</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Assemble essential Mandarin sentences with interactive tile banks.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </button>

          {/* Tone Practice */}
          <button
            type="button"
            onClick={() => startDrill('tone')}
            className="touch-target bg-surface-card p-6 rounded-3xl border border-border hover:border-primary hover:shadow-md transition-all text-left flex items-start justify-between gap-4 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center shrink-0">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Tone Trainer</h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Sharpen your ear by identifying the 4 Mandarin Chinese pitch contours.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </button>
        </section>
      </main>
    </div>
  );
}
