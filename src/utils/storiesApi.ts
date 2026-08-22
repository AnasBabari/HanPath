export interface Token {
  token: string;
  is_word: boolean;
  hsk_level: number;
  pinyin_hint: string;
  meaning: string;
  is_support?: boolean;
}

export interface Story {
  id: string;
  title: string;
  title_zh: string;
  hsk_level: number;
  tokens: Token[];
}

export async function fetchAllStories(): Promise<Story[]> {
  const [s1, s2] = await Promise.all([
    import('../data/stories_hsk1.json'),
    import('../data/stories_hsk2.json'),
  ]);
  const storiesHsk1 = s1.default || s1;
  const storiesHsk2 = s2.default || s2;
  return [...(storiesHsk1 as Story[]), ...(storiesHsk2 as Story[])];
}
