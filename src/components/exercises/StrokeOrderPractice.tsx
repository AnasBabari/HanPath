import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

interface StrokeOrderPracticeProps {
  character: string;
  onComplete: () => void;
  onMistake?: () => void;
}

export default function StrokeOrderPractice({ character, onComplete, onMistake }: StrokeOrderPracticeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<ReturnType<typeof HanziWriter.create> | null>(null);
  const [completed, setCompleted] = useState(false);
  const callbacks = useRef({ onComplete, onMistake });
  
  useEffect(() => {
    callbacks.current = { onComplete, onMistake };
  }, [onComplete, onMistake]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    let isCancelled = false;

    // Clear previous instance if any
    containerRef.current.innerHTML = '';

    const writer = HanziWriter.create(containerRef.current, character, {
      width: 250,
      height: 250,
      padding: 10,
      showOutline: true,
      showCharacter: false,
      strokeAnimationSpeed: 2,
      delayBetweenStrokes: 50,
      strokeColor: '#58CC02', // var(--primary) in Claymorphism
      outlineColor: '#E5E5E5',
      drawingColor: '#235390', // var(--text-main)
    });
    
    writerRef.current = writer;

    // Give writer a tiny moment to init before starting quiz to prevent race conditions
    let timer2: ReturnType<typeof setTimeout> | undefined;
    const timer1 = setTimeout(() => {
      if (isCancelled) return;
      writer.quiz({
        onMistake: () => {
          callbacks.current.onMistake?.();
        },
        onComplete: () => {
          setCompleted(true);
          timer2 = setTimeout(() => {
            if (!isCancelled) callbacks.current.onComplete();
          }, 800);
        }
      });
    }, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      writer.cancelQuiz();
    };
  }, [character]); 

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <p className="font-display" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>
        {completed ? "Perfect!" : "Trace the strokes in the correct order"}
      </p>
      <div 
        ref={containerRef} 
        style={{ 
          background: '#fff', 
          border: '2px dashed var(--surface-border)', 
          borderRadius: '16px',
          padding: '12px',
          boxShadow: 'var(--clay-shadow)',
          touchAction: 'none', // Critical for mobile tracing
        }} 
      />
      {!completed && (
        <button 
          type="button"
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
