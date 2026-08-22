import { NavLink } from 'react-router-dom';
import { GraduationCap, Dumbbell, BookOpen, Sparkles, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Learn', icon: GraduationCap },
  { path: '/practice', label: 'Practice', icon: Dumbbell },
  { path: '/stories', label: 'Stories', icon: BookOpen },
  { path: '/chat', label: 'AI Tutor', icon: Sparkles },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border shadow-lg flex items-center justify-around py-2 px-2"
      aria-label="Mobile Navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.label}
            className={({ isActive }) =>
              `touch-target flex flex-col items-center justify-center text-xs font-bold transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1 rounded-xl transition-all ${
                    isActive ? 'bg-primary-light text-primary' : ''
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span className="mt-0.5">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
