import { Flame, Star, HardDrive, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import logo from '../../assets/logo.png';

export default function AppHeader() {
  const { stats, hskLevel, setHSKLevel, storageStatus, storageError } = useStore();

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Mobile Logo / Brand */}
        <div className="flex md:hidden items-center gap-2">
          <img src={logo} alt="HànPath" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-display font-bold text-lg text-primary leading-none">HànPath</span>
        </div>

        {/* Mobile HSK Level Toggle */}
        <div className="flex md:hidden items-center bg-surface-container rounded-xl p-1 border border-border">
          <button
            type="button"
            onClick={() => setHSKLevel(1)}
            className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
              hskLevel === 1 ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
            }`}
            aria-label="Switch to HSK 1"
          >
            HSK 1
          </button>
          <button
            type="button"
            onClick={() => setHSKLevel(2)}
            className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
              hskLevel === 2 ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
            }`}
            aria-label="Switch to HSK 2"
          >
            HSK 2
          </button>
        </div>

        {/* Stats on the right */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Streak */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full border border-border text-xs font-bold text-amber-accessible"
            title={`${stats.streak} Day Study Streak`}
            role="status"
            aria-label={`${stats.streak} day study streak`}
          >
            <Flame className="w-4 h-4 text-gold-badge fill-gold-badge" />
            <span>{stats.streak}</span>
          </div>

          {/* XP */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 bg-primary-light rounded-full border border-primary/20 text-xs font-bold text-primary"
            title={`${stats.totalXP} Total Experience Points`}
            role="status"
            aria-label={`${stats.totalXP} total experience points`}
          >
            <Star className="w-4 h-4 fill-primary" />
            <span>{stats.totalXP}</span>
          </div>

          {/* Local Storage Indicator */}
          <div
            className="hidden sm:flex items-center justify-center p-1.5 text-on-surface-variant"
            title={storageStatus === 'healthy' ? 'Local Storage Active' : (storageError || 'Storage Error')}
            role="status"
            aria-label={storageStatus === 'healthy' ? 'Local storage active' : 'Storage error'}
          >
            {storageStatus === 'healthy' ? (
              <HardDrive className="w-4 h-4 text-green-accessible" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-accessible" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
