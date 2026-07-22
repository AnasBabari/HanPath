import { useState, useEffect, useMemo } from 'react';
import { speak } from '../utils/tts';
import { useStore } from '../store/useStore';
import FloatingTooltip from '../components/ui/FloatingTooltip';

// The schema matching our generated JSON
interface Token {
  token: string;
  is_word: boolean;
  hsk_level: number;
  pinyin_hint: string;
  meaning: string;
}

interface Story {
  id: string;
  title: string;
  title_zh: string;
  hsk_level: number;
  tokens: Token[];
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeToken, setActiveToken] = useState<{ token: Token; el: HTMLElement } | null>(null);
  const [showPinyin, setShowPinyin] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const { stats, hskLevel, markStoryRead, adminMode } = useStore();

  useEffect(() => {
    async function loadStories() {
      setLoading(true);
      const allStories: Story[] = [];
      // Fetch HSK 1 to 4 stories (ignoring 404s if they don't exist yet)
      for (let i = 1; i <= 4; i++) {
        try {
          const res = await fetch(`/data/stories_hsk${i}.json`);
          if (res.ok) {
            const data = await res.json();
            allStories.push(...data);
          }
        } catch (e) {
          console.warn(`Could not load HSK ${i} stories`, e);
        }
      }
      setStories(allStories);
      setLoading(false);
    }
    loadStories();
  }, []);

  const storiesByLevel = useMemo(() => {
    const groups: Record<number, Story[]> = {};
    stories.forEach(s => {
      if (!groups[s.hsk_level]) groups[s.hsk_level] = [];
      groups[s.hsk_level].push(s);
    });
    return groups;
  }, [stories]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activeStory) {
    return (
      <div className="bg-surface text-on-surface font-body-md flex-1 flex flex-col overflow-y-auto pb-32" onClick={() => setActiveToken(null)}>
        <header className="w-full top-0 sticky z-40 bg-surface shadow-md">
          <div className="flex justify-between items-center px-6 py-4 w-full max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setActiveStory(null);
                  markStoryRead(activeStory.id);
                }} 
                className="active:translate-y-0.5 transition-all text-primary border-0 p-0 m-0 bg-transparent flex items-center"
              >
                <span className="material-symbols-outlined text-2xl mr-1">arrow_back</span>
                <span className="font-bold">Finish</span>
              </button>
              <div className="flex flex-col">
                <h1 className="font-headline-md text-2xl leading-none text-primary m-0 p-0">{activeStory.title}</h1>
                <span className="text-[12px] font-bold text-outline uppercase tracking-wider">HSK {activeStory.hsk_level} • Story</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 pt-8 space-y-8">
          <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">translate</span>
              <span className="text-[12px] font-bold text-on-surface-variant tracking-wider uppercase">PINYIN DISPLAY</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={showPinyin} onChange={(e) => setShowPinyin(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

          <section className="space-y-12 pb-12">
            <div className="relative group">
              <div className="flex flex-wrap items-end gap-x-2 gap-y-6 leading-[3.5rem] line-break-strict">
                {activeStory.tokens.map((token, i) => {
                  const isActive = activeToken?.token === token;
                  
                  if (!token.is_word) {
                    return (
                      <span key={i} className="text-3xl text-on-surface/60 inline-block align-bottom pb-1">
                        {token.token}
                      </span>
                    );
                  }

                  return (
                    <FloatingTooltip
                      key={i}
                      showAlways={isActive}
                      content={
                        <div className="text-base">
                          <span className="font-bold text-primary mr-2">{token.pinyin_hint}</span>
                          <span className="text-on-surface">{token.meaning}</span>
                        </div>
                      }
                    >
                      <div 
                        className={`inline-flex flex-col items-center justify-end cursor-pointer rounded-lg px-1 pt-1 pb-1 transition-colors
                          ${isActive ? 'bg-primary-container text-on-primary-container ring-2 ring-primary' : 'hover:bg-surface-variant/50'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isActive) {
                            setActiveToken(null);
                          } else {
                            setActiveToken({ token, el: e.currentTarget });
                            speak(token.token);
                          }
                        }}
                      >
                        <div className={`text-sm text-outline font-medium transition-opacity duration-300 ${showPinyin || isActive ? 'opacity-100' : 'opacity-0'} tracking-wider mb-[-8px]`}>
                          {token.pinyin_hint}
                        </div>
                        <div className="text-4xl font-chinese font-medium">
                          {token.token}
                        </div>
                      </div>
                    </FloatingTooltip>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface font-body-md flex-1 flex flex-col overflow-y-auto pb-32">
      <header className="px-6 pt-12 pb-6">
        <h1 className="font-headline-lg text-4xl mb-2 text-primary">HSK Stories</h1>
        <p className="text-on-surface-variant text-lg">Improve your reading comprehension through context.</p>
      </header>

      <main className="px-6 space-y-10">
        {[1, 2, 3, 4].map(level => {
          const levelStories = storiesByLevel[level] || [];
          if (levelStories.length === 0 && level > 1) return null;
          
          const isLocked = !adminMode && level > hskLevel;

          return (
            <section key={level} className={`space-y-4 ${isLocked ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-headline-md text-2xl text-on-surface flex items-center gap-2">
                  HSK {level} {isLocked && <span className="material-symbols-outlined text-lg">lock</span>}
                </h2>
                {isLocked && <span className="text-sm text-outline">Switch to HSK {level} to unlock</span>}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {levelStories.length === 0 ? (
                  <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30 italic text-outline">
                    Coming soon...
                  </div>
                ) : (
                  levelStories.map(story => {
                    const isCompleted = stats.readStories?.includes(story.id);
                    return (
                      <div 
                        key={story.id} 
                        onClick={() => !isLocked && setActiveStory(story)}
                        className={`bg-surface-container p-5 rounded-2xl border border-outline-variant/50 transition-all ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-surface-container-high hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:shadow-md'} flex flex-col relative overflow-hidden`}
                      >
                        {isCompleted && (
                          <div className="absolute top-0 right-0 bg-secondary text-on-secondary px-3 py-1 text-xs font-bold rounded-bl-lg">
                            READ
                          </div>
                        )}
                        <h3 className="font-headline-sm text-xl mb-1 mt-2">{story.title}</h3>
                        <p className="text-on-surface-variant mb-4 font-chinese text-lg">{story.title_zh}</p>
                        <div className="mt-auto flex justify-between items-center text-sm font-bold text-outline">
                          <span>{story.tokens.filter(t => t.is_word).length} words</span>
                          {!isLocked && <span className="text-primary flex items-center gap-1">Read <span className="material-symbols-outlined text-sm">arrow_forward</span></span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
