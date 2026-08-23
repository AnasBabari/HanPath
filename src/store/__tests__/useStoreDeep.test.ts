import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, deriveUserStats } from '../useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('Zustand useStore Deep State Transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    useStore.setState({
      snapshot: snap,
      hskLevel: 1,
      units: null,
      loading: false,
      isFullScreen: false,
      error: null,
      toast: null,
      adminMode: false,
      chatHistory: [],
      storageStatus: 'healthy',
      storageError: null,
      stats: deriveUserStats(snap, 1),
    });
  });

  it('completes a lesson, awards XP, and updates completedLessons', () => {
    const { completeLesson } = useStore.getState();

    completeLesson('hsk1-u1-l1', 10, 10);

    const state = useStore.getState();
    expect(state.snapshot.stats.totalXP).toBeGreaterThanOrEqual(10);
    expect(state.snapshot.hskLevelProgress[1].completedLessons).toContain('hsk1-u1-l1');
    expect(state.stats.completedLessons.length).toBe(1);
  });

  it('updates word accuracy on correct and mistake answers', () => {
    const { updateWordResult } = useStore.getState();

    updateWordResult('hsk1-1', true);
    let state = useStore.getState();
    expect(state.snapshot.wordAccuracy['hsk1-1'].correct).toBe(1);
    expect(state.snapshot.wordAccuracy['hsk1-1'].total).toBe(1);

    updateWordResult('hsk1-1', false);
    state = useStore.getState();
    expect(state.snapshot.wordAccuracy['hsk1-1'].correct).toBe(1);
    expect(state.snapshot.wordAccuracy['hsk1-1'].total).toBe(2);
  });

  it('rates SRS cards and advances intervals', () => {
    const { rateWord } = useStore.getState();

    rateWord('hsk1-1', 'Easy');
    let state = useStore.getState();
    const card = state.snapshot.wordSRS['hsk1-1'];
    expect(card).toBeDefined();
    expect(card.repetitions).toBe(1);
    expect(card.interval).toBeGreaterThanOrEqual(1);

    rateWord('hsk1-1', 'Hard');
    state = useStore.getState();
    expect(state.snapshot.wordSRS['hsk1-1'].repetitions).toBe(0);
    expect(state.snapshot.wordSRS['hsk1-1'].interval).toBe(1);
  });

  it('updates user preferences and daily goal minutes', () => {
    const { setDailyGoalMinutes, setRevealPinyin } = useStore.getState();

    setDailyGoalMinutes(30);
    setRevealPinyin('peek');

    const state = useStore.getState();
    expect(state.snapshot.preferences.dailyGoalMinutes).toBe(30);
    expect(state.snapshot.preferences.revealPinyin).toBe('peek');
  });

  it('marks story as read and records in snapshot', () => {
    const { markStoryRead } = useStore.getState();

    markStoryRead('story-hsk1-1');
    const state = useStore.getState();
    expect(state.snapshot.readStories).toContain('story-hsk1-1');
  });

  it('exports and imports progress JSON snapshot cleanly', () => {
    const { completeLesson, exportProgressJSON, importProgressJSON } = useStore.getState();

    completeLesson('hsk1-u1-l1', 10, 10);
    const jsonStr = exportProgressJSON();
    expect(jsonStr).toContain('hsk1-u1-l1');

    // Import invalid string returns error
    const errRes = importProgressJSON('invalid-json');
    expect(errRes.success).toBe(false);

    // Import valid string succeeds
    const okRes = importProgressJSON(jsonStr);
    expect(okRes.success).toBe(true);
    expect(useStore.getState().snapshot.hskLevelProgress[1].completedLessons).toContain('hsk1-u1-l1');
  });
});
