import { useState } from 'react';
import type { Unit, Lesson } from '../types';
import { isLessonUnlocked, findLesson, nextLessonId, allLessonsFlat } from '../utils/curriculum';
import { bumpStreak } from '../utils/gamification';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import { speak } from '../utils/tts';
import Confetti from '../components/ui/Confetti';
import { useStore } from '../store/useStore';

import { saveCloudProgress } from '../utils/cloudProgress';

/* ---- Intro Screen ---- */
function LessonIntro({ 
  unit, lesson, 
  onStart, onExit 
}: {
  unit: Unit; lesson: Lesson;
  onStart: () => void; onExit: () => void;
}) {
  return (
    <div className="shell lesson-intro">
      <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
        <button className="back-btn" onClick={onExit}>✕</button>
        <h2 style={{ margin: 0, marginLeft: 12 }}>{unit.title}</h2>
      </div>

      <div className="lesson-intro-header">
        <p className="eyebrow">New Words</p>
        <h2>{lesson.title}</h2>
        <p className="subtitle">{lesson.summary}</p>
      </div>

      <div className="vocab-grid">
        {lesson.vocab.map((card, i) => (
          <div key={card.id} className="vocab-card" style={{ animationDelay: `${i * 0.06}s` }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}>
            <div className="hanzi-big">{card.hanzi}</div>
            <div className="details">
              <div className="pinyin">{card.pinyin}</div>
              <div className="meaning">{card.meaning}</div>
            </div>
            <button className="speak-btn" onClick={(e) => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
          </div>
        ))}
      </div>

      <button className="btn-primary" style={{ width: '100%' }} onClick={onStart}>Start Practice</button>
    </div>
  );
}

/* ---- Complete Screen ---- */
function LessonComplete({ lesson, onNext, onHome }: {
  lesson: Lesson; onNext: () => void; onHome: () => void;
}) {
  return (
    <div className="complete-screen">
      <Confetti />
      <div className="complete-card">
        <div className="celebrate">🎉</div>
        <h2>Lesson Complete!</h2>
        <p className="complete-subtitle">{lesson.title}</p>
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-val">{lesson.vocab.length}</div>
            <div className="stat-label">Words</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">{lesson.exercises.length}</div>
            <div className="stat-label">Exercises</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">+{lesson.vocab.length * 10 + 25}</div>
            <div className="stat-label">XP Earned</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">🔥</div>
            <div className="stat-label">Streak!</div>
          </div>
        </div>
        <div className="complete-actions">
          <button className="btn-primary" onClick={onNext}>Next Lesson</button>
          <button className="btn-ghost" onClick={onHome}>Back to Home</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Main Path Screen ---- */
export default function LearnPage() {
  const { stats, setStats, units, updateWordResult, completeLesson, setFullScreen } = useStore();
  
  const [screen, setScreen] = useState<'home' | 'intro' | 'practice' | 'complete'>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  if (!units) return null;

  const flat = allLessonsFlat(units);
  
  // Active flow helpers
  const found = activeLessonId ? findLesson(units, activeLessonId) : null;

  const openLesson = (id: string) => {
    setActiveLessonId(id);
    setScreen('practice');
    setStats(s => bumpStreak(s));
    setFullScreen(true);
  };

  const handleHome = () => {
    setScreen('home');
    setFullScreen(false);
  };

  // Views inside LearnPage:
  if (screen === 'intro' && found) {
    return (
      <LessonIntro
        unit={found.unit} lesson={found.lesson}
        onStart={() => setScreen('practice')}
        onExit={handleHome}
      />
    );
  }

  if (screen === 'complete' && found) {
    return (
      <LessonComplete
        lesson={found.lesson}
        onNext={() => {
          const nxt = nextLessonId(units, found.lesson.id);
          if (nxt) openLesson(nxt);
          else handleHome();
        }}
        onHome={handleHome}
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

          const { stats: updatedStats, cloudUserId, leaderboard, setLeaderboard } = useStore.getState();
          if (cloudUserId && updatedStats) {
            void saveCloudProgress(cloudUserId, updatedStats).catch(console.error);
            
            const userInLB = leaderboard.find(e => e.userId === cloudUserId);
            if (userInLB) {
              const newLB = leaderboard.map(entry => 
                entry.userId === cloudUserId 
                  ? { ...entry, totalXP: updatedStats.totalXP, level: updatedStats.level }
                  : entry
              ).sort((a, b) => b.totalXP - a.totalXP);
              setLeaderboard(newLB);
            }
          }

          setScreen('complete');
        }}
      />
    );
  }

  /* ---- Default Path View ---- */
  const getUnitProgress = (unit: Unit) => {
    const total = unit.lessons.length;
    const done = unit.lessons.filter(l => stats.completedLessons.includes(l.id)).length;
    return Math.round((done / total) * 100);
  };

  const staggerClasses = ['left', 'right'];

  return (
    <div className="shell">
      {/* TopAppBar */}
      <header className="topbar">
        <span className="topbar-brand">HànPath</span>
        <div className="topbar-stats">
          <div className="stat-chip streak">
            <span className="material-symbols-outlined" style={{ color: 'var(--tertiary-container)', fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            <span className="val">{stats.streak}</span>
          </div>
          <div className="stat-chip xp">
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontVariationSettings: "'FILL' 1" }}>military_tech</span>
            <span className="val">{stats.totalXP}</span>
          </div>
          <div className="stat-chip level">
            <span className="material-symbols-outlined" style={{ color: 'var(--secondary)', fontVariationSettings: "'FILL' 1" }}>hotel_class</span>
            <span className="val">{stats.level}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {units.map((unit, ui) => {
          const progress = getUnitProgress(unit);
          return (
            <div key={unit.id} style={{ marginBottom: 80 }}>
              {/* Unit Header */}
              <section className="unit-header">
                <div className="unit-header-bg">{ui + 1}</div>
                <p className="eyebrow">Unit {ui + 1}: {unit.description}</p>
                <h3>{unit.title}</h3>
                <div className="unit-progress-wrap">
                  <div className="unit-progress-bar">
                    <div className="unit-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="unit-progress-text">{progress}%</span>
                </div>
              </section>

              {/* Path Container */}
              <div className="path-container">
                <div className="path-line" />
                {unit.lessons.map((lesson, li) => {
                  const done = stats.completedLessons.includes(lesson.id);
                  const unlocked = isLessonUnlocked(lesson.id, units, stats.completedLessons);
                  const isCurrent = unlocked && !done;
                  const stagger = staggerClasses[li % staggerClasses.length];

                  return (
                    <div key={lesson.id} className={`lesson-node-wrap ${stagger}`}>
                      {isCurrent && (
                        <div className="next-step-tooltip">
                          <span className="text">Next Step!</span>
                        </div>
                      )}
                      <button
                        className={`node-btn ${done ? 'done' : isCurrent ? 'current' : 'locked'}`}
                        onClick={() => unlocked ? openLesson(lesson.id) : undefined}
                        disabled={!unlocked}
                      >
                        {done ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#fff', fontVariationSettings: "'FILL' 1" }}>check</span>
                        ) : isCurrent ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--tertiary)', fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--outline)', fontVariationSettings: "'FILL' 1" }}>lock</span>
                        )}
                      </button>
                      <div className="node-label">{lesson.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
