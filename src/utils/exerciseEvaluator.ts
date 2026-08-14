/**
 * Pure Exercise Evaluation Engine
 * Isolated, deterministic evaluation logic for all exercise types in HànPath.
 */

import type { Exercise } from '../types';
import { normPinyin } from './tts';

export interface EvaluationInput {
  choiceIndex?: number | null;
  typedText?: string;
  bankPickIndices?: number[];
  strokeCompleted?: boolean;
}

export interface EvaluationResult {
  isCorrect: boolean;
  userAnswer: string;
  expectedAnswer: string;
}

/**
 * Evaluates whether a user's submission matches the correct exercise answer.
 * Handles Unicode strings, whitespace normalization, and tonal Pinyin normalization.
 */
export function evaluateExercise(
  exercise: Exercise,
  input: EvaluationInput,
): EvaluationResult {
  const expectedAnswer = exercise.answer.trim();

  switch (exercise.type) {
    case 'reading-meaning':
    case 'reading-hanzi':
    case 'listening-select':
    case 'listening-meaning': {
      if (input.choiceIndex === null || input.choiceIndex === undefined) {
        return { isCorrect: false, userAnswer: '', expectedAnswer };
      }
      const selected = exercise.options[input.choiceIndex];
      if (!selected) {
        return { isCorrect: false, userAnswer: '', expectedAnswer };
      }
      const isCorrect = selected.trim() === expectedAnswer;
      return { isCorrect, userAnswer: selected.trim(), expectedAnswer };
    }

    case 'pinyin-type': {
      const typed = (input.typedText || '').trim();
      const normalizedUser = normPinyin(typed);
      const normalizedExpected = normPinyin(expectedAnswer);
      const isCorrect = normalizedUser.length > 0 && normalizedUser === normalizedExpected;
      return { isCorrect, userAnswer: typed, expectedAnswer };
    }

    case 'compose':
    case 'sentence-build': {
      if (!exercise.bank || !input.bankPickIndices || input.bankPickIndices.length === 0) {
        return { isCorrect: false, userAnswer: '', expectedAnswer };
      }
      const built = input.bankPickIndices
        .map((i) => exercise.bank![i] || '')
        .join('')
        .trim();
      // Remove any discretionary whitespace for Chinese tile comparison
      const cleanBuilt = built.replace(/\s+/g, '');
      const cleanExpected = expectedAnswer.replace(/\s+/g, '');
      const isCorrect = cleanBuilt === cleanExpected;
      return { isCorrect, userAnswer: built, expectedAnswer };
    }

    case 'stroke-order': {
      const isCorrect = Boolean(input.strokeCompleted);
      return { isCorrect, userAnswer: isCorrect ? expectedAnswer : '', expectedAnswer };
    }

    default:
      return { isCorrect: false, userAnswer: '', expectedAnswer };
  }
}
