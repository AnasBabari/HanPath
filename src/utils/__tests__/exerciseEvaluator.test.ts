import { describe, it, expect } from 'vitest';
import { evaluateExercise } from '../exerciseEvaluator';
import type { Exercise } from '../../types';

describe('Pure Exercise Evaluation Engine', () => {
  it('correctly evaluates multiple choice questions (MCQ)', () => {
    const ex: Exercise = {
      id: 'mcq-1',
      type: 'reading-meaning',
      prompt: '水',
      answer: 'water',
      options: ['tea', 'water', 'rice', 'bread'],
    };

    expect(evaluateExercise(ex, { choiceIndex: 1 }).isCorrect).toBe(true);
    expect(evaluateExercise(ex, { choiceIndex: 0 }).isCorrect).toBe(false);
    expect(evaluateExercise(ex, { choiceIndex: null }).isCorrect).toBe(false);
    expect(evaluateExercise(ex, { choiceIndex: 99 }).isCorrect).toBe(false);
  });

  it('correctly evaluates pinyin typing with diacritic normalization and whitespace tolerance', () => {
    const ex: Exercise = {
      id: 'pinyin-1',
      type: 'pinyin-type',
      prompt: '你好',
      answer: 'nǐ hǎo',
      options: [],
    };

    // Tone-marked exact match
    expect(evaluateExercise(ex, { typedText: 'nǐ hǎo' }).isCorrect).toBe(true);
    // Plain letters match
    expect(evaluateExercise(ex, { typedText: 'ni hao' }).isCorrect).toBe(true);
    // Uppercase tolerance
    expect(evaluateExercise(ex, { typedText: 'NI HAO' }).isCorrect).toBe(true);
    // Extra whitespace tolerance
    expect(evaluateExercise(ex, { typedText: '   ni   hao   ' }).isCorrect).toBe(true);
    // Wrong answer
    expect(evaluateExercise(ex, { typedText: 'xie xie' }).isCorrect).toBe(false);
    expect(evaluateExercise(ex, { typedText: '' }).isCorrect).toBe(false);
  });

  it('correctly evaluates tile builder and sentence assembly', () => {
    const ex: Exercise = {
      id: 'sent-1',
      type: 'sentence-build',
      prompt: 'I drink tea',
      answer: '我喝茶',
      options: [],
      bank: ['茶', '我', '水', '喝', '饭'],
    };

    // Picking: '我' (index 1), '喝' (index 3), '茶' (index 0)
    expect(evaluateExercise(ex, { bankPickIndices: [1, 3, 0] }).isCorrect).toBe(true);
    // Inverted word order: '茶喝我'
    expect(evaluateExercise(ex, { bankPickIndices: [0, 3, 1] }).isCorrect).toBe(false);
    // Incomplete sentence
    expect(evaluateExercise(ex, { bankPickIndices: [1, 3] }).isCorrect).toBe(false);
    // Empty bank pick
    expect(evaluateExercise(ex, { bankPickIndices: [] }).isCorrect).toBe(false);
  });

  it('correctly evaluates stroke order tracing completion', () => {
    const ex: Exercise = {
      id: 'stroke-1',
      type: 'stroke-order',
      prompt: 'Trace the character',
      answer: '大',
      options: [],
    };

    expect(evaluateExercise(ex, { strokeCompleted: true }).isCorrect).toBe(true);
    expect(evaluateExercise(ex, { strokeCompleted: false }).isCorrect).toBe(false);
  });
});
