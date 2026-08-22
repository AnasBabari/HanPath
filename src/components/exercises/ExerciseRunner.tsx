import React, { useState, useRef, useEffect, useReducer } from 'react';
import { Volume2, X } from 'lucide-react';
import { callOpenRouter } from '../../utils/ai';
import type { Lesson, Exercise } from '../../types';
import { playCorrect, playWrong } from '../../utils/sounds';
import { speak } from '../../utils/tts';
import { evaluateExercise } from '../../utils/exerciseEvaluator';
import StrokeOrderPractice from './StrokeOrderPractice';

type RunnerState = {
  idx: number;
  feedback: 'idle' | 'ok' | 'no';
  showXP: boolean;
  shake: boolean;
  explanationText: React.ReactNode;
  explanationLoading: boolean;
};

type RunnerAction =
  | { type: 'ADVANCE' }
  | { type: 'SET_FEEDBACK'; feedback: 'idle' | 'ok' | 'no'; shake?: boolean }
  | { type: 'SET_SHOW_XP'; showXP: boolean }
  | { type: 'SET_SHAKE'; shake: boolean }
  | { type: 'SET_EXPLANATION'; text?: React.ReactNode; loading?: boolean };

function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'ADVANCE':
      return {
        ...state,
        idx: state.idx + 1,
        feedback: 'idle',
        shake: false,
        explanationText: '',
        explanationLoading: false,
      };
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.feedback, shake: action.shake ?? state.shake };
    case 'SET_SHOW_XP':
      return { ...state, showXP: action.showXP };
    case 'SET_SHAKE':
      return { ...state, shake: action.shake };
    case 'SET_EXPLANATION':
      return {
        ...state,
        explanationText: action.text !== undefined ? action.text : state.explanationText,
        explanationLoading: action.loading !== undefined ? action.loading : state.explanationLoading,
      };
    default:
      return state;
  }
}

export default function ExerciseRunner({
  lesson,
  onWordResult,
  onExit,
  onComplete,
}: {
  lesson: Lesson;
  onWordResult?: (wordId: string, correct: boolean) => void;
  onExit: () => void;
  onComplete: (correct: number, total: number) => void;
}) {
  const [state, dispatch] = useReducer(runnerReducer, {
    idx: 0,
    feedback: 'idle',
    showXP: false,
    shake: false,
    explanationText: '',
    explanationLoading: false,
  });

  const { idx, feedback, showXP, shake, explanationText, explanationLoading } = state;
  const correctCountRef = useRef(0);
  const lastWrongAnswerRef = useRef<string | undefined>(undefined);

  const total = lesson.exercises.length;
  const ex = lesson.exercises[idx];

  const advance = () => {
    lastWrongAnswerRef.current = undefined;
    if (idx + 1 >= total) {
      onComplete(correctCountRef.current, total);
      return;
    }
    dispatch({ type: 'ADVANCE' });
  };

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (feedback !== 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [feedback]);

  if (!ex) return null;
  const progress = ((idx + (feedback === 'ok' ? 1 : 0)) / total) * 100;

  const handleExplain = async () => {
    dispatch({ type: 'SET_EXPLANATION', loading: true });
    try {
      const response = await callOpenRouter(
        [{ role: 'user', content: 'Please explain this question.' }],
        {
          context: {
            mode: 'explain-mistake',
            hskLevel: lesson.vocab[0]?.hskLevel === 2 ? 2 : 1,
            userAnswer: lastWrongAnswerRef.current,
            correctAnswer: ex.answer,
            exercisePrompt: ex.prompt,
          },
        }
      );
      dispatch({ type: 'SET_EXPLANATION', text: response, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load explanation.';
      dispatch({
        type: 'SET_EXPLANATION',
        text: msg.length < 120 ? msg : 'Could not load explanation — please try again shortly.',
        loading: false,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface text-on-surface flex flex-col overflow-y-auto">
      {showXP && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-accessible text-white px-4 py-2 rounded-full font-bold shadow-lg animate-bounce z-50">
          +10 XP
        </div>
      )}

      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4 w-full">
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit exercise"
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-bold text-sm text-on-surface-variant">
            {idx + 1}/{total}
          </span>
        </div>
      </header>

      {/* Exercise Content */}
      <main className="flex-1 max-w-2xl mx-auto px-6 py-8 w-full flex flex-col justify-center">
        <ExerciseCard
          key={`${lesson.id}-${idx}`}
          exercise={ex}
          locked={feedback !== 'idle'}
          shake={shake}
          onCorrect={() => {
            dispatch({ type: 'SET_FEEDBACK', feedback: 'ok' });
            correctCountRef.current += 1;
            if (ex.wordId) onWordResult?.(ex.wordId, true);
            playCorrect();
            dispatch({ type: 'SET_SHOW_XP', showXP: true });
            setTimeout(() => dispatch({ type: 'SET_SHOW_XP', showXP: false }), 1000);
            const shouldSpeakAnswer =
              ex.type !== 'listening-select' &&
              ex.type !== 'listening-meaning' &&
              /[\u4e00-\u9fff]/.test(ex.answer);
            if (shouldSpeakAnswer) speak(ex.answer);
          }}
          onWrong={(wrongAns) => {
            dispatch({ type: 'SET_FEEDBACK', feedback: 'no', shake: true });
            lastWrongAnswerRef.current = wrongAns;
            if (ex.wordId) onWordResult?.(ex.wordId, false);
            playWrong();
            setTimeout(() => dispatch({ type: 'SET_SHAKE', shake: false }), 400);
          }}
        />
      </main>

      {/* Live Feedback Strip */}
      <div aria-live="polite">
        {feedback === 'ok' && (
          <div className="fixed bottom-0 inset-x-0 bg-mint-badge border-t-2 border-emerald-300 p-6 z-40">
            <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold font-display text-emerald-accessible">
                  Excellent! 🎉
                </p>
                <p className="text-xs text-emerald-accessible/80">Press Enter or Space to continue</p>
              </div>
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white font-bold rounded-xl shadow-sm hover:bg-primary-hover transition-colors cursor-pointer"
                onClick={advance}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {feedback === 'no' && (
          <div className="fixed bottom-0 inset-x-0 bg-red-50 border-t-2 border-red-200 p-6 z-40">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-bold font-display text-red-700">Correct Solution:</p>
                  <p className="text-lg font-bold text-red-900 mt-1">{ex.answer}</p>
                </div>
                <button
                  type="button"
                  className="w-full sm:w-auto px-8 py-3.5 bg-red-700 text-white font-bold rounded-xl shadow-sm hover:bg-red-800 transition-colors cursor-pointer"
                  onClick={advance}
                >
                  Continue
                </button>
              </div>
              {!explanationText && !explanationLoading && (
                <button
                  type="button"
                  onClick={handleExplain}
                  className="text-red-700 font-bold text-sm underline cursor-pointer"
                >
                  Explain this mistake with AI Tutor
                </button>
              )}
              {explanationLoading && <p className="text-sm text-red-700 italic">Thinking...</p>}
              {explanationText && (
                <div className="text-sm text-red-900 bg-white/80 p-3 rounded-lg border border-red-200 leading-relaxed">
                  {explanationText}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise: ex,
  locked,
  shake,
  onCorrect,
  onWrong,
}: {
  exercise: Exercise;
  locked: boolean;
  shake: boolean;
  onCorrect: () => void;
  onWrong: (guessed?: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [bankPick, setBankPick] = useState<number[]>([]);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    submitted.current = false;
    let timer: ReturnType<typeof setTimeout>;
    if ((ex.type === 'listening-select' || ex.type === 'listening-meaning') && ex.promptAudio) {
      timer = setTimeout(() => speak(ex.promptAudio!), 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ex.id, ex.type, ex.promptAudio]);

  const isMCQ =
    ex.type === 'reading-meaning' ||
    ex.type === 'reading-hanzi' ||
    ex.type === 'listening-select' ||
    ex.type === 'listening-meaning';
  const isTileBuilder = ex.type === 'compose' || ex.type === 'sentence-build';
  const isAudioType = ex.type === 'listening-select' || ex.type === 'listening-meaning';

  const check = () => {
    if (locked || submitted.current) return;
    const result = evaluateExercise(ex, {
      choiceIndex: choice,
      typedText: typed,
      bankPickIndices: bankPick,
    });

    submitted.current = true;
    if (result.isCorrect) {
      onCorrect();
    } else {
      onWrong(result.userAnswer || undefined);
    }
  };

  const canCheck = isMCQ
    ? choice !== null
    : ex.type === 'pinyin-type'
      ? typed.trim() !== ''
      : isTileBuilder
        ? bankPick.length > 0
        : false;

  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (locked || submitted.current) return;

      if (isMCQ && ['1', '2', '3', '4'].includes(e.key)) {
        const optIndex = parseInt(e.key, 10) - 1;
        if (optIndex >= 0 && optIndex < (ex.options?.length || 0)) {
          setChoice(optIndex);
        }
      }

      if (isTileBuilder && e.key === 'Backspace') {
        setBankPick((prev) => prev.slice(0, -1));
      }

      if (e.key === 'Enter' && canCheck && ex.type !== 'pinyin-type') {
        checkRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [locked, isMCQ, isTileBuilder, canCheck, ex.options?.length, ex.type]);

  return (
    <div className={`space-y-6 ${shake ? 'animate-shake' : ''}`}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold font-display text-on-surface">
          {ex.type === 'listening-select' ? 'What did you hear?' : ex.prompt}
        </h2>
        {ex.promptPinyin && (
          <p className="text-lg font-bold text-primary">{ex.promptPinyin}</p>
        )}

        {isAudioType && ex.promptAudio && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => speak(ex.promptAudio!)}
              aria-label="Replay audio prompt"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container border border-border text-on-surface font-bold text-sm hover:bg-border/60 transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-primary" />
              Replay Audio
            </button>
            <button
              type="button"
              onClick={() => setShowAudioHint((prev) => !prev)}
              aria-label="Toggle visual transcript hint"
              className="text-xs font-bold text-on-surface-variant underline hover:text-on-surface cursor-pointer"
            >
              {showAudioHint ? 'Hide Transcript' : 'Audio Hint'}
            </button>
            {showAudioHint && (
              <span className="text-sm font-bold bg-surface-container px-3 py-1 rounded-lg text-primary">
                {ex.promptAudio}
              </span>
            )}
          </div>
        )}
      </div>

      {isMCQ && (
        <div className="grid gap-3">
          {ex.options.map((opt, i) => {
            const selected = choice === i;
            return (
              <button
                type="button"
                key={opt}
                disabled={locked}
                onClick={() => setChoice(i)}
                className={`w-full p-4 rounded-2xl border-2 text-left font-bold text-lg flex items-center gap-4 transition-all cursor-pointer ${
                  selected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm ring-2 ring-primary/20'
                    : 'bg-surface-card border-border text-on-surface hover:border-primary/50'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0 ${
                    selected
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container border-border text-on-surface-variant'
                  }`}
                >
                  {i + 1}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {ex.type === 'pinyin-type' && (
        <input
          className="w-full p-4 rounded-2xl border-2 border-border bg-surface-card text-on-surface font-bold text-xl outline-none focus:border-primary transition-colors"
          value={typed}
          disabled={locked}
          placeholder="Type Pinyin (e.g. nǐ hǎo or ni hao)..."
          aria-label="Type Pinyin..."
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canCheck && !locked && check()}
          autoFocus
        />
      )}

      {ex.type === 'stroke-order' && (
        <StrokeOrderPractice
          character={ex.answer[0]}
          onComplete={() => {
            submitted.current = true;
            onCorrect();
          }}
        />
      )}

      {isTileBuilder && ex.bank && (
        <div className="space-y-6">
          <div className="min-h-16 p-3 border-b-2 border-dashed border-border flex flex-wrap gap-2 items-center justify-center">
            {bankPick.map((ti, order) => {
              const pickItem = { id: `picked-${ti}-${order}`, char: ex.bank![ti] };
              return (
                <button
                  type="button"
                  key={pickItem.id}
                  onClick={() => setBankPick((p) => p.filter((_, j) => j !== order))}
                  className="px-4 py-2.5 rounded-xl border-2 border-primary bg-primary/10 text-primary font-bold text-lg shadow-sm cursor-pointer"
                >
                  {pickItem.char}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {(() => {
              const bankPickSet = new Set(bankPick);
              const tiles = ex.bank.map((ch, idx) => ({
                id: `tile-${ex.id}-${ch}-${idx * 13}`,
                char: ch,
                index: idx,
              }));
              return tiles.map((tile) => {
                const used = bankPickSet.has(tile.index);
                return (
                  <button
                    type="button"
                    key={tile.id}
                    disabled={used || locked}
                    onClick={() => setBankPick((p) => [...p, tile.index])}
                    className={`px-5 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                      used
                        ? 'opacity-20 border-transparent bg-border cursor-not-allowed'
                        : 'border-border bg-surface-card text-on-surface hover:border-primary/50 shadow-sm cursor-pointer'
                    }`}
                  >
                    {tile.char}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

      {!locked && ex.type !== 'stroke-order' && (
        <div className="pt-6">
          <button
            type="button"
            disabled={!canCheck}
            onClick={check}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-md transition-all cursor-pointer ${
              canCheck
                ? 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'
                : 'bg-border text-on-surface-variant cursor-not-allowed opacity-50'
            }`}
          >
            Check Answer
          </button>
        </div>
      )}
    </div>
  );
}
