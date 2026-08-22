import { useState, useEffect } from 'react';
import { Play, CheckCircle2, Lock, Sparkles, Trophy, ArrowRight } from 'lucide-react';
import type { Unit, Lesson } from '../types';
import { isLessonUnlocked, findLesson, allLessonsFlat } from '../utils/curriculum';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import Confetti from '../components/ui/Confetti';
import { useStore } from '../store/useStore';

/* ---- Intro Modal ---- */
function LessonIntro({
  unit,
  lesson,
  onStart,
  onExit,
}: {
  unit: Unit;
  lesson: Lesson;
  onStart: () => void;
  onExit: () => void;
}) {
  const isCheckpoint = lesson.id.includes('checkpoint');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-primary-light text-primary flex items-center justify-center shadow-inner mx-auto">
        {isCheckpoint ? <Trophy className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          {unit.title} • {lesson.title}
        </span>
        <h2 className="text-3xl font-bold font-display text-on-surface">{lesson.title}</h2>
        <p className="text-on-surface-variant text-sm max-w-md mx-auto">
          {isCheckpoint
            ? 'Review and master all vocabulary words learned in this unit through interactive exercises.'
            : `Learn and practice ${lesson.vocab.length} essential new vocabulary words.`}
        </p>
      </div>

      {/* Vocab preview chips */}
      {!isCheckpoint && lesson.vocab.length > 0 && (
        <div className="bg-surface-card border border-border rounded-2xl p-4 w-full shadow-xs">
          <div className="text-xs font-bold text-on-surface-variant mb-3 uppercase tracking-wider">
            Lesson Vocabulary
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {lesson.vocab.slice(0, 8).map((v) => (
              <span
                key={v.id}
                className="px-3 py-1 bg-surface-container rounded-xl text-xs font-bold font-chinese text-on-surface"
              >
                {v.hanzi} ({v.pinyin})
              </span>
            ))}
            {lesson.vocab.length > 8 && (
              <span className="px-2 py-1 text-xs font-bold text-outline">+{lesson.vocab.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
        <button
          type="button"
          onClick={onExit}
          className="touch-target flex-1 px-6 py-3.5 rounded-2xl border border-border font-bold text-sm text-on-surface-variant hover:bg-surface-container"
        >
          Back to Path
        </button>
        <button
          type="button"
          onClick={onStart}
          className="touch-target flex-1 px-6 py-3.5 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
        >
          <span>Start Lesson</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ---- Completion Celebration Screen ---- */
function LessonCompleteScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full text-center space-y-6">
      <Confetti />
      <div className="w-24 h-24 rounded-full bg-primary-light text-primary flex items-center justify-center shadow-lg animate-bounce mx-auto">
        <Trophy className="w-12 h-12" />
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold font-display text-primary">Lesson Completed!</h2>
        <p className="text-on-surface-variant text-sm">
          Fantastic effort! Your progress and spaced repetition cards have been updated.
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="touch-target w-full px-6 py-4 rounded-2xl bg-primary text-on-primary font-bold text-base shadow-lg hover:bg-primary-dark transition-all"
      >
        Continue Learning
      </button>
    </div>
  );
}

export default function LearnPage() {
  const { units, stats, hskLevel, completeLesson, updateWordResult, setFullScreen } = useStore();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'path' | 'intro' | 'practice' | 'complete'>('path');

  useEffect(() => {
    if (screen !== 'path') {
      setFullScreen(true);
      window.scrollTo(0, 0);
    } else {
      setFullScreen(false);
    }
    return () => {
      setFullScreen(false);
    };
  }, [screen, setFullScreen]);

  if (!units || units.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-on-surface-variant">
        No curriculum units available.
      </div>
    );
  }

  const flat = allLessonsFlat(units);
  const completedSet = new Set(stats.completedLessons || []);
  const found = activeLessonId ? findLesson(units, activeLessonId) : null;

  const handleStartIntro = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setScreen('intro');
  };

  const handleHome = () => {
    setScreen('path');
    setActiveLessonId(null);
    setFullScreen(false);
    window.scrollTo(0, 0);
  };

  // Find next uncompleted lesson for the quick resume banner
  const nextLesson = flat.find((l) => !completedSet.has(l.id)) || flat[0];
  const nextUnit = units.find((u) => u.lessons.some((l) => l.id === nextLesson.id));

  if (screen === 'intro' && found) {
    return (
      <LessonIntro
        unit={found.unit}
        lesson={found.lesson}
        onStart={() => setScreen('practice')}
        onExit={handleHome}
      />
    );
  }

  if (screen === 'practice' && found) {
    return (
      <ExerciseRunner
        lesson={found.lesson}
        onWordResult={updateWordResult}
        onExit={handleHome}
        onComplete={(correct, total) => {
          completeLesson(found.lesson.id, correct, total, flat);
          setScreen('complete');
        }}
      />
    );
  }

  if (screen === 'complete') {
    return <LessonCompleteScreen onContinue={handleHome} />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-24">
      {/* Resume Card */}
      {nextLesson && nextUnit && (
        <section className="bg-surface-card border-b border-border px-6 py-6 shadow-xs">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Up Next • HSK {hskLevel}
              </span>
              <h2 className="text-xl font-bold font-display text-on-surface">
                {nextUnit.title}: {nextLesson.title}
              </h2>
              <p className="text-xs text-on-surface-variant">{nextLesson.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => handleStartIntro(nextLesson.id)}
              className="touch-target px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all flex items-center gap-2"
              aria-label={`Start next lesson: ${nextLesson.title}`}
            >
              <Play className="w-4 h-4 fill-on-primary" />
              <span>Start Learning</span>
            </button>
          </div>
        </section>
      )}

      {/* Units & Lessons Timeline */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10 w-full">
        {units.map((unit) => {
          const totalInUnit = unit.lessons.length;
          const completedInUnit = unit.lessons.filter((l) => completedSet.has(l.id)).length;
          const unitProgressPercent = Math.round((completedInUnit / totalInUnit) * 100);

          return (
            <section
              key={unit.id}
              className="bg-surface-card rounded-3xl p-6 border border-border shadow-xs space-y-6"
            >
              {/* Unit Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <h3 className="text-xl font-bold font-display text-primary">{unit.title}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{unit.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-surface-container rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${unitProgressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant">
                    {completedInUnit}/{totalInUnit}
                  </span>
                </div>
              </div>

              {/* Lessons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unit.lessons.map((lesson) => {
                  const isDone = completedSet.has(lesson.id);
                  const isUnlocked = isLessonUnlocked(lesson.id, stats.completedLessons || [], units);
                  const isCheckpoint = lesson.id.includes('checkpoint');

                  return (
                    <button
                      type="button"
                      key={lesson.id}
                      disabled={!isUnlocked}
                      onClick={() => handleStartIntro(lesson.id)}
                      className={`touch-target p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-primary-light/50 border-primary/30 text-on-surface hover:bg-primary-light'
                          : isUnlocked
                          ? 'bg-surface-card border-border hover:border-primary hover:shadow-sm text-on-surface'
                          : 'bg-surface-container/50 border-transparent text-outline opacity-60 cursor-not-allowed'
                      }`}
                      aria-label={`${lesson.title}: ${isDone ? 'Completed' : isUnlocked ? 'Available' : 'Locked'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                            isDone
                              ? 'bg-primary text-on-primary'
                              : isUnlocked
                              ? 'bg-surface-container text-primary font-display'
                              : 'bg-surface-container text-outline'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : isUnlocked ? (
                            isCheckpoint ? (
                              <Trophy className="w-5 h-5" />
                            ) : (
                              lesson.index + 1
                            )
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-bold">{lesson.title}</div>
                          <div className="text-xs text-on-surface-variant line-clamp-1">
                            {isCheckpoint ? 'Checkpoint Test' : `${lesson.vocab.length} Words`}
                          </div>
                        </div>
                      </div>

                      {isUnlocked && !isDone && (
                        <div className="text-primary font-bold text-xs bg-primary-light px-2 py-1 rounded-lg">
                          Start
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
