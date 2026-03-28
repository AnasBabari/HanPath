import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { fetchHSKLevel } from './utils/api';
import { buildCurriculum } from './utils/curriculum';
import { loadStats, saveStats, checkNewAchievements, resetAll } from './utils/gamification';
import { playLevelUp } from './utils/sounds';
import type { Unit, UserStats } from './types';

// Components
import AchievementToast from './components/ui/AchievementToast';
import BottomNav from './components/ui/BottomNav';
import LearnPage from './pages/LearnPage';
import PracticePage from './pages/PracticePage';
import ReviewPage from './pages/ReviewPage';
import ProfilePage from './pages/ProfilePage';
import StoriesPage from './pages/StoriesPage';
import ChatPage from './pages/ChatPage';

import logo from './assets/logo.png';

/* ---- App Router ---- */

type Tab = 'home' | 'practice' | 'stories' | 'chat' | 'review' | 'profile';

export default function App() {
  const [stats, setStats] = useState<UserStats>(() => loadStats());
  const [tab, setTab] = useState<Tab>('home');
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

  /* Check achievements */
  useEffect(() => {
    const newAch = checkNewAchievements(stats);
    if (newAch.length > 0) {
      setStats(s => ({ ...s, unlockedAchievements: [...s.unlockedAchievements, ...newAch] }));
      setToast(newAch[0]);
      playLevelUp();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.completedLessons.length, stats.totalXP, stats.streak, stats.wordsLearned, stats.level]);

  const handleWordResult = useCallback((wordId: string, correct: boolean) => {
    setStats(s => {
      const prev = s.wordAccuracy[wordId] ?? { correct: 0, total: 0, lastSeen: 0 };
      return {
        ...s,
        wordAccuracy: {
          ...s.wordAccuracy,
          [wordId]: {
            correct: prev.correct + (correct ? 1 : 0),
            total: prev.total + 1,
            lastSeen: Date.now(),
          },
        },
      };
    });
  }, []);

  const handleApiUse = useCallback(() => {
    // Stat tracking removed
  }, []);

  /* Loading State */
  if (loading) {
    return (
      <div className="loading-screen">
        <img src={logo} alt="HànPath" className="loading-logo" />
        <h1>HànPath</h1>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-dim)', fontWeight: 700, fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  if (error || !units) {
    return (
      <div className="loading-screen">
        <img src={logo} alt="HànPath" className="loading-logo error" />
        <h1>HànPath</h1>
        <div className="loading-error">
          <p>{error || 'Could not load data'}</p>
          <button onClick={doFetch}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {toast && <AchievementToast id={toast} onDone={() => setToast(null)} />}

      {tab === 'home' && <LearnPage units={units} stats={stats} setStats={setStats} onWordResult={handleWordResult} onApiUse={handleApiUse} />}
      {tab === 'practice' && <PracticePage units={units} stats={stats} onBack={() => setTab('home')} onXP={(amt) => setStats(s => ({ ...s, totalXP: s.totalXP + amt }))} onWordResult={handleWordResult} onApiUse={handleApiUse} onLaunchReview={() => setTab('review')} />}
      {tab === 'stories' && <StoriesPage onBack={() => setTab('home')} />}
      {tab === 'chat' && <ChatPage onBack={() => setTab('home')} onApiUse={handleApiUse} />}
      {tab === 'review' && <ReviewPage units={units} completedLessons={stats.completedLessons} revealPinyin={stats.revealPinyin} onApiUse={handleApiUse} onBack={() => setTab('home')} />}
      {tab === 'profile' && 
        <ProfilePage 
          stats={stats} 
          onBack={() => setTab('home')} 
          onChangeReveal={(m) => setStats(s => ({ ...s, revealPinyin: m }))} 
          onReset={() => { resetAll(); setStats(loadStats()); setTab('home'); }} 
        />
      }

      {/* Show Bottom Nav on root tabs only */}
      {(tab === 'home' || tab === 'practice' || tab === 'stories' || tab === 'chat' || tab === 'review' || tab === 'profile') && (
        <BottomNav active={tab} onNav={(n) => setTab(n as Tab)} />
      )}
    </div>
  );
}
