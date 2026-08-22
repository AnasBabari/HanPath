import { useEffect, useRef, useState } from 'react';

interface StrokeOrderPracticeProps {
  character: string;
  onComplete: () => void;
  onMistake?: () => void;
}

interface HanziWriterInstance {
  animateCharacter?: () => void;
  cancelQuiz?: () => void;
  quiz: (options?: { onMistake?: () => void; onComplete?: () => void }) => void;
}

export default function StrokeOrderPractice({ character, onComplete, onMistake }: StrokeOrderPracticeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriterInstance | null>(null);
  const [completed, setCompleted] = useState(false);
  const callbacks = useRef({ onComplete, onMistake });

  useEffect(() => {
    callbacks.current = { onComplete, onMistake };
  }, [onComplete, onMistake]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let timer1: ReturnType<typeof setTimeout> | undefined;
    let timer2: ReturnType<typeof setTimeout> | undefined;

    // Clear previous instance if any
    containerRef.current.innerHTML = '';

    void import('hanzi-writer').then((module) => {
      if (isCancelled || !containerRef.current) return;
      const HanziWriter = module.default || module;

      const writer = HanziWriter.create(containerRef.current, character, {
        width: 250,
        height: 250,
        padding: 10,
        showOutline: true,
        showCharacter: false,
        strokeAnimationSpeed: 2,
        delayBetweenStrokes: 50,
        strokeColor: '#1B4D3E', // Jade primary
        outlineColor: '#E2DCD2', // Cream border
        drawingColor: '#18251F', // Charcoal stroke
      });

      writerRef.current = writer;

      timer1 = setTimeout(() => {
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
          },
        });
      }, 100);
    });

    return () => {
      isCancelled = true;
      clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      writerRef.current?.cancelQuiz?.();
    };
  }, [character]);

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-display text-lg font-bold text-on-surface-variant text-center">
        {completed ? 'Perfect! 🎉' : 'Trace the strokes in the correct order'}
      </p>
      <div
        ref={containerRef}
        className="bg-white border-2 border-dashed border-border rounded-2xl p-3 shadow-sm"
        style={{ touchAction: 'none' }}
      />
      {!completed && (
        <button
          type="button"
          onClick={() => writerRef.current?.animateCharacter?.()}
          className="text-primary font-bold text-base hover:underline p-2 cursor-pointer transition-colors"
        >
          Show Hint
        </button>
      )}
    </div>
  );
}
