import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak } from '../tts';

describe('Speech Synthesis (TTS) Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls window.speechSynthesis.speak with Chinese utterance safely', () => {
    const mockSpeak = vi.fn();
    const mockCancel = vi.fn();

    vi.stubGlobal('speechSynthesis', {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: () => [
        { lang: 'zh-CN', name: 'Ting-Ting' } as SpeechSynthesisVoice,
      ],
    });

    speak('你好');
    expect(mockCancel).toHaveBeenCalled();
  });

  it('handles empty text without error', () => {
    expect(() => speak('')).not.toThrow();
  });
});
