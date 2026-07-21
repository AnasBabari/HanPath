import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

interface StrokeOrderPracticeProps {
  character: string;
  onComplete: () => void;
  onMistake?: () => void;
}

export default function StrokeOrderPractice({ character, onComplete, onMistake }: StrokeOrderPracticeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear previous instance if any
    containerRef.current.innerHTML = '';

    writerRef.current = HanziWriter.create(containerRef.current, character, {
      width: 250,
      height: 250,
      padding: 10,
      showOutline: true,
      showCharacter: false,
      strokeAnimationSpeed: 2,
      delayBetweenStrokes: 50,
      strokeColor: '#3273f6', // var(--primary)
      outlineColor: '#e9ecef',
      drawingColor: '#1d2939', // var(--text-main)
    });

    writerRef.current.quiz({
      onMistake: () => {
        onMistake?.();
      },
      onComplete: () => {
        setCompleted(true);
        setTimeout(() => {
          onComplete();
        }, 800); // Give user a brief moment to see completed character
      }
    });

  }, [character]); // Intentionally omitting onComplete/onMistake from dependencies to avoid re-rendering the canvas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>
        {completed ? "Perfect!" : "Trace the strokes in the correct order"}
      </p>
      <div 
        ref={containerRef} 
        style={{ 
          background: '#fff', 
          border: '2px dashed var(--surface-border)', 
          borderRadius: '16px',
          padding: '12px',
          boxShadow: 'var(--shadow-sm)'
        }} 
      />
      {!completed && (
        <button 
          onClick={() => writerRef.current?.animateCharacter()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: '16px',
            textDecoration: 'underline',
            padding: '8px',
            cursor: 'pointer'
          }}
        >
          Show Hint
        </button>
      )}
    </div>
  );
}
