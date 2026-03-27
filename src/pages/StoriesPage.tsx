import { useState } from 'react';
import { speak } from '../utils/tts';

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
      { zh: '只', py: 'zhī', en: '(measure word for animals)' },
      { zh: '小', py: 'xiǎo', en: 'small / little' },
      { zh: '猫', py: 'māo', en: 'cat' },
      { zh: '。', py: '.', en: '.' },
      { zh: '它', py: 'tā', en: 'it' },
      { zh: '很', py: 'hěn', en: 'very' },
      { zh: '爱', py: 'ài', en: 'love' },
      { zh: '吃', py: 'chī', en: 'eat' },
      { zh: '鱼', py: 'yú', en: 'fish' },
      { zh: '。', py: '.', en: '.' }
    ]
  },
  {
    id: 's2', title: '去商店 (Going to the Store)', hskLevel: 1,
    segments: [
      { zh: '今', py: 'jīn', en: 'today (part of jīntiān)' },
      { zh: '天', py: 'tiān', en: 'day' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '去', py: 'qù', en: 'go' },
      { zh: '商', py: 'shāng', en: 'store (part of shāngdiàn)' },
      { zh: '店', py: 'diàn', en: 'store' },
      { zh: '买', py: 'mǎi', en: 'buy' },
      { zh: '水', py: 'shuǐ', en: 'water' },
      { zh: '果', py: 'guǒ', en: 'fruit (part of shuǐguǒ)' },
      { zh: '。', py: '.', en: '.' },
      { zh: '苹', py: 'píng', en: 'apple (part of píngguǒ)' },
      { zh: '果', py: 'guǒ', en: 'apple' },
      { zh: '很', py: 'hěn', en: 'very' },
      { zh: '好', py: 'hǎo', en: 'good' },
      { zh: '吃', py: 'chī', en: 'eat (tasty)' },
      { zh: '。', py: '.', en: '.' }
    ]
  }
];

export default function StoriesPage({ onBack }: { onBack: () => void }) {
  const [activeStory, setActiveStory] = useState<HardcodedStory | null>(null);
  const [activeSeg, setActiveSeg] = useState<StorySegment | null>(null);

  if (activeStory) {
    return (
      <div className="shell">
        <div className="sub-header">
          <button className="back-btn" onClick={() => setActiveStory(null)}>← Back</button>
          <h2>{activeStory.title}</h2>
        </div>
        
        <div style={{ padding: 16 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
            Tap any character to see its meaning.
          </p>
          
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px 4px', 
            fontSize: 28, 
            lineHeight: 1.8,
            marginBottom: 32
          }}>
            {activeStory.segments.map((seg, i) => (
              <span 
                key={i} 
                onClick={() => {
                  if (seg.zh === '。') return;
                  setActiveSeg(seg);
                  speak(seg.zh);
                }}
                style={{
                  cursor: seg.zh === '。' ? 'default' : 'pointer',
                  borderBottom: activeSeg === seg ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingBottom: 2
                }}
              >
                {seg.zh}
              </span>
            ))}
          </div>

          {activeSeg && (
            <div style={{
              background: 'var(--bg-card)',
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--accent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideUp 0.2s ease-out'
            }}>
              <div style={{ fontSize: 32, fontWeight: 900 }}>{activeSeg.zh}</div>
              <div style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>{activeSeg.py}</div>
              <div style={{ fontSize: 16, color: 'var(--text-main)' }}>{activeSeg.en}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Stories</h2>
      </div>
      
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STORIES.map(s => (
          <div 
            key={s.id} 
            onClick={() => { setActiveStory(s); setActiveSeg(null); }}
            style={{
              background: 'var(--bg-card)',
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginBottom: 4 }}>HSK {s.hskLevel}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</div>
            </div>
            <div style={{ fontSize: 24 }}>📖</div>
          </div>
        ))}
      </div>
    </div>
  );
}
