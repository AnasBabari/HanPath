import { useStore } from '../store/useStore';
import { ACHIEVEMENTS } from '../data/achievements';

export default function ProfilePage() {
  const { stats, hskLevel, setHSKLevel, cloudUserId } = useStore();

  const unlockedCount = ACHIEVEMENTS.filter(a => 
    stats.unlockedAchievements.includes(a.id) || a.check(stats)
  ).length;

  return (
    <div className="bg-surface text-on-surface font-body-md flex-1 flex flex-col overflow-y-auto pb-32">
      {/* Topbar */}
      <header className="w-full top-0 sticky z-40 bg-surface shadow-md">
        <div className="flex justify-between items-center px-6 py-4 w-full max-w-5xl mx-auto">
          <span className="font-headline-md text-2xl text-primary font-bold">Scholar Profile</span>
          <div className="flex items-center gap-3">
            <div className="text-primary font-bold text-sm bg-primary-glow/30 px-3 py-1 rounded-full">
              {stats.streak} 🔥 {stats.totalXP} XP
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-6 pt-8 space-y-8">
        {/* Avatar & Cloud Section */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-4xl shadow-lg border-2 border-primary">
              👨‍💻
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow border border-white">
              HSK {hskLevel}
            </div>
          </div>
          <h2 className="font-headline-md text-3xl font-bold text-on-surface">Scholar</h2>
          <p className="text-on-surface-variant text-sm font-semibold">
            Level {stats.level} • {stats.wordsLearned} Words Learned
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-container/40 text-secondary text-xs font-bold">
            <span className="material-symbols-outlined text-base">cloud_done</span>
            {cloudUserId ? `Cloud Synced (${cloudUserId.slice(0, 8)}...)` : 'Local Mode'}
          </div>
        </div>

        {/* HSK Level Selection */}
        <section className="bg-surface-container p-6 rounded-2xl border border-outline-variant/40 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-headline-sm text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              Current HSK Level
            </h3>
            <span className="text-sm font-bold text-primary">Level {hskLevel}</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(lvl => (
              <button
                key={lvl}
                onClick={() => setHSKLevel(lvl)}
                className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                  hskLevel === lvl
                    ? 'bg-primary text-on-primary border-primary shadow-md'
                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:bg-surface-variant'
                }`}
              >
                HSK {lvl}
              </button>
            ))}
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 text-center space-y-1">
            <span className="text-2xl">🔥</span>
            <div className="text-2xl font-bold text-on-surface">{stats.streak}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Day Streak</div>
          </div>

          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 text-center space-y-1">
            <span className="text-2xl">⭐</span>
            <div className="text-2xl font-bold text-on-surface">{stats.totalXP}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Total XP</div>
          </div>

          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 text-center space-y-1">
            <span className="text-2xl">📚</span>
            <div className="text-2xl font-bold text-on-surface">{stats.completedLessons.length}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Lessons</div>
          </div>

          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant/30 text-center space-y-1">
            <span className="text-2xl">📖</span>
            <div className="text-2xl font-bold text-on-surface">{stats.readStories.length}</div>
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Stories Read</div>
          </div>
        </section>

        {/* Achievements */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-headline-sm text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">emoji_events</span>
              Achievements
            </h3>
            <span className="text-sm font-bold text-outline">
              {unlockedCount} / {ACHIEVEMENTS.length}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ACHIEVEMENTS.map(a => {
              const isUnlocked = stats.unlockedAchievements.includes(a.id) || a.check(stats);
              return (
                <div 
                  key={a.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col items-center text-center space-y-2 ${
                    isUnlocked
                      ? 'bg-surface-container-high border-primary/40 shadow-sm'
                      : 'bg-surface-container-low border-outline-variant/20 opacity-50 grayscale'
                  }`}
                >
                  <div className="text-3xl">{isUnlocked ? a.icon : '🔒'}</div>
                  <div className="font-bold text-sm text-on-surface">{a.title}</div>
                  <div className="text-xs text-on-surface-variant leading-tight">{a.desc}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
