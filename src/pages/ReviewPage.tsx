import { useMemo, useState } from 'react';
import type { Unit, Lesson, UserStats } from '../types';
import { allLessonsFlat } from '../utils/curriculum';
import { speak } from '../utils/tts';

function LessonIntro({ unit, lesson, revealPinyin, onStart, onExit }: {
  unit: Unit; lesson: Lesson; revealPinyin: 'always' | 'peek';
  onStart: () => void; onExit: () => void;
}) {
  const [peeks, setPeeks] = useState<Set<string>>(new Set());
  return (
    <div className="shell lesson-intro">
      <div className="sub-header">
        <button className="back-btn" onClick={onExit}>✕</button>
        <h2>{unit.title}</h2>
      </div>

      <div className="lesson-intro-header">
        <p className="eyebrow">New Words</p>
        <h2>{lesson.title}</h2>
        <p className="subtitle">{lesson.summary}</p>
      </div>

      <div className="vocab-grid">
        {lesson.vocab.map((card, i) => (
          <div key={card.id} className="vocab-card" style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => {
              if (revealPinyin === 'peek') setPeeks(p => { const n = new Set(p); n.add(card.id); return n; });
            }}>
            <div className="hanzi-big">{card.hanzi}</div>
            <div className="details">
              {(revealPinyin === 'always' || peeks.has(card.id)) ? (
                <>
                  <div className="pinyin">{card.pinyin}</div>
                  <div className="meaning">{card.meaning}</div>
                </>
              ) : (
                <div className="meaning" style={{ color: 'var(--text-dim)' }}>Tap to reveal</div>
              )}
            </div>
            <button className="speak-btn" onClick={(e) => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={onStart}>Start Practice →</button>
    </div>
  );
}

export default function ReviewPage({ units, completedLessons, revealPinyin, onBack }: {
  units: Unit[]; completedLessons: string[]; revealPinyin: 'always' | 'peek';
  onBack: () => void;
}) {
  const cards = useMemo(() => {
    const done = new Set(completedLessons);
    return allLessonsFlat(units).filter(l => done.has(l.id)).flatMap(l => l.vocab);
  }, [units, completedLessons]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Review</h2>
        </div>
        <div className="practice-empty">
          <div className="empty-icon">🔄</div>
          <p>Complete a lesson first to build your review deck!</p>
        </div>
      </div>
    );
  }

  const card = cards[idx % cards.length];

  return (
    <div className="shell">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Review · {cards.length} cards</h2>
      </div>

      <div className="flashcard" onClick={() => setFlipped(f => !f)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}>
        {!flipped ? (
          <>
            <p className="fc-label">汉字</p>
            <p className="fc-hanzi">{card.hanzi}</p>
            {revealPinyin === 'always' && <p className="fc-pinyin">{card.pinyin}</p>}
            <p className="fc-tap">Tap to reveal meaning</p>
          </>
        ) : (
          <>
            <p className="fc-label">Meaning</p>
            <p className="fc-meaning">{card.meaning}</p>
            <p className="fc-pinyin">{card.pinyin}</p>
            <button className="speak-btn" style={{ marginTop: 10 }} onClick={e => { e.stopPropagation(); speak(card.hanzi); }}>🔊</button>
          </>
        )}
      </div>

      <div className="review-controls">
        <button className="btn-ghost" onClick={() => { setFlipped(false); setIdx(i => (i - 1 + cards.length) % cards.length); }}>← Prev</button>
        <button className="btn-primary" onClick={() => { setFlipped(false); setIdx(i => (i + 1) % cards.length); }}>Next →</button>
      </div>
    </div>
  );
}
