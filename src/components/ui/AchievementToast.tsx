import { useEffect } from 'react';
import { ACHIEVEMENTS } from '../../data/achievements';

export default function AchievementToast({ id, onDone }: { id: string; onDone: () => void }) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  if (!ach) return null;
  return (
    <div className="achievement-toast">
      <span className="toast-icon">{ach.icon}</span>
      <div className="toast-text">{ach.title}<span>{ach.desc}</span></div>
    </div>
  );
}
