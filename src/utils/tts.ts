/**
 * Text-to-Speech (TTS) Engine
 * Relies on the browser's native Web Speech API (window.speechSynthesis).
 * Throws a toast notification if the device lacks Chinese voices.
 */

import { useStore } from '../store/useStore';

let cachedChineseVoice: SpeechSynthesisVoice | null = null;
let hasWarnedNoVoice = false;

function loadChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Search in priority order: zh-CN -> zh-TW -> zh-HK -> any voice starting with zh
  const zhCN = voices.find(v => v.lang === 'zh-CN' || v.lang === 'zh_CN');
  if (zhCN) return zhCN;

  const zhTW = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW');
  if (zhTW) return zhTW;

  const zhHK = voices.find(v => v.lang === 'zh-HK' || v.lang === 'zh_HK');
  if (zhHK) return zhHK;

  const anyZh = voices.find(v => v.lang.toLowerCase().startsWith('zh'));
  if (anyZh) return anyZh;

  return null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  cachedChineseVoice = loadChineseVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedChineseVoice = loadChineseVoice();
    };
  }
}

function handleNoVoice() {
  if (hasWarnedNoVoice) return;
  useStore.getState().setToast('Audio disabled: No Chinese voice installed on your device. Please install it in your OS settings.');
  hasWarnedNoVoice = true;
}

export function speak(text: string) {
  if (!text || !text.trim()) return;

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();

      if (!cachedChineseVoice) {
        cachedChineseVoice = loadChineseVoice();
      }

      if (cachedChineseVoice) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = cachedChineseVoice;
        u.lang = cachedChineseVoice.lang;
        u.rate = 0.85; // Slightly slower for clarity
        
        u.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e);
          handleNoVoice();
        };

        window.speechSynthesis.speak(u);
        return;
      }
    } catch (e) {
      console.warn('SpeechSynthesis failed:', e);
    }
  }

  // Fallback if speechSynthesis is unsupported or has no Chinese voice installed
  handleNoVoice();
}

export function normPinyin(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
