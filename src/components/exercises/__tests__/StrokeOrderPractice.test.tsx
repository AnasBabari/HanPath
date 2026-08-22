import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StrokeOrderPractice from '../StrokeOrderPractice';

describe('StrokeOrderPractice Component', () => {
  it('renders character trace prompt and allows clicking hint', () => {
    const onComplete = vi.fn();
    render(<StrokeOrderPractice character="你" onComplete={onComplete} />);

    expect(screen.getByText('Trace the strokes in the correct order')).toBeInTheDocument();
    expect(screen.getByText('Show Hint')).toBeInTheDocument();

    const hintBtn = screen.getByText('Show Hint');
    fireEvent.click(hintBtn);
  });
});
