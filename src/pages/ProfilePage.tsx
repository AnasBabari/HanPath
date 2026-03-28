import type { UserStats } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';

export default function ProfilePage({ stats, onBack, onChangeReveal, onReset }: {
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
    </div>
  );
}
