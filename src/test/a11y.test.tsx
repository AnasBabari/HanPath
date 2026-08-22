import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { BrowserRouter } from 'react-router-dom';
import AppHeader from '../components/ui/AppHeader';
import BottomNav from '../components/ui/BottomNav';
import ProfilePage from '../pages/ProfilePage';
import ExerciseRunner from '../components/exercises/ExerciseRunner';
import type { Lesson } from '../types';

expect.extend(matchers);

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
  export interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

describe('Accessibility (a11y) Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders AppHeader with zero accessibility violations', async () => {
    const { container } = render(
      <BrowserRouter>
        <AppHeader />
      </BrowserRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders BottomNav with zero accessibility violations and accessible landmarks', async () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders ProfilePage with accessible inputs and zero a11y violations', async () => {
    const { container } = render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders ExerciseRunner with accessible audio controls and interactive choices', async () => {
    const mockLesson: Lesson = {
      id: 'lesson-a11y-1',
      unitId: 'unit-1',
      index: 0,
      title: 'A11y Test Lesson',
      summary: 'A11y Test Summary',
      vocab: [],
      exercises: [
        {
          id: 'ex-1',
          type: 'reading-meaning',
          prompt: 'Select meaning for 你好',
          answer: 'Hello',
          options: ['Hello', 'Goodbye', 'Thanks', 'Sorry'],
        },
      ],
    };

    const { container } = render(
      <ExerciseRunner
        lesson={mockLesson}
        onWordResult={() => {}}
        onExit={() => {}}
        onComplete={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
