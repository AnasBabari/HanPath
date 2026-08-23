import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import {
  User,
  Flame,
  Star,
  BookOpen,
  Trophy,
  Layers,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Eye,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { ACHIEVEMENTS } from '../data/achievements';
import { validateProgressSnapshotV4 } from '../utils/progressSchema';
import type { ProgressSnapshotV4 } from '../types';

interface CandidateBackup {
  jsonStr: string;
  snapshot: ProgressSnapshotV4;
}

export default function ProfilePage() {
  const {
    stats,
    hskLevel,
    setHSKLevel,
    exportProgressJSON,
    importProgressJSON,
    resetLocalProgress,
    setRevealPinyin,
    setDailyGoalMinutes,
    storageStatus,
    storageError,
    setToast,
  } = useStore();

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [candidateBackup, setCandidateBackup] = useState<CandidateBackup | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement>(null);
  const resetInputRef = useRef<HTMLInputElement>(null);
  const restoreConfirmBtnRef = useRef<HTMLButtonElement>(null);
  const resetModalRef = useRef<HTMLDivElement>(null);
  const restoreModalRef = useRef<HTMLDivElement>(null);

  const unlockedCount = ACHIEVEMENTS.filter(
    (a) => (stats.unlockedAchievements || []).includes(a.id) || a.check(stats)
  ).length;

  // Accessible Focus Management & Key Handlers for Modals
  const handleModalKeyDown = useCallback(
    (e: KeyboardEvent, modalRef: React.RefObject<HTMLDivElement | null>, closeFn: () => void) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFn();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (showResetModal) {
      resetInputRef.current?.focus();
      const onKeyDown = (e: KeyboardEvent) =>
        handleModalKeyDown(e, resetModalRef, () => {
          setShowResetModal(false);
          resetTriggerRef.current?.focus();
        });
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [showResetModal, handleModalKeyDown]);

  useEffect(() => {
    if (candidateBackup) {
      restoreConfirmBtnRef.current?.focus();
      const onKeyDown = (e: KeyboardEvent) =>
        handleModalKeyDown(e, restoreModalRef, () => {
          setCandidateBackup(null);
          restoreTriggerRef.current?.focus();
        });
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [candidateBackup, handleModalKeyDown]);

  const handleExport = () => {
    const json = exportProgressJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanpath-progress-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast('Progress backup downloaded successfully!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size guard (reject > 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setToast('Backup file exceeds maximum allowed size (2 MB).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      try {
        const parsed = JSON.parse(content);
        const val = validateProgressSnapshotV4(parsed);
        if (val.success && val.data) {
          // Open confirmation modal with candidate stats
          setCandidateBackup({ jsonStr: content, snapshot: val.data });
        } else {
          setToast(val.error || 'Invalid backup file format.');
        }
      } catch {
        setToast('Failed to parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = () => {
    if (!candidateBackup) return;
    const res = importProgressJSON(candidateBackup.jsonStr);
    setCandidateBackup(null);
    if (res.success) {
      setToast('Progress restored successfully!');
    } else {
      setToast(res.error || 'Failed to restore backup.');
    }
    restoreTriggerRef.current?.focus();
  };

  const handleResetProgress = () => {
    if (resetConfirmText.trim().toLowerCase() !== 'reset') return;
    resetLocalProgress();
    setShowResetModal(false);
    setResetConfirmText('');
    setToast('Progress has been reset to starting state.');
    resetTriggerRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-24">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 w-full">
        {/* Profile Card & Avatar */}
        <section className="bg-surface-card rounded-3xl p-6 sm:p-8 border border-border shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-primary-light text-primary flex items-center justify-center text-4xl shadow-inner">
              <User className="w-12 h-12" />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
              HSK {hskLevel}
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold font-display text-on-surface">
                  Profile
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Level {stats.level} • {stats.wordsLearned} Words Mastered
                </p>
              </div>

              {/* Local Storage Health Badge */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                {storageStatus === 'healthy' ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-accessible border border-green-200">
                    <HardDrive className="w-4 h-4" />
                    <span>Local Storage Active</span>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-accessible border border-red-200"
                    title={storageError || undefined}
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Storage Error (Not Saved)</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your learning progress, flashcard SRS intervals, daily streak, and unlocked achievements are automatically saved directly to this browser and device.
            </p>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-card p-5 rounded-3xl border border-border text-center space-y-1 shadow-xs">
            <Flame className="w-6 h-6 text-gold-badge fill-gold-badge mx-auto" />
            <div className="text-2xl font-bold font-display text-on-surface">{stats.streak}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Day Streak</div>
          </div>

          <div className="bg-surface-card p-5 rounded-3xl border border-border text-center space-y-1 shadow-xs">
            <Star className="w-6 h-6 text-primary fill-primary mx-auto" />
            <div className="text-2xl font-bold font-display text-on-surface">{stats.totalXP}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Total XP</div>
          </div>

          <div className="bg-surface-card p-5 rounded-3xl border border-border text-center space-y-1 shadow-xs">
            <BookOpen className="w-6 h-6 text-primary mx-auto" />
            <div className="text-2xl font-bold font-display text-on-surface">
              {(stats.completedLessons || []).length}
            </div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Lessons Done</div>
          </div>

          <div className="bg-surface-card p-5 rounded-3xl border border-border text-center space-y-1 shadow-xs">
            <Layers className="w-6 h-6 text-primary mx-auto" />
            <div className="text-2xl font-bold font-display text-on-surface">{stats.wordsLearned}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">SRS Words</div>
          </div>
        </section>

        {/* Preferences & Settings */}
        <section className="bg-surface-card rounded-3xl p-6 border border-border shadow-xs space-y-6">
          <h2 className="text-lg font-bold font-display text-primary">Learning Preferences</h2>

          <div className="space-y-4">
            {/* Target HSK Level */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-bold text-on-surface">Target Curriculum Level</div>
                  <div className="text-xs text-on-surface-variant">Switch between HSK 3.0-aligned level 1 and 2 content</div>
                </div>
              </div>
              <div className="flex gap-1 bg-surface-container p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setHSKLevel(1)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    hskLevel === 1 ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
                  }`}
                >
                  HSK 1
                </button>
                <button
                  type="button"
                  onClick={() => setHSKLevel(2)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    hskLevel === 2 ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
                  }`}
                >
                  HSK 2
                </button>
              </div>
            </div>

            {/* Pinyin Visibility */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-bold text-on-surface">Pinyin Subtitle Display</div>
                  <div className="text-xs text-on-surface-variant">Always show or tap-to-peek pronunciation</div>
                </div>
              </div>
              <select
                value={stats.revealPinyin}
                onChange={(e) => setRevealPinyin(e.target.value as 'always' | 'peek')}
                className="bg-surface-container border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface"
                aria-label="Pinyin display preference"
              >
                <option value="always">Always Visible</option>
                <option value="peek">Tap to Reveal (Peek)</option>
              </select>
            </div>

            {/* Daily Goal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-bold text-on-surface">Daily Study Goal</div>
                  <div className="text-xs text-on-surface-variant">Target practice time per day</div>
                </div>
              </div>
              <select
                value={stats.dailyGoalMinutes}
                onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                className="bg-surface-container border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface"
                aria-label="Daily study goal minutes"
              >
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
            </div>
          </div>
        </section>

        {/* Data Rights & Progress Management */}
        <section className="bg-surface-card rounded-3xl p-6 border border-border shadow-xs space-y-4">
          <h2 className="text-lg font-bold font-display text-primary">Data Management & Backup</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="touch-target p-4 rounded-2xl border border-border hover:bg-surface-container transition-all flex items-center gap-3 text-left"
            >
              <Download className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-bold text-on-surface">Export Progress (JSON)</div>
                <div className="text-xs text-on-surface-variant">Download offline backup snapshot</div>
              </div>
            </button>

            <button
              ref={restoreTriggerRef}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="touch-target p-4 rounded-2xl border border-border hover:bg-surface-container transition-all flex items-center gap-3 text-left"
            >
              <Upload className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-bold text-on-surface">Restore Progress (JSON)</div>
                <div className="text-xs text-on-surface-variant">Import validated backup snapshot</div>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
            <NavLink
              to="/licenses"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Attribution & Open Source Licenses</span>
            </NavLink>

            <button
              ref={resetTriggerRef}
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-xs font-bold text-red-accessible hover:underline flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Local Progress</span>
            </button>
          </div>
        </section>

        {/* Achievements Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display text-primary flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-badge" />
              <span>Achievements</span>
            </h2>
            <span className="text-xs font-bold text-on-surface-variant">
              {unlockedCount} / {ACHIEVEMENTS.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = (stats.unlockedAchievements || []).includes(a.id) || a.check(stats);
              return (
                <div
                  key={a.id}
                  className={`p-4 rounded-3xl border transition-all flex flex-col items-center text-center space-y-2 ${
                    isUnlocked
                      ? 'bg-surface-card border-primary/30 shadow-xs'
                      : 'bg-surface-container/50 border-border opacity-50 grayscale'
                  }`}
                >
                  <div className="text-3xl">{isUnlocked ? a.icon : '🔒'}</div>
                  <div className="font-bold text-xs text-on-surface">{a.title}</div>
                  <div className="text-[11px] text-on-surface-variant leading-tight">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Restore Progress Confirmation Modal */}
      {candidateBackup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-dialog-title"
        >
          <div
            ref={restoreModalRef}
            className="bg-surface-card rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-primary">
              <CheckCircle2 className="w-6 h-6" />
              <h3 id="restore-dialog-title" className="text-xl font-bold font-display text-on-surface">
                Replace Current Progress?
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This backup contains valid progress data. Restoring it will replace your active learning state on this device.
            </p>

            {/* Candidate Backup Metrics Card */}
            <div className="bg-surface-container/70 rounded-2xl p-3.5 border border-border grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-sm text-primary">
                  {Object.keys(candidateBackup.snapshot.wordSRS || {}).length}
                </div>
                <div className="text-[10px] text-on-surface-variant">Words</div>
              </div>
              <div>
                <div className="font-bold text-sm text-primary">
                  {(candidateBackup.snapshot.hskLevelProgress[1]?.completedLessons?.length || 0) +
                    (candidateBackup.snapshot.hskLevelProgress[2]?.completedLessons?.length || 0)}
                </div>
                <div className="text-[10px] text-on-surface-variant">Lessons</div>
              </div>
              <div>
                <div className="font-bold text-sm text-primary">
                  {candidateBackup.snapshot.stats?.totalXP || 0}
                </div>
                <div className="text-[10px] text-on-surface-variant">XP</div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCandidateBackup(null);
                  restoreTriggerRef.current?.focus();
                }}
                className="touch-target flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                ref={restoreConfirmBtnRef}
                type="button"
                onClick={handleConfirmRestore}
                className="touch-target flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md hover:bg-primary-dark"
              >
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <div
            ref={resetModalRef}
            className="bg-surface-card rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-red-accessible">
              <RotateCcw className="w-6 h-6" />
              <h3 id="reset-dialog-title" className="text-xl font-bold font-display">
                Reset Local Progress?
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This will reset your completed lessons, SRS flashcards, XP, and streak back to the initial state. You can export a backup first if you want to keep your data.
            </p>
            <p className="text-xs font-bold text-on-surface">
              Type <span className="font-mono text-red-accessible">RESET</span> below to confirm:
            </p>
            <input
              ref={resetInputRef}
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full bg-surface-container border border-border rounded-xl px-4 py-2.5 text-sm font-mono"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  resetTriggerRef.current?.focus();
                }}
                className="touch-target flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim().toLowerCase() !== 'reset'}
                onClick={handleResetProgress}
                className="touch-target flex-1 py-2.5 rounded-xl bg-red-accessible text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                Reset Progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
