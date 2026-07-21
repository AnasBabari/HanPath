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
  },
  {
    id: 's3', title: '我的早晨 (My Morning)', hskLevel: 1,
    segments: [
      { zh: '早上', py: 'zǎo shang', en: 'morning' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '七点', py: 'qī diǎn', en: '7 o\'clock' },
      { zh: '起床', py: 'qǐ chuáng', en: 'get up' },
      { zh: '。', py: '.', en: '.' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '喝', py: 'hē', en: 'drink' },
      { zh: '咖啡', py: 'kā fēi', en: 'coffee' },
      { zh: '。', py: '.', en: '.' },
      { zh: '然后', py: 'rán hòu', en: 'then' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '去', py: 'qù', en: 'go to' },
      { zh: '学校', py: 'xué xiào', en: 'school' },
      { zh: '。', py: '.', en: '.' }
    ]
  },
  {
    id: 's4', title: '打车 (Taking a Taxi)', hskLevel: 2,
    segments: [
      { zh: '师', py: 'shī', en: 'master' },
      { zh: '傅', py: 'fu', en: 'shifu / driver' },
      { zh: '，', py: ',', en: ',' },
      { zh: '你', py: 'nǐ', en: 'you' },
      { zh: '好', py: 'hǎo', en: 'good / hello' },
      { zh: '！', py: '!', en: '!' },
      { zh: '我', py: 'wǒ', en: 'I' },
      { zh: '想', py: 'xiǎng', en: 'want to' },
      { zh: '去', py: 'qù', en: 'go to' },
      { zh: '机', py: 'jī', en: 'machine' },
      { zh: '场', py: 'chǎng', en: 'field / airport' },
      { zh: '。', py: '.', en: '.' },
      { zh: '没', py: 'méi', en: 'not' },
      { zh: '问', py: 'wèn', en: 'ask' },
      { zh: '题', py: 'tí', en: 'problem / okay' },
      { zh: '。', py: '.', en: '.' },
      { zh: '请', py: 'qǐng', en: 'please' },
      { zh: '坐', py: 'zuò', en: 'sit' },
      { zh: '。', py: '.', en: '.' }
    ]
  }
];

export default function StoriesPage() {
  const [activeStory, setActiveStory] = useState<HardcodedStory | null>(null);
  const [activeSeg, setActiveSeg] = useState<StorySegment | null>(null);

  if (activeStory) {
    return (
      <div className="shell">
        <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => setActiveStory(null)}>← Back</button>
          <h2 style={{ margin: 0, marginLeft: 12 }}>{activeStory.title}</h2>
        </div>
        
        <div style={{ padding: 16 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, fontWeight: 700 }}>
            Tap any character to see its meaning.
          </p>
          
          <div style={{ 
            fontSize: 32, 
            lineHeight: 1.8,
            fontWeight: 900,
            marginBottom: 32,
            lineBreak: 'strict'
          }}>
            {activeStory.segments.map((seg, i) => {
              const isPunctuation = /^[\s-〿＀-￯\-/:-@[\-`{-~]$/.test(seg.zh);
              return (
                <span 
                  key={i} 
                  onClick={() => {
                    if (isPunctuation) return;
                    setActiveSeg(seg);
                    speak(seg.zh);
                  }}
                  style={{
                    cursor: isPunctuation ? 'default' : 'pointer',
                    borderBottom: activeSeg === seg ? '4px solid var(--primary)' : '4px solid transparent',
                    paddingBottom: 2,
                    transition: 'all 0.2s',
                    marginRight: isPunctuation ? 0 : 4
                  }}
                >
                  {seg.zh}
                </span>
              );
            })}
          </div>

          {activeSeg && (
            <div className="vocab-card" style={{
              borderColor: 'var(--primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideUp 0.2s ease-out'
            }}>
              <div style={{ fontSize: 32, fontWeight: 900 }}>{activeSeg.zh}</div>
              <div style={{ color: 'var(--primary)', fontSize: 18, fontWeight: 800 }}>{activeSeg.py}</div>
              <div style={{ fontSize: 16, color: 'var(--on-surface)' }}>{activeSeg.en}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shell" style={{ paddingBottom: 120 }}>
      <div className="sub-header" style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Stories</h2>
      </div>
      
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STORIES.map(s => (
          <div 
            key={s.id} 
            className="vocab-card"
            onClick={() => { setActiveStory(s); setActiveSeg(null); }}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 0
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 900, marginBottom: 4 }}>HSK {s.hskLevel}</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{s.title}</div>
            </div>
            <div style={{ fontSize: 24 }}>📖</div>
          </div>
        ))}
      </div>
    </div>
  );
}
