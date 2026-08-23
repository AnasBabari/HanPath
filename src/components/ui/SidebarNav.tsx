import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  Dumbbell,
  BookOpen,
  Sparkles,
  User,
  ShieldCheck,
  Flame,
  HardDrive,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import logo from '../../assets/logo.png';

const NAV_ITEMS = [
  { path: '/', label: 'Learn Path', icon: GraduationCap },
  { path: '/practice', label: 'Practice Hub', icon: Dumbbell },
  { path: '/stories', label: 'Graded Stories', icon: BookOpen },
  { path: '/chat', label: 'AI Language Tutor', icon: Sparkles },
  { path: '/profile', label: 'Profile', icon: User },
];

export default function SidebarNav() {
  const { stats, hskLevel, setHSKLevel, storageStatus } = useStore();

  return (
    <aside
      className="hidden md:flex flex-col w-64 bg-surface-card border-r border-border h-screen sticky top-0 px-4 py-6 justify-between select-none"
      aria-label="Desktop Navigation"
    >
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3">
          <img src={logo} alt="HànPath Logo" className="w-10 h-10 object-contain rounded-xl" />
          <div>
            <span className="font-display text-2xl font-bold text-primary block leading-none">HànPath</span>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">HSK 3.0-aligned</span>
          </div>
        </div>

        {/* HSK Level Selector */}
        <div className="bg-surface-container rounded-2xl p-2 flex items-center justify-between border border-border">
          <span className="text-xs font-bold text-on-surface-variant pl-2">Target Level:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setHSKLevel(1)}
              className={`touch-target px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                hskLevel === 1
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-card'
              }`}
              aria-label="Select HSK 1"
            >
              HSK 1
            </button>
            <button
              type="button"
              onClick={() => setHSKLevel(2)}
              className={`touch-target px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                hskLevel === 2
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-card'
              }`}
              aria-label="Select HSK 2"
            >
              HSK 2
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1" aria-label="Main Menu">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-sm transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Stats */}
      <div className="space-y-3 pt-4 border-t border-border text-xs">
        {/* Streak & XP Preview */}
        <div className="flex items-center justify-between px-3 py-2 bg-surface-container rounded-xl">
          <div className="flex items-center gap-1 text-amber-accessible font-bold">
            <Flame className="w-4 h-4 text-gold-badge fill-gold-badge" />
            <span>{stats.streak} Days</span>
          </div>
          <div className="font-bold text-primary">{stats.totalXP} XP</div>
        </div>

        {/* Storage Health Indicator */}
        <div className="flex items-center justify-between px-3 text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            {storageStatus === 'healthy' ? (
              <HardDrive className="w-4 h-4 text-green-accessible" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-accessible" />
            )}
            <span className="font-semibold">
              {storageStatus === 'healthy' ? 'Local Storage' : 'Storage Warning'}
            </span>
          </div>
          <NavLink to="/licenses" className="hover:text-primary" title="About & Licenses" aria-label="About & Licenses">
            <ShieldCheck className="w-4 h-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
