import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExerciseRunner from '../ExerciseRunner';
import type { Lesson } from '../../../types';
import * as aiModule from '../../../utils/ai';

const fullLesson: Lesson = {
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
      id: 'ex-audio',
      type: 'listening-select',
      prompt: 'What did you hear?',
      promptAudio: '你好',
      options: ['hello', 'goodbye', 'thanks', 'sorry'],
      answer: 'hello',
      wordId: 'hsk1-1',
    },
    {
      id: 'ex-pinyin',
      type: 'pinyin-type',
      prompt: 'Type pinyin for 你',
      options: [],
      answer: 'ni',
      wordId: 'hsk1-1',
    },
    {
      id: 'ex-tiles',
      type: 'sentence-build',
      prompt: 'Build sentence',
      answer: '你好',
      options: [],
      bank: ['好', '你'],
      wordId: 'hsk1-1',
    },
  ],
};

describe('ExerciseRunner Full Exercise Types Coverage', () => {
  it('handles listening exercise with audio hint toggle and wrong answer AI explanation', async () => {
    const onWordResult = vi.fn();
    const onComplete = vi.fn();

    vi.spyOn(aiModule, 'callOpenRouter').mockResolvedValue('Here is the explanation for this exercise.');

    render(
      <ExerciseRunner
        lesson={fullLesson}
        onComplete={onComplete}
        onWordResult={onWordResult}
        onExit={vi.fn()}
      />
    );

    // Click Audio Hint
    const hintBtn = screen.getByText('Audio Hint');
    fireEvent.click(hintBtn);
    expect(screen.getByText('你好')).toBeInTheDocument();

    // Select wrong option "goodbye"
    const wrongOpt = screen.getByText('goodbye');
    fireEvent.click(wrongOpt);

    const checkBtn = screen.getByText('Check Answer');
    fireEvent.click(checkBtn);

    // Wrong feedback shown
    expect(await screen.findByText('Correct Solution:')).toBeInTheDocument();
    expect(onWordResult).toHaveBeenCalledWith('hsk1-1', false);

    // Click Explain with AI Tutor
    const explainBtn = screen.getByText('Explain this mistake with AI Tutor');
    fireEvent.click(explainBtn);

    expect(await screen.findByText('Here is the explanation for this exercise.')).toBeInTheDocument();

    // Advance to next exercise
    const continueBtn = screen.getByText('Continue');
    fireEvent.click(continueBtn);

    // Pinyin typing exercise mounts
    const pinyinInput = await screen.findByPlaceholderText(/Type Pinyin/i);
    fireEvent.change(pinyinInput, { target: { value: 'ni' } });
    fireEvent.keyDown(pinyinInput, { key: 'Enter' });
    expect(await screen.findByText('Excellent! 🎉')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: ' ' });

    // Complete the tile builder in answer order and finish the lesson.
    const niTile = await screen.findByRole('button', { name: '你' });
    fireEvent.click(niTile);
    fireEvent.click(screen.getByRole('button', { name: '好' }));
    fireEvent.click(screen.getByText('Check Answer'));
    fireEvent.click(await screen.findByText('Continue'));

    expect(onWordResult).toHaveBeenCalledWith('hsk1-1', true);
    expect(onComplete).toHaveBeenCalledWith(2, 3);
  });

  it('handles a correct reading choice, keyboard advance, and explicit exit', async () => {
    const onComplete = vi.fn();
    const onExit = vi.fn();
    const lesson: Lesson = {
      ...fullLesson,
      exercises: [{
        id: 'reading',
        type: 'reading-meaning',
        prompt: '你',
        options: ['you', 'me'],
        answer: 'you',
        wordId: 'hsk1-1',
      }],
    };

    render(<ExerciseRunner lesson={lesson} onComplete={onComplete} onExit={onExit} />);
    fireEvent.click(screen.getByLabelText('Exit exercise'));
    expect(onExit).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.click(await screen.findByText('Continue'));
    expect(onComplete).toHaveBeenCalledWith(1, 1);
  });

  it('clears pending feedback timers when the runner unmounts', () => {
    vi.useFakeTimers();
    try {
      const lesson: Lesson = {
        ...fullLesson,
        exercises: [{
          id: 'reading-timer-cleanup',
          type: 'reading-meaning',
          prompt: '你',
          options: ['you', 'me'],
          answer: 'you',
          wordId: 'hsk1-1',
        }],
      };

      const { unmount } = render(
        <ExerciseRunner lesson={lesson} onComplete={vi.fn()} onExit={vi.fn()} />
      );
      fireEvent.click(screen.getByText('you'));
      fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
