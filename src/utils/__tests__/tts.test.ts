import { describe, it, expect } from 'vitest';
import { normPinyin, speak } from '../tts';

describe('Text-to-Speech & Pinyin Normalization Utility', () => {
  it('normalizes marked pinyin to toneless pinyin for typing exercises', () => {
    expect(normPinyin('nǐ hǎo')).toBe('ni hao');
    expect(normPinyin('xiè xie')).toBe('xie xie');
    expect(normPinyin('zhōng wén')).toBe('zhong wen');
    expect(normPinyin('  LǍO   SHĪ  ')).toBe('lao shi');
  });

  it('safely handles empty and neutral inputs', () => {
    expect(normPinyin('')).toBe('');
    expect(normPinyin('ma')).toBe('ma');
  });

  it('safely invokes speak without crashing in unsupported environments', () => {
    expect(() => speak('你好')).not.toThrow();
  });
});
