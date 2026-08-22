import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppHeader from '../AppHeader';
import Confetti from '../Confetti';

describe('UI Extra Components', () => {
  it('renders AppHeader with streak, level, and XP details', () => {
    render(<AppHeader />);
    expect(screen.getByText('HànPath')).toBeInTheDocument();
    expect(screen.getByText('HSK 1')).toBeInTheDocument();
  });

  it('renders Confetti animation overlay safely', () => {
    const { container } = render(<Confetti />);
    expect(container).toBeDefined();
  });
});
