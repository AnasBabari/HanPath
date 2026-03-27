import type { Quest } from '../types';

export const QUEST_POOL: Quest[] = [
  { id: 'accuracy_2', label: 'Get perfect score on 2 lessons', check: (s) => s.perfectLessonsToday >= 2, reward: 50 },
  { id: 'xp_50', label: 'Earn 50 XP today', check: (s) => s.xpToday >= 50, reward: 30 },
  { id: 'streak_extend', label: 'Extend your streak', check: (s) => s.streakExtendedToday, reward: 20 },
  { id: 'xp_100', label: 'Earn 100 XP today', check: (s) => s.xpToday >= 100, reward: 50 },
  { id: 'lesson_3', label: 'Complete 3 lessons', check: (s) => s.lessonsCompletedToday >= 3, reward: 40 }, 
];

// Returns 3 deterministic quests per day so all users get the same ones
export function getDailyQuests(dateStr: string): Quest[] {
  const seed = parseInt(dateStr.replace(/-/g, ''), 10) || 1;
  const shuffled = [...QUEST_POOL].sort((a, b) => {
    // A simple deterministic hash relying on the id string and the date seed
    let hashA = 0; for(let i=0; i<a.id.length; i++) hashA += a.id.charCodeAt(i);
    let hashB = 0; for(let i=0; i<b.id.length; i++) hashB += b.id.charCodeAt(i);
    return ((hashA * seed) % 100) - ((hashB * seed) % 100);
  });
  return shuffled.slice(0, 3);
}
