import type { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', title: 'First Steps', desc: 'Complete your first lesson', icon: '🎯', check: s => s.completedLessons.length >= 1 },
  { id: 'five-lessons', title: 'Getting Started', desc: 'Complete 5 lessons', icon: '📚', check: s => s.completedLessons.length >= 5 },
  { id: 'ten-lessons', title: 'Dedicated Learner', desc: 'Complete 10 lessons', icon: '🌟', check: s => s.completedLessons.length >= 10 },
  { id: 'twenty-lessons', title: 'Rising Scholar', desc: 'Complete 20 lessons', icon: '🏆', check: s => s.completedLessons.length >= 20 },
  { id: 'fifty-lessons', title: 'Knowledge Seeker', desc: 'Complete 50 lessons', icon: '👑', check: s => s.completedLessons.length >= 50 },
  { id: 'streak-3', title: 'Warming Up', desc: '3-day streak', icon: '🔥', check: s => s.streak >= 3 },
  { id: 'streak-7', title: 'On Fire', desc: '7-day streak', icon: '🔥', check: s => s.streak >= 7 },
  { id: 'streak-30', title: 'Unstoppable', desc: '30-day streak', icon: '💪', check: s => s.streak >= 30 },
  { id: 'streak-100', title: 'Century Streak', desc: '100-day streak', icon: '⚡', check: s => s.streak >= 100 },
  { id: 'xp-500', title: 'XP Hunter', desc: 'Earn 500 XP', icon: '💎', check: s => s.totalXP >= 500 },
  { id: 'xp-1000', title: 'XP Master', desc: 'Earn 1000 XP', icon: '💎', check: s => s.totalXP >= 1000 },
  { id: 'xp-5000', title: 'XP Legend', desc: 'Earn 5000 XP', icon: '🌈', check: s => s.totalXP >= 5000 },
  { id: 'words-50', title: 'Vocab Builder', desc: 'Learn 50 words', icon: '📖', check: s => s.wordsLearned >= 50 },
  { id: 'words-100', title: 'Word Collector', desc: 'Learn 100 words', icon: '📖', check: s => s.wordsLearned >= 100 },
  { id: 'words-500', title: 'Walking Dictionary', desc: 'Learn 500 words', icon: '🧠', check: s => s.wordsLearned >= 500 },
  { id: 'accuracy-90', title: 'Sharp Mind', desc: '90%+ accuracy (50+ Qs)', icon: '🎯', check: s => s.totalAttempted >= 50 && s.totalCorrect / s.totalAttempted >= 0.9 },
  { id: 'level-5', title: 'Level 5', desc: 'Reach level 5', icon: '⭐', check: s => s.level >= 5 },
  { id: 'level-10', title: 'Level 10', desc: 'Reach level 10', icon: '⭐', check: s => s.level >= 10 },
  { id: 'level-25', title: 'Level 25', desc: 'Reach level 25', icon: '🌟', check: s => s.level >= 25 },
];
