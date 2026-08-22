import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Trophy,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { speak } from '../utils/tts';
import { useStore } from '../store/useStore';
import FloatingTooltip from '../components/ui/FloatingTooltip';
import { fetchAllStories, type Story, type Token } from '../utils/storiesApi';

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [activeToken, setActiveToken] = useState<{ token: Token; el: HTMLElement } | null>(null);
  const [showPinyin, setShowPinyin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);

  const { snapshot, stats, hskLevel, markStoryRead, addXP, setFullScreen } = useStore();

  useEffect(() => {
    if (activeStory) {
      setFullScreen(true);
      window.scrollTo(0, 0);
    } else {
      setFullScreen(false);
    }
    return () => {
      setFullScreen(false);
    };
  }, [activeStory, setFullScreen]);

  useEffect(() => {
    let isMounted = true;
    void fetchAllStories().then((data) => {
      if (isMounted) {
        setStories(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const storiesByLevel = useMemo(() => {
    const groups: Record<number, Story[]> = { 1: [], 2: [] };
    stories.forEach((s) => {
      if (groups[s.hsk_level]) {
        groups[s.hsk_level].push(s);
      }
    });
    return groups;
  }, [stories]);

  const handleOpenStory = (story: Story) => {
    setActiveStory(story);
    setHasCompleted(false);
    setActiveToken(null);
    setFullScreen(true);
    window.scrollTo(0, 0);
  };

  const handleCompleteStory = () => {
    if (activeStory) {
      markStoryRead(activeStory.id);
      addXP(50); // Award 50 XP for completing a story
      setHasCompleted(true);
    }
  };

  const handleExitStory = () => {
    setActiveStory(null);
    setHasCompleted(false);
    setFullScreen(false);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Active Story Reader Screen
  if (activeStory) {
    const isAlreadyRead = (snapshot.readStories || []).includes(activeStory.id) || hasCompleted;

    return (
      <div
        className="flex-1 flex flex-col overflow-y-auto pb-32"
        onClick={() => setActiveToken(null)}
        role="region"
        aria-label="Story reader"
      >
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={handleExitStory}
              className="touch-target flex items-center gap-2 text-primary font-bold hover:underline"
              aria-label="Exit story reader"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <div className="text-center">
              <h1 className="text-lg font-bold font-display text-primary line-clamp-1">{activeStory.title}</h1>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                HSK {activeStory.hsk_level} • Graded Story
              </span>
            </div>

            {/* Pinyin Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPinyin(!showPinyin);
              }}
              className="touch-target p-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
              aria-label={showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
            >
              {showPinyin ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden sm:inline">Pinyin</span>
            </button>
          </div>
        </header>

        {/* Reader Content */}
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-10 w-full">
          <div className="space-y-2 text-center pb-4 border-b border-border">
            <h2 className="text-3xl font-bold font-chinese text-on-surface">{activeStory.title_zh}</h2>
            <p className="text-sm font-bold text-on-surface-variant">{activeStory.title}</p>
            <p className="text-xs text-outline">Tap any word to view Pinyin, definition, and hear pronunciation.</p>
          </div>

          <article className="bg-surface-card rounded-3xl p-8 border border-border shadow-xs space-y-8">
            <div className="flex flex-wrap items-end gap-x-2.5 gap-y-7 leading-[3.5rem]">
              {activeStory.tokens.map((token, i) => {
                const isActive = activeToken?.token === token;

                if (!token.is_word) {
                  return (
                    <span
                      key={`sym-${token.token}-${token.hsk_level}-${i}`}
                      className="text-3xl text-on-surface/60 inline-block align-bottom pb-1 font-chinese"
                    >
                      {token.token}
                    </span>
                  );
                }

                return (
                  <FloatingTooltip
                    key={`tok-${token.token}-${token.meaning.replace(/\s+/g, '-')}-${i}`}
                    showAlways={isActive}
                    content={
                      <div className="text-xs p-1">
                        <div className="font-bold text-primary text-sm">{token.pinyin_hint}</div>
                        <div className="text-on-surface text-xs mt-0.5">{token.meaning}</div>
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className={`inline-flex flex-col items-center justify-end cursor-pointer rounded-xl px-1.5 py-1 transition-all border-0 bg-transparent text-left m-0 ${
                        isActive
                          ? 'bg-primary-light text-primary ring-2 ring-primary'
                          : 'hover:bg-surface-container'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) {
                          setActiveToken(null);
                        } else {
                          setActiveToken({ token, el: e.currentTarget });
                          speak(token.token);
                        }
                      }}
                      aria-label={`${token.token}, ${token.pinyin_hint}: ${token.meaning}`}
                    >
                      <div
                        className={`text-xs text-outline font-medium transition-opacity duration-200 tracking-wider mb-[-6px] ${
                          showPinyin || isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {token.pinyin_hint}
                      </div>
                      <div className="text-4xl font-chinese font-medium text-on-surface leading-tight">
                        {token.token}
                      </div>
                    </button>
                  </FloatingTooltip>
                );
              })}
            </div>
          </article>

          {/* End of Story & Completion Action */}
          <div className="pt-6 text-center space-y-4">
            {isAlreadyRead ? (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary-light text-primary rounded-2xl font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Story Completed (+50 XP Earned)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCompleteStory}
                className="touch-target px-8 py-4 rounded-2xl bg-primary text-on-primary font-bold text-base shadow-md hover:bg-primary-dark transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <Trophy className="w-5 h-5" />
                <span>Complete Story</span>
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Story Directory Screen
  return (
    <div className="flex-1 flex flex-col overflow-y-auto pb-24">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 w-full">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Comprehensible Input</span>
          <h1 className="text-3xl font-bold font-display text-on-surface">Graded Stories</h1>
          <p className="text-sm text-on-surface-variant">
            Immerse yourself in authentic Chinese stories calibrated specifically for HSK 1 and 2 vocabulary.
          </p>
        </div>

        {[1, 2].map((level) => {
          const levelStories = storiesByLevel[level] || [];
          const readSet = new Set(stats.readStories || []);
          const isTargetLevel = level === hskLevel;

          return (
            <section key={level} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold font-display text-primary">HSK {level} Stories</h2>
                  {isTargetLevel && (
                    <span className="px-2.5 py-0.5 bg-primary-light text-primary text-[11px] font-bold rounded-full">
                      Current Target
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-on-surface-variant">
                  {levelStories.filter((s) => readSet.has(s.id)).length} / {levelStories.length} Read
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {levelStories.map((story) => {
                  const isRead = readSet.has(story.id);

                  return (
                    <button
                      type="button"
                      key={story.id}
                      onClick={() => handleOpenStory(story)}
                      className="touch-target bg-surface-card p-6 rounded-3xl border border-border hover:border-primary hover:shadow-md transition-all text-left flex flex-col justify-between group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-lg text-on-surface group-hover:text-primary transition-colors">
                            {story.title}
                          </h3>
                          {isRead && (
                            <span className="px-2 py-0.5 bg-primary-light text-primary text-[10px] font-bold rounded-full shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Read</span>
                            </span>
                          )}
                        </div>
                        <p className="font-chinese text-xl font-medium text-on-surface-variant">
                          {story.title_zh}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-border text-xs font-bold text-on-surface-variant w-full">
                        <span>{story.tokens.filter((t) => t.is_word).length} words</span>
                        <span className="text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Read Story</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
