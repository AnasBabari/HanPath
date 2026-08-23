import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';
import type { Lesson } from '../../types';

describe('Zustand App State Store (v4 Progress Architecture)', () => {
  beforeEach(() => {
    const defaultSnap = createDefaultProgressSnapshotV4();
    useStore.setState({
      snapshot: defaultSnap,
      hskLevel: 1,
      units: null,
      loading: false,
      isFullScreen: false,
      error: null,
      toast: null,
      adminMode: false,
      chatHistory: [],
      syncStatus: 'idle',
      cloudVersion: 0,
      isDirty: false,
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
        dailyGoalMinutes: 15,
        minutesStudiedToday: 0,
        dailyDate: null,
        lastStudyDate: null,
        lastSessionStart: null,
        unlockedAchievements: [],
        revealPinyin: 'always',
        targetHskLevel: 1,
        wordAccuracy: {},
        wordSRS: {},
        studyDays: [],
        xpToday: 0,
        perfectLessonsToday: 0,
        streakExtendedToday: false,
        readStories: [],
      },
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
    expect(state.stats.totalCorrect).toBe(5);
    expect(state.stats.totalAttempted).toBe(5);
    expect(state.stats.totalXP).toBe(5 * 10 + 25); // 75 XP
    expect(Object.keys(state.snapshot.wordSRS)).toEqual(['w1', 'w2']);
    expect(state.snapshot.wordSRS.w1.nextReviewDate).toBe(new Date().toISOString().split('T')[0]);
    expect(state.snapshot.wordSRS.w1.repetitions).toBe(0);
    expect(state.isDirty).toBe(true);
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
    expect(stats.wordSRS['w1'].updatedAt).toBeDefined();
  });

  it('tracks read stories in user stats', () => {
    useStore.getState().markStoryRead('hsk1-story-1');
    expect(useStore.getState().stats.readStories).toContain('hsk1-story-1');

    // Duplicate marks should not duplicate array entries
    useStore.getState().markStoryRead('hsk1-story-1');
    expect(useStore.getState().stats.readStories.length).toBe(1);
  });

  it('preserves level-scoped progress when switching HSK level', () => {
    // Complete lesson in HSK 1
    useStore.getState().completeLesson('hsk1-u1-l1', 5, 5, []);
    expect(useStore.getState().stats.completedLessons).toEqual(['hsk1-u1-l1']);

    // Switch to HSK 2
    useStore.getState().setHSKLevel(2);
    expect(useStore.getState().hskLevel).toBe(2);
    expect(useStore.getState().stats.completedLessons).toEqual([]);

    // Complete lesson in HSK 2
    useStore.getState().completeLesson('hsk2-u1-l1', 5, 5, []);
    expect(useStore.getState().stats.completedLessons).toEqual(['hsk2-u1-l1']);

    // Switch back to HSK 1 — completed lesson should still be intact!
    useStore.getState().setHSKLevel(1);
    expect(useStore.getState().hskLevel).toBe(1);
    expect(useStore.getState().stats.completedLessons).toEqual(['hsk1-u1-l1']);
  });

  it('exports and validates progress JSON import', () => {
    useStore.getState().completeLesson('hsk1-u1-l1', 5, 5, []);
    const jsonStr = useStore.getState().exportProgressJSON();
    expect(jsonStr).toContain('hsk1-u1-l1');

    const importRes = useStore.getState().importProgressJSON(jsonStr);
    expect(importRes.success).toBe(true);

    const invalidImport = useStore.getState().importProgressJSON('{ "invalid": true }');
    expect(invalidImport.success).toBe(false);
  });
});
