import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: 'Learn', icon: 'home' },
  { path: '/practice', label: 'Practice', icon: 'fitness_center' },
  { path: '/stories', label: 'Stories', icon: 'auto_stories' },
  { path: '/chat', label: 'Chat', icon: 'smart_toy' },
  { path: '/profile', label: 'Profile', icon: 'person' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main Navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          aria-label={item.label}
          className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
