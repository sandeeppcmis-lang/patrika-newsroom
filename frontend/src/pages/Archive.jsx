import { useState } from 'react';
import { Search, Upload, FileVideo, Quote } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { PageHeader, SectionCard } from '../components/UI.jsx';

export default function Archive() {
  const { t } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);

  const search = () => {
    // Wire to /api/archive/search (OCR + semantic). Demo returns examples.
    setResults([
      { title: 'Rajasthan election editorial', date: '2024-11-22', edition: 'Jaipur', type: 'Editorial' },
      { title: 'Interview coverage 2022', date: '2022-03-14', edition: 'Jodhpur', type: 'Interview' }
    ]);
  };

  return (
    <div>
      <PageHeader title={t('nav.archive')} subtitle="Video transcription · OCR & natural-language news search" />

      <SectionCard title="News Archive — Natural Language Search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
            <input className="input pl-9" placeholder='e.g. "Find all Rajasthan election editorials"'
              value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          </div>
          <button className="btn-primary" onClick={search}>Search</button>
        </div>
        {results && (
          <div className="mt-3 space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                <div><div className="text-sm font-semibold">{r.title}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.date} · {r.edition} · {r.type}</div></div>
                <button className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>Open</button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SectionCard title="Video Upload + Hindi Transcription">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: 'var(--border)' }}>
            <Upload size={28} style={{ color: 'var(--muted)' }} />
            <span className="mt-2 text-sm font-semibold">Upload MD speech / event video</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Whisper → Hindi transcript + subtitles + summary</span>
            <input type="file" accept="video/*" className="hidden" />
          </label>
        </SectionCard>

        <SectionCard title="Recent Transcriptions">
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg p-2.5 text-sm" style={{ background: 'var(--bg)' }}>
              <FileVideo size={16} className="text-patrika-gold" /> MD address — Foundation Day (auto-summary ready)
            </div>
            <div className="rounded-lg p-2.5 text-sm" style={{ background: 'var(--bg)' }}>
              <Quote size={14} className="inline text-patrika-gold" /> Extracted quote: “पत्रकारिता समाज का दर्पण है।”
            </div>
          </div>
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Search-by-spoken-words wires to /api/archive/transcripts.</p>
        </SectionCard>
      </div>
    </div>
  );
}
