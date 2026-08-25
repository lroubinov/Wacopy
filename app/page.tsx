'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SharedText = { text: string; updatedAt: string | null; version: number };
const EMPTY_STATE: SharedText = { text: '', updatedAt: null, version: 0 };

function formatTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function Home() {
  const [draft, setDraft] = useState('');
  const [shared, setShared] = useState<SharedText>(EMPTY_STATE);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const versionRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/text', { cache: 'no-store' });
      if (response.status === 401) {
        setLocked(true);
        setConnection('offline');
        return;
      }
      if (!response.ok) throw new Error('Connection failed');
      const data = (await response.json()) as SharedText;
      if (data.version !== versionRef.current) {
        versionRef.current = data.version;
        setShared(data);
      }
      setConnection('connected');
      setLocked(false);
    } catch {
      setConnection('offline');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 900);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  async function sendText() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSent(false);
    try {
      const response = await fetch('/api/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('Send failed');
      const data = (await response.json()) as SharedText;
      versionRef.current = data.version;
      setShared(data);
      setConnection('connected');
      setSent(true);
      window.setTimeout(() => setSent(false), 2200);
    } catch {
      setConnection('offline');
    } finally {
      setSending(false);
    }
  }

  async function copyText() {
    if (!shared.text) return;
    await navigator.clipboard.writeText(shared.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setLoginError(false);
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      setPassword('');
      setLocked(false);
      await refresh();
    } else {
      setLoginError(true);
    }
    setLoggingIn(false);
  }

  return (
    <main className="app-shell" dir="rtl">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="דף הבית">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span>מעבירון</span>
        </a>
        <div className="top-actions"><a className="admin-link" href="/dashboard">כניסת משתמש</a><a className="admin-link" href="/admin">ניהול מנהל</a><div className={`connection ${connection}`} role="status">
          <span className="connection-dot" />
          {connection === 'connected' ? 'מחובר ומסונכרן' : connection === 'offline' ? 'אין חיבור' : 'מתחבר...'}
        </div></div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> העברה מיידית בין הטלפון למחשב</div>
        <h1>מדביקים בטלפון.<br /><em>מעתיקים במחשב.</em></h1>
        <p className="lead">בלי לשלוח לעצמך הודעות ובלי לחפש קבצים. פשוט מדביקים את הטקסט כאן — והוא מחכה לך מיד בצד השני.</p>
      </section>

      <section className="mode-picker" aria-label="בחירת אופן השימוש">
        <button className="mode-option active" aria-pressed="true">
          <span className="mode-icon">▣</span>
          <span><strong>העתקה רגילה</strong><small>פותחים בדפדפן ומעתיקים</small></span>
          <span className="mode-check">✓</span>
        </button>
        <a className="mode-option" href="/dashboard">
          <span className="mode-icon windows-icon">⊞</span>
          <span><strong>הדבקה ל־Windows</strong><small>קיצור מקשים בכל תוכנה</small></span>
          <span className="mode-check">✓</span>
        </a>
      </section>

      <section className="workspace" aria-label="העברת טקסט">
        <article className="panel compose-panel">
          <div className="step-heading">
            <span className="step-number">1</span>
            <div><h2>הדביקו את הטקסט</h2><p>הדביקו כאן כל טקסט שתרצו להעביר</p></div>
          </div>
          <label className="sr-only" htmlFor="text-input">טקסט להעברה</label>
          <textarea id="text-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="לחיצה ארוכה כאן כדי להדביק..." maxLength={20000} />
          <div className="compose-footer">
            <span className="counter">{draft.length.toLocaleString('he-IL')} / 20,000</span>
            <button className="send-button" onClick={sendText} disabled={!draft.trim() || sending}>
              <span>{sending ? 'שולח...' : sent ? 'נשלח בהצלחה' : 'העברה למחשב'}</span>
              <span className="arrow" aria-hidden="true">←</span>
            </button>
          </div>
        </article>

        <div className="transfer-line" aria-hidden="true"><span className="line" /><span className="transfer-icon">↔</span><span className="line" /></div>

        <article className="panel receive-panel">
          <div className="step-heading">
            <span className="step-number">2</span>
            <div><h2>הטקסט האחרון</h2><p>{shared.updatedAt ? `התקבל בשעה ${formatTime(shared.updatedAt)}` : 'ממתין לטקסט מהטלפון'}</p></div>
          </div>
          <div className={`received-text ${shared.text ? '' : 'empty'}`} aria-live="polite">{shared.text || 'הטקסט שיועבר יופיע כאן באופן אוטומטי'}</div>
          <button className="copy-button" onClick={copyText} disabled={!shared.text}>
            <span className="copy-icon" aria-hidden="true">▣</span>{copied ? 'הועתק ללוח!' : 'העתקת הטקסט'}
          </button>
        </article>
      </section>

      <footer><span>הטקסט נשמר רק בזיכרון המקומי של המחשב</span><span className="footer-dot">•</span><span>העמוד מתעדכן אוטומטית</span></footer>

      {locked && (
        <div className="login-screen">
          <form className="login-card" onSubmit={login}>
            <span className="brand-mark login-mark" aria-hidden="true"><span /><span /></span>
            <p className="login-eyebrow">גישה מאובטחת</p>
            <h2>כניסה למעבירון</h2>
            <p>הזינו את הסיסמה המשותפת כדי להציג ולהעביר טקסט.</p>
            <label htmlFor="password">סיסמה</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
            {loginError && <span className="login-error" role="alert">הסיסמה אינה נכונה</span>}
            <button className="send-button login-button" disabled={!password || loggingIn}>{loggingIn ? 'מתחבר...' : 'כניסה'}</button>
          </form>
        </div>
      )}
    </main>
  );
}
