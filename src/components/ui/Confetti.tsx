import { useMemo } from 'react';

export default function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: ['#ff6b35', '#4ecdc4', '#ffd166', '#ef476f', '#06d6a0', '#a78bfa'][i % 6],
      delay: Math.random() * 0.8,
      size: 6 + Math.random() * 8,
    })), []);
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, background: p.color,
          width: p.size, height: p.size,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}
