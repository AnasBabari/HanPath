import { useState, useMemo } from 'react';
import type { Unit, Lesson, UserStats, Quest } from '../types';
import { isLessonUnlocked, findLesson, nextLessonId, allLessonsFlat } from '../utils/curriculum';
import { addXP, bumpStreak, xpProgress } from '../utils/gamification';
import { getDailyQuests } from '../utils/quests';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import { speak } from '../utils/tts';
import Confetti from '../components/ui/Confetti';

/* ---- Intro Screen ---- */
function LessonIntro({ unit, lesson, revealPinyin, onStart, onExit }: {
  unit: Unit; lesson: Lesson; revealPinyin: 'always' | 'peek';
  onStart: () => void; onExit: () => void;
}) {
  const [peeks, setPeeks] = useState<Set<string>>(new Set());
  return (
    <div className="shell lesson-intro">
      <div className="sub-header">
        <button className="back-btn" onClick={onExit}>✕</button>
        <h2>{unit.title}</h2>
      </div>

      <div className="lesson-intro-header">
        <p className="eyebrow">New Words</p>
        <h2>{lesson.title}</h2>
        <p className="subtitle">{lesson.summary}</p>
      </div>

      <div className="vocab-grid">
        {lesson.vocab.map((card, i) => (
          <div key={card.id} className="vocab-card" style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => {
              if (revealPinyin === 'peek') setPeeks(p => { const n = new Set(p); n.add(card.id); return n; });
            }}>
            <div className="hanzi-big">{card.hanzi}</div>
            <div className="details">
              {(revealPinyin === 'always' || peeks.has(card.id)) ? (
                <>
                  <div className="pinyin">{card.pinyin}</div>
                  <div className="meaning">{card.meaning}</div>
                </>
              ) : (
                <div className="meaning" style={{ color: 'var(--text-dim)' }}>Tap to reveal</div>
              )}
            </div>
            <button className="speak-btn" onClick={(e) => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={onStart}>Start Practice →</button>
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
          <button className="btn-primary" onClick={onNext}>Next Lesson →</button>
          <button className="btn-ghost" onClick={onHome}>Back to Home</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Main Path Screen ---- */
export default function LearnPage({ 
  units, stats, setStats, onNav 
}: { 
  units: Unit[]; stats: UserStats; setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onNav: (tab: string) => void;
}) {
  const [screen, setScreen] = useState<'home' | 'intro' | 'practice' | 'complete'>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const flat = useMemo(() => allLessonsFlat(units), [units]);
  
  // Active flow helpers
  const found = activeLessonId ? findLesson(units, activeLessonId) : null;

  const openLesson = (id: string) => {
    setActiveLessonId(id);
    setScreen('intro');
    setStats(s => bumpStreak(s));
  };

  // Views inside LearnPage:
  if (screen === 'intro' && found) {
    return (
      <LessonIntro
        unit={found.unit} lesson={found.lesson}
        revealPinyin={stats.revealPinyin}
        onStart={() => setScreen('practice')}
        onExit={() => setScreen('home')}
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
          else setScreen('home');
        }}
        onHome={() => setScreen('home')}
      />
    );
  }

  if (screen === 'practice' && found) {
    return (
      <ExerciseRunner
        lesson={found.lesson}
        onExit={() => setScreen('home')}
        onComplete={(correct, total) => {
          setStats(s => {
            let ns = { ...s };
            if (!ns.completedLessons.includes(found.lesson.id)) {
              ns.completedLessons = [...ns.completedLessons, found.lesson.id];
              ns.lessonsCompletedToday++;
              ns.wordsLearned = new Set(
                flat.filter(l => ns.completedLessons.includes(l.id)).flatMap(l => l.vocab.map(v => v.id))
              ).size;
            }
            ns.totalCorrect += correct;
            ns.totalAttempted += total;
            
            // Track quests progress
            if (correct === total) ns.perfectLessonsToday++;
            
            // Calculate XP
            const xpEarned = correct * 10 + 25;
            ns.xpToday += xpEarned;
            ns = addXP(ns, xpEarned);

            return bumpStreak(ns);
          });
          setScreen('complete');
        }}
      />
    );
  }

  /* ---- Default Path View ---- */
  const xp = xpProgress(stats.totalXP);
  
  // Daily Quests
  const dStr = new Date().toISOString().split('T')[0];
  const quests = getDailyQuests(dStr);

  return (
    <div className="shell" style={{ paddingBottom: 80 }}>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-brand">汉 HànPath</span>
        </div>
        <div className="topbar-stats">
          <div className="stat-chip">
            <span className="icon streak-fire">🔥</span>
            <span className="val">{stats.streak}</span>
          </div>
          <div className="stat-chip">
            <span className="icon">⭐</span>
            <span className="val">{stats.totalXP}</span>
          </div>
        </div>
      </div>

      <div className="xp-bar-wrap">
        <div className="xp-bar-info">
          <div className="xp-level-badge">
            <div className="ring">{stats.level}</div>
            Level {stats.level}
          </div>
          <span className="xp-text">{xp.current} / {xp.needed} XP</span>
        </div>
        <div className="xp-bar">
          <div className="xp-bar-fill" style={{ width: `${xp.percent}%` }} />
        </div>
      </div>

      {/* Quests Section */}
      <div className="path-section" style={{ borderTop: 'none', paddingTop: 0 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16, color: 'var(--text-main)' }}>📋 Daily Quests</h3>
        {quests.map(q => {
          const isDone = q.check(stats);
          return (
            <div key={q.id} style={{
              background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 12, marginBottom: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: isDone ? 0.6 : 1
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{q.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>+{q.reward} XP</p>
              </div>
              <div style={{
                background: isDone ? 'var(--correct)' : 'var(--bg-shell)',
                color: isDone ? '#fff' : 'var(--text-dim)',
                width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14
              }}>
                {isDone ? '✓' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Learning Path Nodes */}
      {units.map(unit => (
        <div key={unit.id} className="path-section">
          <div className="unit-header">
            <div className="unit-icon">{unit.index + 1}</div>
            <div>
              <h3>{unit.title}</h3>
              <p className="unit-desc">{unit.description}</p>
            </div>
          </div>
          <div className="lesson-path">
            {unit.lessons.map((lesson, li) => {
              const done = stats.completedLessons.includes(lesson.id);
              const unlocked = isLessonUnlocked(lesson.id, units, stats.completedLessons);
              const isCurrent = unlocked && !done;
              return (
                <div key={lesson.id}>
                  {li > 0 && <div className={`path-connector ${done ? 'done' : ''}`} />}
                  <button
                    className={`lesson-node ${done ? 'done' : isCurrent ? 'current' : 'locked'}`}
                    onClick={() => unlocked ? openLesson(lesson.id) : undefined}
                    disabled={!unlocked}
                    title={lesson.summary}
                  >
                    {done ? '✓' : li + 1}
                  </button>
                  <div className="lesson-node-label">{lesson.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

    </div>
  );
}
