import { ArrowLeft, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurriculumMetadata } from '../utils/api';

export default function LicensesPage() {
  const navigate = useNavigate();
  const meta = getCurriculumMetadata();

  return (
    <div className="bg-surface text-on-surface flex-1 flex flex-col overflow-y-auto pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-primary font-bold hover:underline"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold font-display text-primary">About & Licenses</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 w-full">
        {/* Curriculum Attribution */}
        <section className="bg-surface-card rounded-2xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <BookOpen className="w-6 h-6" />
            <h2 className="text-xl font-bold font-display">HSK 3.0 Curriculum Attribution</h2>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            HànPath is built on the official <strong>HSK 3.0 Standard</strong> (汉语水平考试 3.0),
            published by the Ministry of Education of the People&apos;s Republic of China and Center for Language Education and Cooperation (CLEC).
          </p>
          <div className="bg-surface-container rounded-xl p-4 text-xs font-mono space-y-2 text-on-surface-variant">
            <div><strong>Standard:</strong> {meta.standard} (Levels 1–2)</div>
            <div><strong>HSK 1 Vocabulary:</strong> {meta.counts.hsk1} words</div>
            <div><strong>HSK 2 Vocabulary:</strong> {meta.counts.hsk2} words</div>
            <div><strong>Cumulative Words:</strong> {meta.counts.cumulative} words</div>
            <div><strong>Checksum (SHA-256):</strong> {meta.sha256}</div>
            <div><strong>Dataset Retrieval Date:</strong> {meta.retrievalDate}</div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Normalized vocabulary datasets are sourced under the <strong>MIT License</strong> from the open-source repository{' '}
            <a
              href="https://github.com/drkameleon/complete-hsk-vocabulary"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-bold underline inline-flex items-center gap-1"
            >
              drkameleon/complete-hsk-vocabulary <ExternalLink className="w-3 h-3" />
            </a>.
          </p>
        </section>

        {/* Open Source Licenses */}
        <section className="bg-surface-card rounded-2xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="text-xl font-bold font-display">Open Source & Typography Credits</h2>
          </div>
          <div className="space-y-3 text-sm text-on-surface-variant">
            <div>
              <strong>Fonts:</strong> Fredoka, Nunito, and Noto Sans SC (Google Fonts, SIL Open Font License 1.1).
            </div>
            <div>
              <strong>Icons:</strong> Lucide React (ISC License).
            </div>
            <div>
              <strong>Character Stroke Animations:</strong> Hanzi Writer (MIT License).
            </div>
            <div>
              <strong>Frontend Architecture:</strong> React, Vite, Zustand, Tailwind CSS, Workbox (MIT / Apache-2.0).
            </div>
          </div>
        </section>

        {/* Offline & AI Limitations */}
        <section className="bg-surface-card rounded-2xl p-6 border border-border shadow-sm space-y-3">
          <h2 className="text-lg font-bold font-display text-on-surface">Offline & AI Tutoring Limitations</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            All HSK 1 and 2 vocabulary lessons, graded stories, and spaced repetition practice are 100% precached locally
            and work entirely offline. AI Tutor interactions require an active internet connection to communicate securely with
            serverless AI proxies.
          </p>
        </section>
      </main>
    </div>
  );
}
