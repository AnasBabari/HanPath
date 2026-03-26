import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { fetchHSKLevel } from './api';
import {
  type Unit, type Lesson, type Exercise,
  buildCurriculum, allLessonsFlat, findLesson, nextLessonId, isLessonUnlocked,
} from './curriculum';
import {
  type UserStats, ACHIEVEMENTS,
  loadStats, saveStats, bumpStreak, addXP, checkNewAchievements,
  xpProgress, resetAll,
} from './gamification';
import { playCorrect, playWrong, playLevelUp } from './sounds';

/* ---- TTS helper ---- */

function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function normPinyin(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* ---- Screen routing ---- */

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; lessonId: string; phase: 'intro' | 'practice' | 'complete' }
  | { name: 'practice' }
  | { name: 'review' }
  | { name: 'profile' };

/* ---- Confetti ---- */

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: ['#ff6b35', '#4ecdc4', '#ffd166', '#ef476f', '#06d6a0', '#a78bfa'][i % 6],
      delay: Math.random() * 0.8,
      size: 6 + Math.random() * 8,
    })), []);
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, background: p.color,
          width: p.size, height: p.size,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}

/* ---- Achievement Toast ---- */

function AchievementToast({ id, onDone }: { id: string; onDone: () => void }) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  if (!ach) return null;
  return (
    <div className="achievement-toast">
      <span className="toast-icon">{ach.icon}</span>
      <div className="toast-text">{ach.title}<span>{ach.desc}</span></div>
    </div>
  );
}

/* ============================================================
   Main App
   ============================================================ */

export default function App() {
  const [stats, setStats] = useState<UserStats>(() => loadStats());
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* Persist stats */
  useEffect(() => { saveStats(stats); }, [stats]);

  /* Fetch HSK vocab on mount */
  const doFetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const words = await fetchHSKLevel(1);
      setUnits(buildCurriculum(words));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { doFetch(); }, [doFetch]);

  /* Check achievements after stats change */
  useEffect(() => {
    const newAch = checkNewAchievements(stats);
    if (newAch.length > 0) {
      setStats(s => ({ ...s, unlockedAchievements: [...s.unlockedAchievements, ...newAch] }));
      setToast(newAch[0]);
      playLevelUp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.completedLessons.length, stats.totalXP, stats.streak, stats.wordsLearned, stats.level]);

  const flat = useMemo(() => units ? allLessonsFlat(units) : [], [units]);

  const openLesson = useCallback((id: string) => {
    setScreen({ name: 'lesson', lessonId: id, phase: 'intro' });
    setStats(s => bumpStreak(s));
  }, []);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand">汉</div>
        <h1>HànPath</h1>
        <p className="subtitle">Your Chinese Learning Journey</p>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-dim)', fontWeight: 700, fontSize: 13 }}>Loading HSK vocabulary…</p>
      </div>
    );
  }

  if (error || !units) {
    return (
      <div className="loading-screen">
        <div className="brand">汉</div>
        <h1>HànPath</h1>
        <div className="loading-error">
          <p>{error || 'Could not load data'}</p>
          <button onClick={doFetch}>Try again</button>
        </div>
      </div>
    );
  }

  /* ---- Lesson screen ---- */
  if (screen.name === 'lesson') {
    const found = findLesson(units, screen.lessonId);
    if (!found) { setScreen({ name: 'home' }); return null; }

    if (screen.phase === 'intro') {
      return (
        <LessonIntro
          unit={found.unit} lesson={found.lesson}
          revealPinyin={stats.revealPinyin}
          onStart={() => setScreen({ name: 'lesson', lessonId: screen.lessonId, phase: 'practice' })}
          onExit={() => setScreen({ name: 'home' })}
        />
      );
    }

    if (screen.phase === 'complete') {
      return (
        <LessonComplete
          lesson={found.lesson}
          onNext={() => {
            const nxt = nextLessonId(units, screen.lessonId);
            if (nxt) openLesson(nxt);
            else setScreen({ name: 'home' });
          }}
          onHome={() => setScreen({ name: 'home' })}
        />
      );
    }

    return (
      <ExerciseRunner
        lesson={found.lesson}
        onExit={() => setScreen({ name: 'home' })}
        onComplete={(correct, total) => {
          // Mark lesson done
          setStats(s => {
            let ns = { ...s };
            if (!ns.completedLessons.includes(screen.lessonId)) {
              ns.completedLessons = [...ns.completedLessons, screen.lessonId];
              ns.lessonsCompletedToday++;
              ns.wordsLearned = new Set(
                flat.filter(l => ns.completedLessons.includes(l.id)).flatMap(l => l.vocab.map(v => v.id))
              ).size;
            }
            ns.totalCorrect += correct;
            ns.totalAttempted += total;
            // XP: 10 per correct + 25 bonus
            ns = addXP(ns, correct * 10 + 25);
            return bumpStreak(ns);
          });
          setScreen({ name: 'lesson', lessonId: screen.lessonId, phase: 'complete' });
        }}
      />
    );
  }

  /* ---- Practice screen ---- */
  if (screen.name === 'practice') {
    return (
      <PracticeScreen
        units={units} completedLessons={stats.completedLessons}
        onBack={() => setScreen({ name: 'home' })}
        onXP={(amt) => setStats(s => addXP(s, amt))}
      />
    );
  }

  /* ---- Review screen ---- */
  if (screen.name === 'review') {
    return (
      <ReviewScreen
        units={units} completedLessons={stats.completedLessons}
        revealPinyin={stats.revealPinyin}
        onBack={() => setScreen({ name: 'home' })}
      />
    );
  }

  /* ---- Profile screen ---- */
  if (screen.name === 'profile') {
    return (
      <ProfileScreen
        stats={stats}
        onBack={() => setScreen({ name: 'home' })}
        onChangeReveal={(m) => setStats(s => ({ ...s, revealPinyin: m }))}
        onReset={() => { resetAll(); setStats(loadStats()); setScreen({ name: 'home' }); }}
      />
    );
  }

  /* ---- Home screen ---- */
  const xp = xpProgress(stats.totalXP);

  return (
    <div className="shell">
      {toast && <AchievementToast id={toast} onDone={() => setToast(null)} />}

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

      {/* Learning path */}
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

      <BottomNav active="home" onNav={(n) => setScreen({ name: n } as Screen)} />
    </div>
  );
}

/* ============================================================
   Bottom Navigation
   ============================================================ */

function BottomNav({ active, onNav }: { active: string; onNav: (name: string) => void }) {
  const items = [
    { name: 'home', icon: '🏠', label: 'Learn' },
    { name: 'practice', icon: '💪', label: 'Practice' },
    { name: 'review', icon: '🔄', label: 'Review' },
    { name: 'profile', icon: '👤', label: 'Profile' },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(i => (
        <button key={i.name} className={`nav-btn ${active === i.name ? 'active' : ''}`} onClick={() => onNav(i.name)}>
          <span className="nav-icon">{i.icon}</span>
          {i.label}
        </button>
      ))}
    </nav>
  );
}

/* ============================================================
   Lesson Intro — shows vocab cards before practice
   ============================================================ */

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

/* ============================================================
   Exercise Runner — walks through all exercises
   ============================================================ */

function ExerciseRunner({ lesson, onExit, onComplete }: {
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

/* ============================================================
   Exercise Card — renders a single exercise
   ============================================================ */

function ExerciseCard({ exercise: ex, locked, shake, onCorrect, onWrong }: {
  exercise: Exercise; locked: boolean; shake: boolean;
  onCorrect: () => void; onWrong: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [bankPick, setBankPick] = useState<number[]>([]);
  const played = useRef(false);

  // Auto-play audio for listening exercises
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
        <span className="type-icon">{typeLabel.split(' ')[0]}</span>
        {typeLabel.split(' ').slice(1).join(' ')}
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
            {ex.hint && <p className="prompt-hint">{ex.hint}</p>}
          </>
        )}
      </div>

      {/* MCQ options */}
      {isMCQ && (
        <div className="option-grid">
          {ex.options.map((opt, i) => (
            <button
              key={opt}
              className={`option-btn ${choice === i ? 'selected' : ''} ${locked && opt === ex.answer ? 'correct' : ''} ${locked && choice === i && opt !== ex.answer ? 'wrong' : ''}`}
              disabled={locked}
              onClick={() => setChoice(i)}
            >
              {isHanziOptions ? <span className="hanzi-option">{opt}</span> : opt}
            </button>
          ))}
        </div>
      )}

      {/* Pinyin input */}
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

      {/* Compose */}
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

/* ============================================================
   Lesson Complete
   ============================================================ */

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

/* ============================================================
   Practice Screen — random exercises from completed words
   ============================================================ */

function PracticeScreen({ units, completedLessons, onBack, onXP }: {
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
        <BottomNav active="practice" onNav={(n) => { if (n === 'home') onBack(); }} />
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
        <BottomNav active="practice" onNav={(n) => { if (n === 'home') onBack(); }} />
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

/* ============================================================
   Review Screen — flashcards for completed vocab
   ============================================================ */

function ReviewScreen({ units, completedLessons, revealPinyin, onBack }: {
  units: Unit[]; completedLessons: string[]; revealPinyin: 'always' | 'peek';
  onBack: () => void;
}) {
  const cards = useMemo(() => {
    const done = new Set(completedLessons);
    return allLessonsFlat(units).filter(l => done.has(l.id)).flatMap(l => l.vocab);
  }, [units, completedLessons]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Review</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">🔄</div>
          <p>Complete a lesson first to build your review deck!</p>
        </div>
        <BottomNav active="review" onNav={(n) => { if (n === 'home') onBack(); }} />
      </div>
    );
  }

  const card = cards[idx % cards.length];

  return (
    <div className="shell">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Review · {cards.length} cards</h2>
      </div>

      <div className="flashcard" onClick={() => setFlipped(f => !f)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}>
        {!flipped ? (
          <>
            <p className="fc-label">汉字</p>
            <p className="fc-hanzi">{card.hanzi}</p>
            {revealPinyin === 'always' && <p className="fc-pinyin">{card.pinyin}</p>}
            <p className="fc-tap">Tap to reveal meaning</p>
          </>
        ) : (
          <>
            <p className="fc-label">Meaning</p>
            <p className="fc-meaning">{card.meaning}</p>
            <p className="fc-pinyin">{card.pinyin}</p>
            <button className="speak-btn" style={{ marginTop: 10 }} onClick={e => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
          </>
        )}
      </div>

      <div className="review-controls">
        <button className="btn-ghost" onClick={() => { setFlipped(false); setIdx(i => (i - 1 + cards.length) % cards.length); }}>← Prev</button>
        <button className="btn-primary" onClick={() => { setFlipped(false); setIdx(i => (i + 1) % cards.length); }}>Next →</button>
      </div>

      <BottomNav active="review" onNav={(n) => { if (n === 'home') onBack(); }} />
    </div>
  );
}

/* ============================================================
   Profile Screen — stats, achievements, settings
   ============================================================ */

function ProfileScreen({ stats, onBack, onChangeReveal, onReset }: {
  stats: UserStats;
  onBack: () => void;
  onChangeReveal: (m: 'always' | 'peek') => void;
  onReset: () => void;
}) {
  const acc = stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0;

  return (
    <div className="shell">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Profile</h2>
      </div>

      <div className="profile-section">
        <h3>📊 Your Stats</h3>
        <div className="profile-stats-grid">
          <div className="profile-stat"><div className="ps-val">{stats.totalXP}</div><div className="ps-label">Total XP</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.level}</div><div className="ps-label">Level</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.streak}🔥</div><div className="ps-label">Streak</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.longestStreak}</div><div className="ps-label">Best Streak</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.wordsLearned}</div><div className="ps-label">Words</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.completedLessons.length}</div><div className="ps-label">Lessons</div></div>
          <div className="profile-stat"><div className="ps-val">{acc}%</div><div className="ps-label">Accuracy</div></div>
          <div className="profile-stat"><div className="ps-val">{stats.totalCorrect}</div><div className="ps-label">Correct</div></div>
        </div>
      </div>

      <div className="profile-section">
        <h3>🏆 Achievements</h3>
        <div className="achievements-grid">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id} className={`ach-card ${stats.unlockedAchievements.includes(a.id) ? 'unlocked' : ''}`}>
              <div className="ach-icon">{a.icon}</div>
              <div className="ach-title">{a.title}</div>
              <div className="ach-desc">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile-section">
        <h3>⚙️ Settings</h3>
        <div className="setting-row">
          <div className="setting-label">Pinyin Display<span>Show pinyin under characters</span></div>
          <div className="toggle-btns">
            <button className={stats.revealPinyin === 'always' ? 'active' : ''} onClick={() => onChangeReveal('always')}>Always</button>
            <button className={stats.revealPinyin === 'peek' ? 'active' : ''} onClick={() => onChangeReveal('peek')}>Tap</button>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3>⚠️ Danger Zone</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700, marginBottom: 8 }}>This will erase all progress and cached vocabulary.</p>
        <button className="btn-danger" onClick={() => confirm('Reset all progress? This cannot be undone.') && onReset()}>Reset Everything</button>
      </div>

      <BottomNav active="profile" onNav={(n) => { if (n === 'home') onBack(); }} />
    </div>
  );
}
