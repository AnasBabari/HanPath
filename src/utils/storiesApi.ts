export interface Token {
  token: string;
  is_word: boolean;
  hsk_level: number;
  pinyin_hint: string;
  meaning: string;
}

export interface Story {
  id: string;
  title: string;
  title_zh: string;
  hsk_level: number;
  tokens: Token[];
}

export async function fetchAllStories(): Promise<Story[]> {
  try {
    const requests = [1, 2, 3, 4].map(i =>
      fetch(`/data/stories_hsk${i}.json`)
        .then(res => res.ok ? res.json() as Promise<Story[]> : [])
        .catch(() => [])
    );
    const results = await Promise.all(requests);
    return results.flat();
  } catch (e) {
    console.warn('Could not load stories', e);
    return [];
  }
}
