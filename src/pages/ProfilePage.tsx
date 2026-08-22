import { useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  User,
  Flame,
  Star,
  BookOpen,
  Trophy,
  Layers,
  CloudCheck,
  CloudOff,
  RefreshCw,
  LogOut,
  Download,
  Upload,
  Trash2,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  Clock,
  Target,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { ACHIEVEMENTS } from '../data/achievements';
import { useEffect } from 'react';

export default function ProfilePage() {
  const {
    stats,
    hskLevel,
    setHSKLevel,
    authSession,
    syncStatus,
    lastSyncTime,
    performSync,
    requestEmailOtp,
    verifyEmailOtp,
    resendEmailOtp,
    signInWithGoogle,
    signOut,
    deleteAccount,
    exportProgressJSON,
    importProgressJSON,
    setRevealPinyin,
    setDailyGoalMinutes,
    setToast,
  } = useStore();

  const [authStep, setAuthStep] = useState<'email' | 'code'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 60-second cooldown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const unlockedCount = ACHIEVEMENTS.filter(
    (a) => (stats.unlockedAchievements || []).includes(a.id) || a.check(stats)
  ).length;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setAuthLoading(true);
    setAuthMsg(null);

    const res = await requestEmailOtp(emailInput.trim());
    setAuthLoading(false);
    if (res.success) {
      setAuthStep('code');
      setResendTimer(60);
      setAuthMsg({
        type: 'success',
        text: `We've sent a 6-digit verification code to ${emailInput.trim()}. Please enter it below.`,
      });
    } else {
      setAuthMsg({ type: 'error', text: res.error || 'Failed to send verification code. Please try again.' });
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setAuthMsg({ type: 'error', text: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    setAuthLoading(true);
    setAuthMsg(null);

    const res = await verifyEmailOtp(emailInput.trim(), cleanCode);
    setAuthLoading(false);
    if (res.success) {
      setAuthMsg(null);
      setToast('Successfully signed in! Your progress is now synced to the cloud.');
      setAuthStep('email');
      setOtpCode('');
    } else {
      setAuthMsg({
        type: 'error',
        text: res.error || 'Invalid or expired verification code. Please check and try again.',
      });
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || !emailInput.trim()) return;
    setAuthLoading(true);
    setAuthMsg(null);

    const res = await resendEmailOtp(emailInput.trim());
    setAuthLoading(false);
    if (res.success) {
      setResendTimer(60);
      setAuthMsg({
        type: 'success',
        text: `A new 6-digit code was sent to ${emailInput.trim()}.`,
      });
    } else {
      setAuthMsg({ type: 'error', text: res.error || 'Failed to resend code.' });
    }
  };

  const handleChangeEmail = () => {
    setAuthStep('email');
    setOtpCode('');
    setAuthMsg(null);
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthMsg(null);
    const res = await signInWithGoogle();
    setAuthLoading(false);
    if (!res.success) {
      setAuthMsg({ type: 'error', text: res.error || 'Google sign-in error.' });
    }
  };

  const handleExport = () => {
    const json = exportProgressJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanpath-progress-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Progress backup exported successfully!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importProgressJSON(content);
        if (res.success) {
          setToast('Progress restored successfully!');
        } else {
          setToast(`Import failed: ${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return;
    setIsDeleting(true);
    const res = await deleteAccount();
    setIsDeleting(false);
    if (res.success) {
      setShowDeleteModal(false);
    } else {
      setToast(res.error || 'Failed to delete account.');
    }
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
                  {authSession.user?.email ? authSession.user.email.split('@')[0] : 'Scholar (Guest)'}
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Level {stats.level} • {stats.wordsLearned} Words Mastered
                </p>
              </div>

              {/* Sync Status Badge */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    authSession.user
                      ? syncStatus === 'error'
                        ? 'bg-red-50 text-red-accessible border border-red-200'
                        : 'bg-green-50 text-green-accessible border border-green-200'
                      : 'bg-surface-container text-on-surface-variant border border-border'
                  }`}
                >
                  {syncStatus === 'synced' ? (
                    <CloudCheck className="w-4 h-4" />
                  ) : syncStatus === 'syncing' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : syncStatus === 'error' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <CloudOff className="w-4 h-4" />
                  )}
                  <span>
                    {authSession.user
                      ? syncStatus === 'syncing'
                        ? 'Syncing...'
                        : syncStatus === 'error'
                        ? 'Sync Error'
                        : 'Cloud Synced'
                      : 'Guest Local Mode'}
                  </span>
                </div>

                {authSession.user && (
                  <button
                    type="button"
                    onClick={() => void performSync()}
                    className="touch-target p-1.5 rounded-xl border border-border text-on-surface-variant hover:text-primary transition-colors"
                    title="Manual Cloud Sync"
                    aria-label="Manual Cloud Sync"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {lastSyncTime && authSession.user && (
              <p className="text-[11px] text-outline">Last synchronized at {lastSyncTime}</p>
            )}
          </div>
        </section>

        {/* Authentication Card (If Guest) */}
        {!authSession.user ? (
          <section className="bg-primary-light/50 border border-primary/20 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold font-display text-primary">Enable Cloud Sync & 10x AI Quota</h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Sign in with a 6-digit email code to automatically back up your learning progress across devices and
                  increase your AI Language Tutor quota from 5 to 50 requests/day. Guest progress is safely merged!
                </p>
              </div>
            </div>

            {authMsg && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  authMsg.type === 'success'
                    ? 'bg-green-50 text-green-accessible border border-green-200'
                    : 'bg-red-50 text-red-accessible border border-red-200'
                }`}
                role="alert"
              >
                {authMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{authMsg.text}</span>
              </div>
            )}

            {authStep === 'email' ? (
              <form onSubmit={handleSendCode} className="flex flex-col sm:flex-row gap-2 pt-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your email for 6-digit code..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 bg-surface-card border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary"
                  aria-label="Email address for sign-in"
                />
                <button
                  type="submit"
                  disabled={authLoading || !emailInput.trim()}
                  className="touch-target px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all disabled:opacity-50"
                >
                  {authLoading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    placeholder="Enter 6-digit code (e.g. 123456)"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 bg-surface-card border border-border rounded-2xl px-4 py-3 text-base font-mono tracking-widest text-center sm:text-left focus:border-primary"
                    aria-label="6-digit verification code"
                  />
                  <button
                    type="submit"
                    disabled={authLoading || otpCode.trim().length !== 6}
                    className="touch-target px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary-dark transition-all disabled:opacity-50"
                  >
                    {authLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="text-primary font-bold hover:underline"
                  >
                    Change Email ({emailInput})
                  </button>

                  <button
                    type="button"
                    disabled={resendTimer > 0 || authLoading}
                    onClick={() => void handleResendCode()}
                    className="text-on-surface-variant font-bold hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-bold text-outline uppercase">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="touch-target w-full py-3 bg-surface-card border border-border rounded-2xl text-sm font-bold text-on-surface hover:bg-surface-container transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Continue with Google</span>
            </button>
          </section>
        ) : (
          <section className="bg-surface-card rounded-3xl p-6 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-on-surface">Signed in as {authSession.user.email}</h2>
              <p className="text-xs text-on-surface-variant">Cloud sync is active. 50 AI requests/day enabled.</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="touch-target px-4 py-2.5 rounded-2xl border border-border font-bold text-xs text-on-surface-variant hover:text-primary flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </section>
        )}

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
                <option value="always">Always Show</option>
                <option value="peek">Tap to Peek</option>
              </select>
            </div>

            {/* Daily Goal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-bold text-on-surface">Daily Study Target</div>
                  <div className="text-xs text-on-surface-variant">Commitment goal per calendar day</div>
                </div>
              </div>
              <select
                value={stats.dailyGoalMinutes}
                onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
                className="bg-surface-container border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface"
                aria-label="Daily study goal"
              >
                <option value={5}>5 Minutes</option>
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
          <h2 className="text-lg font-bold font-display text-primary">Data Management & Privacy</h2>

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

            {authSession.user && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="text-xs font-bold text-red-accessible hover:underline flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account & Data</span>
              </button>
            )}
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

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-surface-card rounded-3xl p-6 max-w-md w-full border border-border shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-accessible">
              <Trash2 className="w-6 h-6" />
              <h3 id="delete-dialog-title" className="text-xl font-bold font-display">
                Delete Account & Progress?
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This action is permanent and irreversible. It will immediately purge your cloud account, progress
              snapshots, and AI quota history.
            </p>
            <p className="text-xs font-bold text-on-surface">
              Type <span className="font-mono text-red-accessible">DELETE</span> below to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-surface-container border border-border rounded-xl px-4 py-2.5 text-sm font-mono"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="touch-target flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isDeleting}
                onClick={() => void handleDeleteAccount()}
                className="touch-target flex-1 py-2.5 rounded-xl bg-red-accessible text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
