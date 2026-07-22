/**
 * Cross-Device Text-to-Speech (TTS) Engine
 * Provides dual-engine audio playback:
 * 1. Web Speech Synthesis with explicit Chinese voice selection (zh-CN, zh-TW, zh-HK)
 * 2. Automatic HTML5 Audio fallback streaming for devices/browsers without native Chinese voices installed
 */

let cachedChineseVoice: SpeechSynthesisVoice | null = null;
let currentAudioFallback: HTMLAudioElement | null = null;

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

function speakViaAudioElement(text: string) {
  try {
    if (currentAudioFallback) {
      currentAudioFallback.pause();
      currentAudioFallback = null;
    }
    const clean = text.trim();
    if (!clean) return;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(clean)}&tl=zh-CN`;
    const audio = new Audio(url);
    currentAudioFallback = audio;
    audio.play().catch(e => {
      console.warn('Audio fallback playback error:', e);
    });
  } catch (err) {
    console.error('TTS Fallback Error:', err);
  }
}

export function speak(text: string) {
  if (!text || !text.trim()) return;

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();

      if (!cachedChineseVoice) {
        cachedChineseVoice = loadChineseVoice();
      }

      // If a native Chinese voice is available, use SpeechSynthesisUtterance
      if (cachedChineseVoice) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = cachedChineseVoice;
        u.lang = cachedChineseVoice.lang;
        u.rate = 0.85; // Slightly slower for clarity
        
        // Handle error by falling back to HTML5 audio
        u.onerror = () => {
          speakViaAudioElement(text);
        };

        window.speechSynthesis.speak(u);
        return;
      }
    } catch (e) {
      console.warn('SpeechSynthesis failed, using HTML5 audio fallback:', e);
    }
  }

  // Fallback if speechSynthesis is unsupported or has no Chinese voice installed
  speakViaAudioElement(text);
}

export function normPinyin(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
