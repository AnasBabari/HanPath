import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../useStore';
import type { Lesson } from '../../types';

describe('Zustand App State Store', () => {
  beforeEach(() => {
    useStore.setState({
      stats: {
        totalXP: 0,
        level: 1,
        streak: 0,
        longestStreak: 0,
        completedLessons: [],
        wordsLearned: 0,
        totalCorrect: 0,
        totalAttempted: 0,
        lessonsCompletedToday: 0,
        dailyGoalMinutes: 10,
        minutesStudiedToday: 0,
        lastStudyDate: null,
        lastSessionStart: null,
        unlockedAchievements: [],
        revealPinyin: 'always',
        wordAccuracy: {},
        wordSRS: {},
        xpToday: 0,
        perfectLessonsToday: 0,
        streakExtendedToday: false,
        readStories: [],
      },
      cloudUserId: null,
      units: null,
      hskLevel: 1,
      leaderboard: [],
      loading: false,
      isFullScreen: false,
      error: null,
      toast: null,
      adminMode: false,
      chatHistory: [],
    });
  });

  it('correctly awards XP and updates stats on completing a lesson', () => {
    const mockLesson: Lesson = {
      id: 'unit1-lesson1',
      unitId: 'unit1',
      index: 0,
      title: 'Greetings',
      summary: 'Basic hellos',
      vocab: [
        { id: 'w1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', hskLevel: 1 },
        { id: 'w2', hanzi: '再见', pinyin: 'zài jiàn', meaning: 'goodbye', hskLevel: 1 },
      ],
      exercises: [],
    };

    useStore.getState().completeLesson('unit1-lesson1', 5, 5, [mockLesson]);

    const state = useStore.getState();
    expect(state.stats.completedLessons).toContain('unit1-lesson1');
    expect(state.stats.lessonsCompletedToday).toBe(1);
    expect(state.stats.perfectLessonsToday).toBe(1);
    expect(state.stats.wordsLearned).toBe(2);
    expect(state.stats.totalCorrect).toBe(5);
    expect(state.stats.totalAttempted).toBe(5);
    expect(state.stats.totalXP).toBe(5 * 10 + 25); // 75 XP
    expect(state.stats.streak).toBe(1);
  });

  it('updates word accuracy when practicing exercises', () => {
    useStore.getState().updateWordResult('w1', true);
    useStore.getState().updateWordResult('w1', false);

    const stats = useStore.getState().stats;
    expect(stats.wordAccuracy['w1']).toBeDefined();
    expect(stats.wordAccuracy['w1'].correct).toBe(1);
    expect(stats.wordAccuracy['w1'].total).toBe(2);
  });

  it('updates SRS data when rating a flashcard in Review mode', () => {
    useStore.getState().rateWord('w1', 'Good');

    const stats = useStore.getState().stats;
    expect(stats.wordSRS['w1']).toBeDefined();
    expect(stats.wordSRS['w1'].repetitions).toBe(1);
    expect(stats.wordSRS['w1'].interval).toBeGreaterThanOrEqual(1);
  });

  it('tracks read stories in user stats', () => {
    useStore.getState().markStoryRead('hsk1-story-1');
    expect(useStore.getState().stats.readStories).toContain('hsk1-story-1');

    // Duplicate marks should not duplicate array entries
    useStore.getState().markStoryRead('hsk1-story-1');
    expect(useStore.getState().stats.readStories.length).toBe(1);
  });

  it('resets level progress when changing HSK target level', () => {
    useStore.getState().setHSKLevel(2);
    const state = useStore.getState();
    expect(state.hskLevel).toBe(2);
    expect(state.units).toBeNull();
    expect(state.stats.completedLessons).toEqual([]);
  });

  it('adds structured chat messages to history with unique IDs', () => {
    useStore.getState().addChatMessage({ role: 'user', content: 'Ni hao' });
    useStore.getState().addChatMessage({ role: 'model', content: 'Ni hao! How are you?' });

    const history = useStore.getState().chatHistory;
    expect(history.length).toBe(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('model');
    expect(history[0].id).not.toEqual(history[1].id);
  });
});
