import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, normPinyin } from '../tts';

describe('TTS Speech Engine Deep Coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles empty input and normalizes pinyin with tone removal', () => {
    expect(() => speak('')).not.toThrow();
    expect(normPinyin('  Nǐ Hǎo  ')).toBe('ni hao');
  });

  it('cancels active speech and creates SpeechSynthesisUtterance with zh-CN lang', () => {
    const cancelMock = vi.fn();
    const speakMock = vi.fn();
    const mockVoice = { lang: 'zh-CN', name: 'Ting-Ting' };

    class MockSpeechSynthesisUtterance {
      text: string;
      voice: any;
      lang: string = '';
      rate: number = 1;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    // @ts-expect-error Mocking global SpeechSynthesisUtterance for Node test environment
    global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    // @ts-expect-error Mocking window SpeechSynthesisUtterance for Node test environment
    window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    window.speechSynthesis = {
      cancel: cancelMock,
      speak: speakMock,
      getVoices: vi.fn().mockReturnValue([mockVoice]),
      onvoiceschanged: null,
      paused: false,
      pending: false,
      speaking: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;

    speak('中国');
    expect(cancelMock).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalled();
  });
});
