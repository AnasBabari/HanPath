import { describe, it, expect } from 'vitest';
import { playCorrect, playWrong, playLevelUp } from '../sounds';

describe('Sound Utility (Web Audio API)', () => {
  it('safely invokes playCorrect without throwing', () => {
    expect(() => playCorrect()).not.toThrow();
  });

  it('safely invokes playWrong without throwing', () => {
    expect(() => playWrong()).not.toThrow();
  });

  it('safely invokes playLevelUp without throwing', () => {
    expect(() => playLevelUp()).not.toThrow();
  });
});
