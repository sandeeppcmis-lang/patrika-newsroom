import { useEffect, useState, useCallback } from 'react';
import {
  Bell, MessageCircle, Mail, Smartphone, Send,
  CheckCircle2, XCircle, Loader2, Settings2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { PageHeader, SectionCard, Badge } from '../components/UI.jsx';

// ── Severity helpers ──────────────────────────────────────────────────────────
const SEV_EMOJI = { high: '🔴', med: '🟡', low: '🟢' };

// ── Channel pills (display only) ──────────────────────────────────────────────
const CHANNELS = [
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Mail,          label: 'Email'    },
  { icon: Smartphone,    label: 'SMS'      },
  { icon: Send,          label: 'Telegram' },
];

// ── Custom hook — per-alert Telegram send status ──────────────────────────────
function useTgStatus() {
  const [map, setMap] = useState({});
  const set = (id, status, msg = '') =>
    setMap((prev) => ({ ...prev, [id]: { status, msg } }));
  const get = (id) => map[id] ?? { status: 'idle', msg: '' };
  return { set, get };
}

export default function Alerts() {
  const { t } = useApp();

  // ── State ──────────────────────────────────────────────────────────────────
  const [alerts,   setAlerts]   = useState([]);
  const [tgConfig, setTgConfig] = useState({ configured: false, chat_id: '' });
  const [tgLogs,   setTgLogs]   = useState([]);   // local send history (this session)

  // Config panel
  const [showConfig,  setShowConfig]  = useState(false);
  const [chatIdInput, setChatIdInput] = useState('');
  const [testStatus,  setTestStatus]  = useState('idle');   // idle|testing|ok|error
  const [testResult,  setTestResult]  = useState(null);     // { bot } or { error }

  // Custom composer
  const [composer,       setComposer]       = useState(false);
  const [customMsg,      setCustomMsg]      = useState('');
  const [customChatId,   setCustomChatId]   = useState('');
  const [customSev,      setCustomSev]      = useState('high');
  const [composerStatus, setComposerStatus] = useState('idle'); // idle|sending|sent|error
  const [composerError,  setComposerError]  = useState('');

  // Per-alert send status
  const tgStatus = useTgStatus();

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    api.alerts().then(setAlerts);
    api.telegramConfig().then((cfg) => {
      setTgConfig(cfg);
      setChatIdInput(cfg.chat_id || '');
    });
  }, []);

  // ── Send a live alert card to Telegram ────────────────────────────────────
  const sendAlertToTelegram = useCallback(async (alert) => {
    tgStatus.set(alert.id, 'sending');
    const res = await api.sendTelegramAlert({
      alert,
      alert_id: alert.id,
      chat_id: chatIdInput || undefined,
    });
    if (res.ok) {
      tgStatus.set(alert.id, 'sent');
      setTgLogs((prev) => [
        {
          id:      Date.now(),
          alertId: alert.id,
          type:    alert.type,
          text:    alert.text,
          time:    new Date().toLocaleTimeString(),
          status:  'sent',
        },
        ...prev.slice(0, 9),
      ]);
    } else {
      tgStatus.set(alert.id, 'error', res.error || 'Send failed');
    }
    // Auto-reset icon after 4 s
    setTimeout(() => tgStatus.set(alert.id, 'idle'), 4000);
  }, [chatIdInput]);

  // ── Send custom composed message ──────────────────────────────────────────
  const sendCustomMessage = async () => {
    if (!customMsg.trim()) return;
    setComposerStatus('sending');
    setComposerError('');

    const sevEmoji  = SEV_EMOJI[customSev] ?? '🟢';
    const formatted =
      `<b>${sevEmoji} Patrika Newsroom — Custom Alert</b>\n\n${customMsg}\n\n<i>⏰ ${new Date().toLocaleString()}</i>`;

    const res = await api.sendTelegramAlert({
      message:  formatted,
      chat_id:  customChatId || chatIdInput || undefined,
    });

    if (res.ok) {
      setComposerStatus('sent');
      setCustomMsg('');
      setTgLogs((prev) => [
        {
          id:      Date.now(),
          alertId: null,
          type:    'Custom',
          text:    customMsg,
          time:    new Date().toLocaleTimeString(),
          status:  'sent',
        },
        ...prev.slice(0, 9),
      ]);
      setTimeout(() => setComposerStatus('idle'), 3000);
    } else {
      setComposerStatus('error');
      setComposerError(res.error || 'Failed to send. Check bot token & chat ID.');
    }
  };

  // ── Test bot token via getMe ──────────────────────────────────────────────
  const testBotToken = async () => {
    setTestStatus('testing');
    setTestResult(null);
    const res = await api.testTelegramBot();
    if (res.ok) {
      setTestStatus('ok');
      setTestResult(res);
    } else {
      setTestStatus('error');
      setTestResult(res);
    }
  };

  // ── Per-alert Telegram action button ─────────────────────────────────────
  function TgButton({ alert }) {
    const { status, msg } = tgStatus.get(alert.id);
    if (status === 'sending') {
      return <Loader2 size={15} className="animate-spin" style={{ color: 'var(--brand)' }} />;
    }
    if (status === 'sent') {
      return <CheckCircle2 size={15} className="text-green-500" />;
    }
    if (status === 'error') {
      return (
        <span title={msg} className="cursor-help">
          <XCircle size={15} className="text-red-500" />
        </span>
      );
    }
    return (
      <button
        title="Forward to Telegram"
        onClick={() => sendAlertToTelegram(alert)}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition hover:opacity-75"
        style={{
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          color:      'var(--text)',
        }}
      >
        <Send size={11} /> Telegram
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title={t('nav.alerts')}
        subtitle="Real-time alert engine · multi-channel delivery"
      />

      {/* Channel pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CHANNELS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="pill"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <Icon size={13} /> {label}
          </span>
        ))}
      </div>

      {/* ── Telegram Config Banner ─────────────────────────────────────────── */}
      <div
        className="mb-4 rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={16} style={{ color: tgConfig.configured ? '#22c55e' : '#f59e0b' }} />
            <span className="text-sm font-bold">Telegram Integration</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: tgConfig.configured ? '#d1fae5' : '#fef3c7',
                color:      tgConfig.configured ? '#065f46' : '#92400e',
              }}
            >
              {tgConfig.configured ? '✓ Bot Connected' : '⚠ Not Configured'}
            </span>
          </div>
          <button
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--muted)' }}
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 size={13} />
            {showConfig ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Settings
          </button>
        </div>

        {showConfig && (
          <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>

            {/* Step-by-step setup guide */}
            <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: 'var(--bg)' }}>
              <p className="font-semibold mb-1">Setup Guide:</p>
              <ol className="list-decimal list-inside space-y-1.5" style={{ color: 'var(--muted)' }}>
                <li>Open Telegram → message <strong>@BotFather</strong> → send <code>/newbot</code> → copy the token</li>
                <li>Set <code>TELEGRAM_BOT_TOKEN=&lt;token&gt;</code> in <code>backend/.env</code> and restart Apache</li>
                <li>Add your bot to your channel/group as an <strong>Admin</strong></li>
                <li>Send any message in that channel, then open:<br />
                  <code className="break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code><br />
                  Copy the <code>"chat": &#123;"id": ...&#125;</code> value
                </li>
                <li>Set <code>TELEGRAM_CHAT_ID=&lt;chat_id&gt;</code> in <code>backend/.env</code></li>
                <li>Click <strong>Test Bot Token</strong> below to verify</li>
              </ol>
            </div>

            {/* Test bot token button + result */}
            <div>
              <button
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onClick={testBotToken}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing'
                  ? <><Loader2 size={13} className="animate-spin" /> Testing…</>
                  : <><Send size={13} /> Test Bot Token</>}
              </button>

              {testStatus === 'ok' && testResult?.bot && (
                <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-green-700"
                  style={{ background: '#d1fae5' }}>
                  <CheckCircle2 size={14} />
                  ✅ Token valid! Bot: <strong>{testResult.bot.first_name}</strong> ({testResult.bot.username})
                </div>
              )}

              {testStatus === 'error' && testResult?.error && (
                <div className="mt-2 rounded-lg px-3 py-2 text-xs text-red-700"
                  style={{ background: '#fee2e2' }}>
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{testResult.error}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat ID override */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label text-xs">Chat ID override (this session only)</label>
                <input
                  className="input w-full py-1.5 text-xs"
                  placeholder="e.g. -1001234567890 or @yourchannel"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setShowConfig(false)}>
                  Apply
                </button>
              </div>
            </div>

            {tgConfig.chat_id && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Default from .env: <code>{tgConfig.chat_id}</code>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Custom Message Composer ───────────────────────────────────────── */}
      <SectionCard
        className="mb-4"
        title={
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setComposer(!composer)}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <Send size={15} /> Send Custom Telegram Alert
            </span>
            {composer ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        }
      >
        {composer && (
          <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>

            {/* Severity */}
            <div>
              <label className="label text-xs">Severity</label>
              <div className="flex gap-2 mt-1">
                {['high', 'med', 'low'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setCustomSev(s)}
                    className="rounded-full px-3 py-1 text-xs font-semibold capitalize transition"
                    style={{
                      background: customSev === s ? 'var(--brand)' : 'var(--surface)',
                      color:      customSev === s ? '#fff'         : 'var(--text)',
                      border:     '1px solid var(--border)',
                    }}
                  >
                    {SEV_EMOJI[s]}&nbsp;{s === 'med' ? 'Medium' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="label text-xs">Message</label>
              <textarea
                className="input mt-1 w-full resize-none py-2 text-sm"
                rows={3}
                placeholder="Type your alert message here…"
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
              />
            </div>

            {/* Optional chat_id override */}
            <div>
              <label className="label text-xs">Send to (optional Chat ID override)</label>
              <input
                className="input mt-1 w-full py-1.5 text-xs"
                placeholder="Leave blank to use configured Chat ID"
                value={customChatId}
                onChange={(e) => setCustomChatId(e.target.value)}
              />
            </div>

            {/* Status feedback */}
            {composerStatus === 'sent' && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-green-700"
                style={{ background: '#d1fae5' }}>
                <CheckCircle2 size={16} /> Sent to Telegram successfully!
              </div>
            )}
            {composerStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700"
                style={{ background: '#fee2e2' }}>
                <XCircle size={16} /> {composerError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => { setComposer(false); setCustomMsg(''); setComposerStatus('idle'); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex items-center gap-1.5"
                onClick={sendCustomMessage}
                disabled={composerStatus === 'sending' || !customMsg.trim()}
              >
                {composerStatus === 'sending'
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : <><Send size={14} /> Send to Telegram</>}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Live Alerts ──────────────────────────────────────────────────── */}
      <SectionCard title={<span className="flex items-center gap-1.5"><Bell size={15} /> Live Alerts</span>}>
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-lg p-3"
              style={{ background: 'var(--bg)' }}
            >
              <Badge tone={a.sev === 'high' ? 'high' : a.sev === 'med' ? 'med' : 'low'}>
                {a.type}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.text}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {a.time}{a.edition ? ` · ${a.edition}` : ''}
                </div>
              </div>
              {/* Telegram forward button */}
              <div className="flex-shrink-0 pt-0.5">
                <TgButton alert={a} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          Triggers: page delay · legal risk · fake-news flag · retirement reminder · missed trending story.
          &nbsp;Click <Send size={11} className="inline" /> on any alert to forward it to your Telegram channel instantly.
        </p>
      </SectionCard>

      {/* ── Telegram Send History (this session) ─────────────────────────── */}
      {tgLogs.length > 0 && (
        <SectionCard
          className="mt-4"
          title={<span className="flex items-center gap-1.5"><Send size={15} /> Telegram Send History</span>}
        >
          <div className="space-y-1.5">
            {tgLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: 'var(--bg)' }}
              >
                <CheckCircle2 size={14} className="flex-shrink-0 text-green-500" />
                <span className="flex-1 truncate text-xs">{log.text}</span>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--surface)', color: 'var(--muted)' }}
                >
                  {log.type}
                </span>
                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                  {log.time}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
