import { useState } from 'react';
import { Sparkles, Send, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard } from '../components/UI.jsx';

export default function AiInsights() {
  const { t } = useApp();
  const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Namaste! Ask me about editions, reporters, content quality or legal cases.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chips, setChips] = useState(['Show delayed editions today', 'Top front-page reporter', 'Low-quality content list', 'Legal cases for Jaipur']);

  const ask = async (text) => {
    const q = text ?? input;
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput(''); setBusy(true);
    const res = await api.aiAssistant(q);
    setMsgs((m) => [...m, { role: 'ai', text: res.answer }]);
    if (res.suggestions) setChips(res.suggestions);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title={t('nav.ai')} subtitle="Newsroom assistant · trend monitoring · viral prediction" />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title={<span className="flex items-center gap-1.5"><Sparkles size={15} className="text-patrika-gold" /> AI Newsroom Assistant</span>}>
          <div className="flex h-[420px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                    style={m.role === 'user'
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { background: 'var(--bg)', color: 'var(--text)' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && <div className="text-xs" style={{ color: 'var(--muted)' }}>Thinking…</div>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} className="pill" style={{ background: 'var(--bg)', color: 'var(--text)' }} onClick={() => ask(c)}>{c}</button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="Ask anything…" value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
              <button className="btn-primary" onClick={() => ask()} disabled={busy}><Send size={16} /></button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={<span className="flex items-center gap-1.5"><TrendingUp size={15} /> Trend Monitoring</span>}>
          <div className="space-y-2 text-sm">
            {[
              { src: 'X / Twitter', tag: '#RajasthanBudget', heat: 'High' },
              { src: 'Google Trends', tag: 'Monsoon forecast', heat: 'Rising' },
              { src: 'Competitor', tag: 'Metro Phase-2 lead', heat: 'Watch' }
            ].map((x) => (
              <div key={x.tag} className="rounded-lg p-2.5" style={{ background: 'var(--bg)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{x.tag}</span>
                  <span className="pill" style={{ background: 'var(--brand)', color: '#fff' }}>{x.heat}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{x.src}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Suggested headlines & viral prediction served by ai-service (LangChain + OpenAI).</p>
        </SectionCard>
      </div>
    </div>
  );
}
