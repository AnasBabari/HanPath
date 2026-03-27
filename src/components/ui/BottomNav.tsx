export default function BottomNav({ active, onNav }: { active: string; onNav: (name: string) => void }) {
  const items = [
    { name: 'home', icon: '🏠', label: 'Learn' },
    { name: 'practice', icon: '💪', label: 'Review' }, // SRS
    { name: 'stories', icon: '📜', label: 'Stories' },
    { name: 'chat', icon: '🤖', label: 'Bot' },
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
