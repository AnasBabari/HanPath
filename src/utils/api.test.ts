import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fetchHSKLevel, clearVocabCache } from './api';

const HSK_BASE = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/inclusive/newest';

const mockHSK1Data = [
  {
    "id": "1",
    "word": "爱",
    "f": [
      {
        "i": { "y": "ài" },
        "m": ["to love", "affection"]
      }
    ]
  },
  {
    "id": "2",
    "word": "八",
    "f": [
      {
        "i": { "y": "bā" },
        "m": ["eight"]
      }
    ]
  }
];

export const restHandlers = [
  http.get(`${HSK_BASE}/1.min.json`, () => {
    return HttpResponse.json(mockHSK1Data);
  }),
  http.get(`${HSK_BASE}/99.min.json`, () => {
    return new HttpResponse(null, { status: 404 });
  }),
  http.get(`${HSK_BASE}/429.min.json`, () => {
    return new HttpResponse(null, { status: 429 });
  }),
];

const server = setupServer(...restHandlers);

describe('HSK API - fetchHSKLevel', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
  afterEach(() => {
    server.resetHandlers();
    clearVocabCache();
  });

  it('fetches and parses data successfully via MSW', async () => {
    const data = await fetchHSKLevel(1);
    expect(data).toHaveLength(2);
    expect(data[0].hanzi).toBe('爱');
    expect(data[0].pinyin).toBe('ài');
    expect(data[0].meanings).toEqual(['to love', 'affection']);
  });

  it('uses fallback data if level 1 returns 429 Too Many Requests', async () => {
    // We request level 429 which we mocked to return a 429 status code
    // However the fallback logic only applies if `level === 1`
    server.use(
      http.get(`${HSK_BASE}/1.min.json`, () => {
        return new HttpResponse(null, { status: 429 });
      })
    );
    const data = await fetchHSKLevel(1);
    expect(data.length).toBeGreaterThan(10); // Fallback data length
    expect(data[0].hanzi).toBe('你好');
  });

  it('throws an error for non-level-1 failures', async () => {
    await expect(fetchHSKLevel(99)).rejects.toThrow('HSK 99 fetch failed (404)');
  });

  it('caches the results in memory (using vi.mock)', async () => {
    // First fetch populates cache
    const firstCall = await fetchHSKLevel(1);
    expect(firstCall).toHaveLength(2);

    // Spy on global fetch
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    // Second fetch should use memory cache, not fetch
    const secondCall = await fetchHSKLevel(1);
    expect(secondCall).toEqual(firstCall);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
