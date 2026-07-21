import { useState } from 'react';
import { speak } from '../utils/tts';
import { useStore } from '../store/useStore';
import FloatingTooltip from '../components/ui/FloatingTooltip';

interface StorySegment {
  zh: string;
  py: string;
  en: string;
}

interface HardcodedStory {
  id: string;
  title: string;
  hskLevel: number;
  segments: StorySegment[];
}

const STORIES: HardcodedStory[] = [
  {
    id: 's1', title: '我的猫 (My Cat)', hskLevel: 1,
    segments: [
      { zh: '我', py: 'wǒ', en: 'I / me' },
      { zh: '有', py: 'yǒu', en: 'have / there is' },
      { zh: '一', py: 'yì', en: 'one' },
      { zh: '只', py: 'zhī', en: '(measure word)' },
      { zh: '小', py: 'xiǎo', en: 'small' },
      { zh: '猫', py: 'māo', en: 'cat' },
      { zh: '。', py: '', en: '.' },
      { zh: '它', py: 'tā', en: 'it' },
      { zh: '很', py: 'hěn', en: 'very' },
      { zh: '爱', py: 'ài', en: 'love' },
      { zh: '吃', py: 'chī', en: 'eat' },
      { zh: '鱼', py: 'yú', en: 'fish' },
      { zh: '。', py: '', en: '.' }
    ]
  },
  {
    id: 's2', title: '去商店 (Going to the Store)', hskLevel: 1,
    segments: [
      { zh: '今天', py: 'jīn tiān', en: 'today' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '去', py: 'qù', en: 'go' },
      { zh: '商店', py: 'shāng diàn', en: 'store' },
      { zh: '买', py: 'mǎi', en: 'buy' },
      { zh: '水果', py: 'shuǐ guǒ', en: 'fruit' },
      { zh: '。', py: '', en: '.' },
      { zh: '苹果', py: 'píng guǒ', en: 'apple' },
      { zh: '很好吃', py: 'hěn hǎo chī', en: 'very tasty' },
      { zh: '。', py: '', en: '.' }
    ]
  }
];

export default function StoriesPage() {
  const [activeStory, setActiveStory] = useState<HardcodedStory | null>(null);
  const [activeSeg, setActiveSeg] = useState<StorySegment | null>(null);
  const [showPinyin, setShowPinyin] = useState(true);
  
  const { stats } = useStore();

  if (activeStory) {
    return (
      <div className="bg-surface text-on-surface font-body-md min-h-screen pb-32">
        <header className="w-full top-0 sticky z-40 bg-surface shadow-md">
          <div className="flex justify-between items-center px-6 py-4 w-full max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveStory(null)} className="active:translate-y-0.5 transition-all text-primary border-0 p-0 m-0 bg-transparent">
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </button>
              <div className="flex flex-col">
                <h1 className="font-headline-md text-2xl leading-none text-primary m-0 p-0">{activeStory.title}</h1>
                <span className="text-[12px] font-bold text-outline uppercase tracking-wider">HSK {activeStory.hskLevel} • Story</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-primary font-bold text-sm bg-primary-glow/30 px-3 py-1 rounded-full">
                {stats.streak} 🔥 {stats.totalXP} XP
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
              <div className="flex flex-wrap items-end gap-x-3 gap-y-6 leading-[3.5rem] line-break-strict">
                {activeStory.segments.map((seg, i) => {
                  const isPunctuation = /^[\s-〿＀-￯\-/:-@[\-`{-~]$/.test(seg.zh) || seg.zh === '。' || seg.zh === '，' || seg.zh === '！' || seg.zh === '？';
                  
                  if (isPunctuation) {
                    return (
                      <div key={i} className="inline-flex flex-col items-center ml-[-4px]">
                        <span className="text-3xl font-hanzi-display text-on-surface">{seg.zh}</span>
                      </div>
                    );
                  }

                  const isActive = activeSeg === seg;

                  return (
                    <FloatingTooltip 
                      key={i}
                      showAlways={isActive}
                      content={
                        <div className="flex flex-col min-w-[120px]">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="text-primary font-bold text-lg leading-tight m-0">{seg.py}</h4>
                              <p className="text-on-surface-variant text-[16px] m-0 mt-1">{seg.en}</p>
                            </div>
                            <button onClick={() => speak(seg.zh)} className="text-outline hover:text-primary transition-colors p-0 border-0 bg-transparent">
                              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>volume_up</span>
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <div 
                        onClick={() => {
                          setActiveSeg(seg);
                          speak(seg.zh);
                        }}
                        className={`relative inline-flex flex-col items-center cursor-pointer rounded-lg px-1 transition-colors ${
                          isActive 
                            ? 'bg-primary-container/20 ring-2 ring-primary-container ring-offset-2' 
                            : 'hover:bg-primary-glow/20'
                        }`}
                      >
                        {showPinyin && (
                          <span className={`text-sm h-4 mb-1 ${isActive ? 'text-primary font-bold' : 'text-outline'}`}>
                            {seg.py}
                          </span>
                        )}
                        <span className={`text-3xl font-hanzi-display ${isActive ? 'text-primary font-bold' : 'text-on-surface'}`}>
                          {seg.zh}
                        </span>
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
    <div className="bg-surface min-h-screen pb-32">
      <header className="w-full top-0 sticky z-40 bg-surface shadow-sm">
        <div className="flex items-center px-6 py-4 w-full max-w-5xl mx-auto">
          <h1 className="font-headline-md text-3xl leading-none text-primary m-0">Stories</h1>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto px-6 pt-8 space-y-4">
        {STORIES.map(s => (
          <div 
            key={s.id} 
            onClick={() => { setActiveStory(s); setActiveSeg(null); }}
            className="bg-bg-card p-6 rounded-2xl border-2 border-border shadow-sm cursor-pointer hover:border-primary hover:shadow-md transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-[12px] text-primary font-bold tracking-wider uppercase mb-1">HSK {s.hskLevel}</div>
              <div className="text-xl font-bold text-text-main">{s.title}</div>
            </div>
            <div className="w-12 h-12 bg-primary-glow/20 text-primary rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
