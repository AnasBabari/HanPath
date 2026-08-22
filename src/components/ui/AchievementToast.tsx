import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { ACHIEVEMENTS } from '../../data/achievements';

export default function AchievementToast({ id, onDone }: { id: string; onDone: () => void }) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);

  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!ach) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-sm"
    >
      <div className="bg-surface-card border-2 border-primary/30 rounded-3xl p-4 shadow-2xl flex items-center gap-3.5 animate-bounce">
        <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center text-2xl shrink-0 shadow-xs">
          {ach.icon || <Trophy className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
            Achievement Unlocked!
          </span>
          <div className="font-bold font-display text-sm text-on-surface truncate">{ach.title}</div>
          <div className="text-xs text-on-surface-variant truncate">{ach.desc}</div>
        </div>
      </div>
    </div>
  );
}
