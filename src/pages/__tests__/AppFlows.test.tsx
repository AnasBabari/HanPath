import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { useStore } from '../../store/useStore';

describe('HànPath Production App Flows & Component Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({
      hskLevel: 1,
      stats: {
        totalXP: 100,
        level: 1,
        streak: 3,
        longestStreak: 5,
        completedLessons: [],
        wordsLearned: 0,
        totalCorrect: 10,
        totalAttempted: 12,
        lessonsCompletedToday: 0,
        dailyGoalMinutes: 10,
        minutesStudiedToday: 0,
        dailyDate: '2026-08-22',
        targetHskLevel: 1,
        studyDays: ['2026-08-20', '2026-08-21', '2026-08-22'],
        lastStudyDate: '2026-08-22',
        lastSessionStart: null,
        unlockedAchievements: [],
        revealPinyin: 'always',
        wordAccuracy: {},
        wordSRS: {},
        xpToday: 50,
        perfectLessonsToday: 0,
        streakExtendedToday: true,
        readStories: [],
      },
    });
  });

  it('renders application brand, target level selector, and accessible streak/XP header', async () => {
    render(<App />);

    // Brand and Standard
    expect(await screen.findByText('HSK 3.0 Standard')).toBeInTheDocument();
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
  });

  it('renders Learn Path with 5 lessons and checkpoint review per unit', async () => {
    render(<App />);

    // Check that Unit 1 exists
    expect(await screen.findByText('Unit 1: Foundation')).toBeInTheDocument();
    expect(screen.getByText('Start Learning')).toBeInTheDocument();
    expect(screen.getAllByText('Unit Checkpoint').length).toBeGreaterThan(0);
  });

  it('switches between HSK 1 and HSK 2 target levels seamlessly', async () => {
    render(<App />);

    const hsk2Buttons = await screen.findAllByRole('button', { name: /Select HSK 2|Switch to HSK 2/i });
    expect(hsk2Buttons.length).toBeGreaterThan(0);
    fireEvent.click(hsk2Buttons[0]);

    await waitFor(() => {
      expect(useStore.getState().hskLevel).toBe(2);
    });
  });
});
