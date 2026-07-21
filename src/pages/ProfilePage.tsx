import { useStore } from '../store/useStore';

export default function ProfilePage() {
  const { stats } = useStore();

  const achievements = [
    { id: 'first_word', title: 'First Word', icon: '🎯', unlocked: true },
    { id: 'streak_7', title: '7 Day Streak', icon: '📅', unlocked: true },
    { id: 'fast_learner', title: 'Fast Learner', icon: '🚀', unlocked: true },
    { id: 'hanzi_master', title: 'Hanzi Master', icon: '📜', unlocked: false },
    { id: 'daily_scholar', title: 'Daily Scholar', icon: '📓', unlocked: false },
    { id: 'storyteller', title: 'Storyteller', icon: '🎭', unlocked: false },
  ];

  return (
    <div className="app-root">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-brand">HànPath</span>
        </div>
        <div className="topbar-stats">
          <div className="stat-chip"><span className="icon">🔥</span></div>
          <div className="stat-chip"><span className="icon">🎖️</span></div>
          <div className="stat-chip"><span className="icon">⭐</span></div>
        </div>
      </div>

      <div className="shell" style={{ paddingBottom: 140 }}>
        {/* Avatar Section */}
        <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 20 }}>
          <div className="profile-avatar" style={{ position: 'relative' }}>
             👨‍💻
             <div style={{ 
               position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
               background: 'var(--primary)', color: '#fff', padding: '2px 10px', borderRadius: 10,
               fontSize: 10, fontWeight: 900, border: '2px solid #fff', display: 'flex', alignItems: 'center', gap: 4
             }}>
               ✓ HSK 1
             </div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 4 }}>Julian Cheng</h2>
          <p style={{ color: 'var(--text-mid)', fontWeight: 700, fontSize: 13 }}>学习者 (Learner) • Joined May 2023</p>
          
          <div style={{ marginTop: 12, background: 'rgba(88, 204, 2, 0.1)', color: 'var(--primary)', padding: '6px 16px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 900 }}>
             <span style={{ fontSize: 14 }}>☁️</span> SYNCING TO SUPABASE
          </div>
        </div>

        {/* Progress Card */}
        <div className="vocab-card" style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
             <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--text-mid)', textTransform: 'uppercase' }}>HSK Level Path</div>
             <div style={{ color: 'var(--primary)', fontWeight: 900, fontSize: 18 }}>74%</div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: 12 }}>Progress to Level 2</div>
          <div className="xp-bar" style={{ height: 12, marginBottom: 20 }}>
             <div className="xp-bar-fill" style={{ width: '74%' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-mid)', fontWeight: 700, lineHeight: 1.5 }}>
             Complete 12 more Hanzi characters to unlock the HSK 2 curriculum. <br/>
             <span style={{ color: 'var(--primary)', fontWeight: 900 }}>Keep it up!</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
           <div className="vocab-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span style={{ fontSize: 24 }}>🔥</span>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.streak}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Day Streak</div>
              </div>
           </div>
           <div className="vocab-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span style={{ fontSize: 24 }}>⭐</span>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.totalXP.toLocaleString()}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total XP</div>
              </div>
           </div>
        </div>

        {/* Leaderboard Teaser */}
        <div className="vocab-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, borderBottomWidth: 4 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🎖️</span>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Emerald League</div>
           </div>
           <div style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 900 }}>TOP 1%</div>
        </div>

        {/* Achievements */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
           <span style={{ color: 'var(--primary)' }}>🎖️</span> Achievements
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
           {achievements.map(a => (
             <div key={a.id} style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: 80, height: 80, borderRadius: '50%', border: '2px solid' + (a.unlocked ? 'var(--primary)' : 'var(--border)'),
                  margin: '0 auto 8px', display: 'grid', placeItems: 'center', fontSize: 32,
                  background: a.unlocked ? 'var(--grad-primary)' : 'var(--bg-deep)',
                  opacity: a.unlocked ? 1 : 0.5,
                  position: 'relative'
                }}>
                   {a.unlocked ? a.icon : '🔒'}
                   {!a.unlocked && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed var(--text-dim)', opacity: 0.2 }} />}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: a.unlocked ? 'var(--text)' : 'var(--text-dim)' }}>{a.title}</div>
             </div>
           ))}
        </div>

        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
           <span>🖋️</span> Edit Scholar Profile
        </button>
      </div>
    </div>
  );
}
