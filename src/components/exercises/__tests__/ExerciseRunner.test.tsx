import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciseRunner from '../ExerciseRunner';
import type { Lesson } from '../../../types';

const sampleLesson: Lesson = {
  id: 'hsk1-u1-l1',
  unitId: 'u1',
  index: 0,
  title: 'Lesson 1',
  summary: 'Test lesson',
  vocab: [
    {
      id: 'hsk1-1',
      hanzi: '你',
      pinyin: 'nǐ',
      meaning: 'you',
      hskLevel: 1,
    },
  ],
  exercises: [
    {
      id: 'ex-1',
      type: 'reading-meaning',
      prompt: 'What is the meaning of 你?',
      promptPinyin: 'nǐ',
      options: ['you', 'I', 'he', 'good'],
      answer: 'you',
      wordId: 'hsk1-1',
    },
    {
      id: 'ex-2',
      type: 'pinyin-type',
      prompt: 'Type pinyin for 你',
      options: [],
      answer: 'ni',
      wordId: 'hsk1-1',
    },
  ],
};

describe('ExerciseRunner Component Suite', () => {
  it('renders MCQ exercise, handles choice selection and checking', async () => {
    const onComplete = vi.fn();
    const onWordResult = vi.fn();

    render(
      <ExerciseRunner
        lesson={sampleLesson}
        onComplete={onComplete}
        onWordResult={onWordResult}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('What is the meaning of 你?')).toBeInTheDocument();
    expect(screen.getByText('nǐ')).toBeInTheDocument();

    // Select correct option "you"
    const option = screen.getByText('you');
    fireEvent.click(option);

    // Check button should now be enabled
    const checkBtn = screen.getByText('Check Answer');
    fireEvent.click(checkBtn);

    // Shows success feedback
    expect(await screen.findByText('Excellent! 🎉')).toBeInTheDocument();
    expect(onWordResult).toHaveBeenCalledWith('hsk1-1', true);
  });
});
