import { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { fetchHSKLevel } from './utils/api';
import { buildCurriculum } from './utils/curriculum';
import { checkNewAchievements, saveStats } from './utils/gamification';
import { playLevelUp } from './utils/sounds';
import { initCloudProgress, loadCloudProgress, saveCloudProgress } from './utils/cloudProgress';
import { useStore } from './store/useStore';

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

/* ---- App Wrapper for Navigation ---- */

function AppContent() {
  const { 
    stats, setStats, 
    cloudUserId, setCloudUserId, 
    units, setUnits, 
    hskLevel,
    loading, setLoading, 
    error, setError, 
    toast, setToast,
    isFullScreen
  } = useStore();

  const location = useLocation();

  /* Persist stats to localStorage (handled by Zustand persist, but we can keep the utility sync if needed) */
  useEffect(() => { saveStats(stats); }, [stats]);

  /* Hydrate cloud profile and migrate local stats on first run */
  useEffect(() => {
    let active = true;

    const bootstrapCloud = async () => {
      try {
        const userId = await initCloudProgress();
        if (!active || !userId) return;

        setCloudUserId(userId);

        const cloudStats = await loadCloudProgress(userId);
        if (!active) return;

        if (cloudStats) {
          setStats(cloudStats);
          saveStats(cloudStats);
          return;
        }

        await saveCloudProgress(userId, stats);
      } catch (e) {
        console.error('Cloud sync init failed:', e);
      }
    };

    void bootstrapCloud();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Debounced cloud save */
  useEffect(() => {
    if (!cloudUserId) return;

    const timer = window.setTimeout(() => {
      void saveCloudProgress(cloudUserId, stats).catch((e) => {
        console.error('Cloud save failed:', e);
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [cloudUserId, stats]);

  /* Fetch HSK vocab on mount or level change */
  const doFetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const words = await fetchHSKLevel(hskLevel);
      setUnits(buildCurriculum(words));
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load HSK ${hskLevel} vocabulary`);
    } finally {
      setLoading(false);
    }
  }, [hskLevel, setLoading, setError, setUnits]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

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

  /* Loading State */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo-glow" />
        <img src={logo} alt="HànPath" className="loading-logo" />
        <h1>HànPath</h1>
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-dim)', fontWeight: 800, fontSize: 14 }}>Connecting to curriculum...</p>
      </div>
    );
  }

  if (error || !units) {
    return (
      <div className="loading-screen">
        <div className="loading-error-card">
          <img src={logo} alt="HànPath" className="loading-logo error" />
          <h1>Oops!</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24, fontWeight: 700 }}>
            {error || 'We couldn\'t load the curriculum. Please check your internet connection.'}
          </p>
          <button className="btn-primary" onClick={() => void doFetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* Removed Aegis test error */

  const showNav = ['/', '/practice', '/stories', '/chat', '/review', '/profile'].includes(location.pathname) && !isFullScreen;

  return (
    <div className="app-root">
      {toast && <AchievementToast id={toast} onDone={() => setToast(null)} />}

      <Routes>
        <Route path="/" element={<LearnPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showNav && (
        <BottomNav />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

