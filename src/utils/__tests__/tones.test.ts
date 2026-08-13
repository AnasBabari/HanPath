import { describe, it, expect } from 'vitest';
import { getToneNumber, getToneColorClass, getToneColorHex } from '../tones';

describe('Tone Utilities', () => {
  it('correctly extracts tone numbers from marked pinyin', () => {
    expect(getToneNumber('mā')).toBe(1);
    expect(getToneNumber('má')).toBe(2);
    expect(getToneNumber('mǎ')).toBe(3);
    expect(getToneNumber('mà')).toBe(4);
    expect(getToneNumber('ma')).toBe(5);
  });

  it('correctly extracts tone numbers with numerical notation', () => {
    expect(getToneNumber('ni3')).toBe(3);
    expect(getToneNumber('hao3')).toBe(3);
    expect(getToneNumber('shi4')).toBe(4);
  });

  it('handles empty or neutral input gracefully', () => {
    expect(getToneNumber('')).toBe(5);
    expect(getToneNumber('de')).toBe(5);
  });

  it('returns valid color classes and hex values for all tones', () => {
    for (let t = 1; t <= 5; t++) {
      expect(getToneColorClass(t)).toContain('text-');
      expect(getToneColorHex(t)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
