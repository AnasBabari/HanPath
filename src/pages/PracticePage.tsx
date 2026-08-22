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
import type { Exercise, Lesson } from '../types';
import { allLessonsFlat } from '../utils/curriculum';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import { fetchSentencesForLevel } from '../utils/api';
import { useStore } from '../store/useStore';

export default function PracticePage() {
  const { units, snapshot, hskLevel, addXP, updateWordResult, setFullScreen } = useStore();
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
    return Object.values(snapshot.wordSRS || {}).filter((w) => w.nextReviewDate <= today).length;
  }, [snapshot.wordSRS]);

  const completedList = useMemo(
    () => snapshot.hskLevelProgress[hskLevel]?.completedLessons || [],
    [snapshot.hskLevelProgress, hskLevel]
  );

  const allDone = useMemo(() => {
    if (!units) return [];
    const setCompleted = new Set(completedList);
    return allLessonsFlat(units).filter((l) => setCompleted.has(l.id));
  }, [units, completedList]);

  const flatVocab = useMemo(
    () => (units ? allLessonsFlat(units).flatMap((l) => l.vocab) : []),
    [units]
  );

  const weakWords = useMemo(() => {
    const list = Object.entries(snapshot.wordAccuracy || {})
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
  }, [snapshot.wordAccuracy, flatVocab]);

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
        <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto w-full text-center space-y-4">
          <p className="font-bold text-lg text-on-surface">No exercises available for this mode yet.</p>
          <button
            type="button"
            onClick={handleExitDrill}
            className="touch-target px-6 py-3 bg-primary text-on-primary rounded-xl font-bold"
          >
            Back to Practice
          </button>
        </div>
      );
    }

    const dummyLesson: Lesson = {
      id: `drill-${drillMode}`,
      unitId: 'drill-unit',
      index: 0,
      title: `Practice Drill: ${drillMode}`,
      summary: `Practice drill for ${drillMode}`,
      vocab: [],
      exercises: drillExercises,
    };

    return (
      <ExerciseRunner
        lesson={dummyLesson}
        onComplete={(correct) => {
          addXP(correct * 5);
          handleExitDrill();
        }}
        onWordResult={(wId, ok) => updateWordResult(wId, ok)}
        onExit={handleExitDrill}
      />
    );
  }

  // Locked State: If 0 lessons completed in current HSK level
  if (completedList.length === 0) {
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
          onClick={() => navigate('/learn')}
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
    <div className="bg-surface text-on-surface flex-1 flex flex-col overflow-y-auto pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-primary">Practice & Mastery</h1>
            <p className="text-xs text-on-surface-variant">Reinforce vocabulary, tones, and sentences</p>
          </div>
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-border">
            <Sparkles className="w-4 h-4 text-gold-badge fill-gold-badge" />
            <span className="text-xs font-bold text-on-surface-variant">HSK {hskLevel} Mastery</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6 w-full">
        {/* SRS Review Banner */}
        <section className="bg-surface-card rounded-3xl p-6 border-2 border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 text-center sm:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>Spaced Repetition System</span>
            </div>
            <h2 className="text-xl font-bold font-display text-on-surface">Smart SRS Review</h2>
            <p className="text-xs text-on-surface-variant max-w-md">
              {dueCount > 0
                ? `You have ${dueCount} flashcard${dueCount > 1 ? 's' : ''} ready for memory reinforcement today.`
                : 'All caught up on scheduled reviews for today! Great dedication.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/review')}
            className="touch-target w-full sm:w-auto px-6 py-3.5 bg-primary text-on-primary font-bold text-sm rounded-2xl shadow-sm hover:bg-primary-dark transition-all shrink-0 flex items-center justify-center gap-2 z-10"
          >
            <span>{dueCount > 0 ? `Review (${dueCount})` : 'Practice Flashcards'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </section>

        {/* Practice Modes Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tone Trainer */}
          <button
            type="button"
            disabled={loadingDrill}
            onClick={() => startDrill('tone')}
            className="touch-target p-5 bg-surface-card rounded-2xl border border-border shadow-xs hover:border-primary transition-all text-left flex items-start gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-accessible flex items-center justify-center shrink-0">
              <Volume2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-on-surface">Tone Training</h3>
              <p className="text-xs text-on-surface-variant">Discriminate and practice Chinese tonal pitch patterns</p>
            </div>
          </button>

          {/* Sentence Builder */}
          <button
            type="button"
            disabled={loadingDrill}
            onClick={() => startDrill('sentence')}
            className="touch-target p-5 bg-surface-card rounded-2xl border border-border shadow-xs hover:border-primary transition-all text-left flex items-start gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-accessible flex items-center justify-center shrink-0">
              <Puzzle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-on-surface">Sentence Builder</h3>
              <p className="text-xs text-on-surface-variant">Assemble real sentences using word tiles</p>
            </div>
          </button>

          {/* Random Mix */}
          <button
            type="button"
            disabled={loadingDrill}
            onClick={() => startDrill('random')}
            className="touch-target p-5 bg-surface-card rounded-2xl border border-border shadow-xs hover:border-primary transition-all text-left flex items-start gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Shuffle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-on-surface">Random Mix Drill</h3>
              <p className="text-xs text-on-surface-variant">Rapid multi-modal challenge from completed lessons</p>
            </div>
          </button>

          {/* Weak Words Drill */}
          <button
            type="button"
            disabled={loadingDrill || weakWords.length === 0}
            onClick={() => startDrill('weak')}
            className={`touch-target p-5 bg-surface-card rounded-2xl border border-border shadow-xs text-left flex items-start gap-4 transition-all ${
              weakWords.length > 0 ? 'hover:border-primary' : 'opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-accessible flex items-center justify-center shrink-0">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-on-surface">Weak Word Focus</h3>
                {weakWords.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-accessible font-bold text-[10px]">
                    {weakWords.length} Words
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                {weakWords.length > 0
                  ? 'Target words with low recognition accuracy'
                  : 'No weak words detected yet! Great accuracy.'}
              </p>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}
