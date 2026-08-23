import { useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { checkNewAchievements } from './utils/gamification';
import { playLevelUp } from './utils/sounds';
import { useStore } from './store/useStore';

// Components
import AchievementToast from './components/ui/AchievementToast';
import BottomNav from './components/ui/BottomNav';
import SidebarNav from './components/ui/SidebarNav';
import AppHeader from './components/ui/AppHeader';

// Lazy-loaded routes for optimal code-splitting and small initial bundle
const LearnPage = lazy(() => import('./pages/LearnPage'));
const PracticePage = lazy(() => import('./pages/PracticePage'));
const StoriesPage = lazy(() => import('./pages/StoriesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LicensesPage = lazy(() => import('./pages/LicensesPage'));

import logo from './assets/logo.png';

function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-12 min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function AppContent() {
  const {
    units,
    setUnits,
    hskLevel,
    loading,
    setLoading,
    error,
    setError,
    toast,
    setToast,
    isFullScreen,
    stats,
    unlockAchievement,
  } = useStore();

  const location = useLocation();

  /* Fetch HSK vocab & sentences whenever target level changes */
  const loadCurriculum = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ fetchHSKLevel, fetchSentencesForLevel }, { buildCurriculum }] = await Promise.all([
        import('./utils/api'),
        import('./utils/curriculum'),
      ]);
      const [words, sentences] = await Promise.all([
        fetchHSKLevel(hskLevel),
        fetchSentencesForLevel(hskLevel),
      ]);
      setUnits(buildCurriculum(words, sentences));
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load HSK ${hskLevel} vocabulary`);
    } finally {
      setLoading(false);
    }
  }, [hskLevel, setLoading, setError, setUnits]);

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  /* Check Achievements */
  useEffect(() => {
    const newAch = checkNewAchievements(stats);
    if (newAch.length > 0) {
      newAch.forEach((id) => unlockAchievement(id));
      setToast(newAch[0]);
      playLevelUp();
    }
  }, [stats, setToast, unlockAchievement]);

  /* Loading State */
  if (loading && !units) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center space-y-4">
        <img src={logo} alt="HànPath" className="w-16 h-16 object-contain rounded-2xl animate-pulse" />
        <h1 className="text-3xl font-bold font-display text-primary">HànPath</h1>
        <div className="w-8 h-8 border-3 border-primary-light border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Loading HSK {hskLevel} Curriculum...
        </p>
      </div>
    );
  }

  if (error || !units) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center space-y-4">
        <img src={logo} alt="HànPath" className="w-16 h-16 object-contain rounded-2xl grayscale" />
        <h1 className="text-2xl font-bold font-display text-red-accessible">Curriculum Error</h1>
        <p className="text-sm text-on-surface-variant max-w-sm">
          {error || 'Failed to load HSK curriculum.'}
        </p>
        <button
          type="button"
          onClick={() => void loadCurriculum()}
          className="touch-target px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    );
  }

  const isFocusedExerciseOrStory = isFullScreen;
  const isExcludedChromePage = location.pathname === '/licenses';
  const showChrome = !isFocusedExerciseOrStory && !isExcludedChromePage;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface text-on-surface">
      {showChrome && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-xl focus:shadow-lg focus:font-bold text-sm"
        >
          Skip to main content
        </a>
      )}

      {toast && <AchievementToast id={toast} onDone={() => setToast(null)} />}

      {/* Desktop Sidebar Navigation */}
      {showChrome && <SidebarNav />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {showChrome && <AppHeader />}

        <main id="main-content" className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<LearnPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/stories" element={<StoriesPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/licenses" element={<LicensesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation */}
        {showChrome && <BottomNav />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <SpeedInsights />
    </BrowserRouter>
  );
}
