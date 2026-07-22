/**
 * Tone Utility — Standard tone color mappings for Mandarin Pinyin & Hanzi.
 * 
 * Tone 1 (High Level): Red (#EF4444) -> 'text-red-500'
 * Tone 2 (Rising): Green (#10B981) -> 'text-emerald-500'
 * Tone 3 (Low Dipping): Blue (#3B82F6) -> 'text-blue-500'
 * Tone 4 (Falling): Purple (#8B5CF6) -> 'text-purple-500'
 * Tone 5 / Neutral: Gray (#6B7280) -> 'text-gray-400'
 */

export function getToneNumber(pinyin: string): number {
  if (!pinyin) return 5;
  const str = pinyin.toLowerCase();

  // Explicit tone number at end (e.g. "ma1")
  const matchNum = str.match(/[1-5]$/);
  if (matchNum) return parseInt(matchNum[0], 10);

  // Diacritics check
  if (/[āēīōūǖ1]/.test(str)) return 1;
  if (/[áéíóúǘ2]/.test(str)) return 2;
  if (/[ǎěǐǒǔǚ3]/.test(str)) return 3;
  if (/[àèìòùǜ4]/.test(str)) return 4;

  return 5; // Neutral tone
}

export function getToneColorClass(tone: number): string {
  switch (tone) {
    case 1: return 'text-red-500 font-medium';
    case 2: return 'text-emerald-500 font-medium';
    case 3: return 'text-blue-500 font-medium';
    case 4: return 'text-purple-500 font-medium';
    default: return 'text-gray-400 font-medium';
  }
}

export function getToneColorHex(tone: number): string {
  switch (tone) {
    case 1: return '#EF4444';
    case 2: return '#10B981';
    case 3: return '#3B82F6';
    case 4: return '#8B5CF6';
    default: return '#6B7280';
  }
}
