/**
 * Sound effects via Web Audio API — no external files needed.
 */

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) {
    const AudioContextClass = (typeof window !== 'undefined' ? ((window as any).AudioContext || (window as any)['webkitAudioContext']) : null);
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported in this browser.");
    }
    ctx = new AudioContextClass();
  }
  return ctx;
}

export function playCorrect() {
  try {
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(523, t);
    o.frequency.setValueAtTime(659, t + 0.1);
    o.frequency.setValueAtTime(784, t + 0.2);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    o.start(t); o.stop(t + 0.4);
  } catch { /* silent fail */ }
}

export function playWrong() {
  try {
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);
    o.frequency.setValueAtTime(150, t + 0.15);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    o.start(t); o.stop(t + 0.3);
  } catch { /* silent fail */ }
}

export function playLevelUp() {
  try {
    const c = ac(), t = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t + i * 0.12);
      g.gain.setValueAtTime(0.22, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.3);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
    });
  } catch { /* silent fail */ }
}
