export function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  // Speak clearly and sightly slower for learners
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export function normPinyin(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
