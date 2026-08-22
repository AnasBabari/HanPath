import type { PedagogicalContext } from './types.js';

/**
 * Builds server-owned pedagogical system prompt tailored to HSK 1/2 learning modes.
 * Client cannot inject arbitrary system prompts or bypass educational constraints.
 */
export function buildPedagogicalSystemPrompt(context?: PedagogicalContext): string {
  const mode = context?.mode || 'chat';
  const hskLevel = context?.hskLevel === 2 ? 2 : 1;

  const baseConstraint = `You are HanPath AI, a kind and supportive Mandarin Chinese language tutor.
Target Audience: Beginner learners studying HSK ${hskLevel} (Mandarin).
Core Rules:
1. Always keep responses brief, encouraging, and pedagogically clear.
2. Whenever you output Chinese characters (Hanzi), follow them with tone-marked Pinyin in parentheses and an English translation. Example: 你好 (nǐ hǎo - hello).
3. Do NOT use overly complex idioms or advanced HSK 4+ vocabulary.
4. Maintain a supportive, patient tone.`;

  switch (mode) {
    case 'explain-mistake': {
      const prompt = context?.exercisePrompt ? `Question: "${context.exercisePrompt}"` : '';
      const userAns = context?.userAnswer ? `User Answer: "${context.userAnswer}"` : '';
      const correctAns = context?.correctAnswer ? `Correct Answer: "${context.correctAnswer}"` : '';
      return `${baseConstraint}
Task: The user just made a mistake in an exercise.
${prompt}
${userAns}
${correctAns}
Provide a warm, concise (2-3 sentences max) explanation of why the correct answer is right and clarify the misconception.`;
    }

    case 'explain-word': {
      const word = context?.targetWord || 'the requested vocabulary word';
      return `${baseConstraint}
Task: Explain the Chinese vocabulary word "${word}".
Break down the characters, meaning, Pinyin pronunciation, and provide one simple HSK ${hskLevel} example sentence. Keep it under 4 sentences.`;
    }

    case 'explain-grammar': {
      return `${baseConstraint}
Task: Explain a beginner Chinese grammar pattern.
Explain the sentence structure clearly with a simple formula and 2 beginner example sentences with Pinyin and English.`;
    }

    case 'chat':
    default:
      return `${baseConstraint}
Task: Practice interactive Chinese conversation.
Reply in simple Chinese with Pinyin and English, and ask a friendly follow-up question to continue the dialogue.`;
  }
}
