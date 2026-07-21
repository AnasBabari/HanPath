import { useEffect } from 'react';
import { ACHIEVEMENTS } from '../../data/achievements';

export default function AchievementToast({ id, onDone }: { id: string; onDone: () => void }) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  if (!ach) return null;
  return (
    <div style={{
      position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 500
    }}>
      <div className="achievement-toast">
        <span style={{ fontSize: 32 }}>{ach.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{ach.title}</div>
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>{ach.desc}</div>
        </div>
      </div>
    </div>
  );
}
