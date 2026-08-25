'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type BrowserMessage = { id: string | null; text: string; updatedAt: string | null };

export default function BrowserRoomPage() {
  const roomIdRef = useRef('');
  const [message, setMessage] = useState<BrowserMessage>({ id: null, text: '', updatedAt: null });
  const [state, setState] = useState<'loading' | 'ready' | 'locked' | 'copied'>('loading');

  const refresh = useCallback(async (id: string) => {
    const response = await fetch(`/api/account/browser?roomId=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) { setState('locked'); return; }
    setMessage(await response.json() as BrowserMessage);
    setState((current) => current === 'copied' ? current : 'ready');
  }, []);

  useEffect(() => {
    let pollTimer: number | undefined;
    const startTimer = window.setTimeout(() => {
      const id = new URLSearchParams(window.location.search).get('roomId') || '';
      roomIdRef.current = id;
      if (!id) { setState('locked'); return; }
      void refresh(id);
      pollTimer = window.setInterval(() => void refresh(id), 900);
    }, 0);
    return () => { window.clearTimeout(startTimer); if (pollTimer) window.clearInterval(pollTimer); };
  }, [refresh]);

  async function copy() {
    if (!message.id || !message.text) return;
    await navigator.clipboard.writeText(message.text);
    await fetch(`/api/account/browser?roomId=${encodeURIComponent(roomIdRef.current)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: message.id }) });
    setState('copied'); setMessage({ id: null, text: '', updatedAt: null });
    window.setTimeout(() => setState('ready'), 1800);
  }

  if (state === 'locked') return <main className="phone-shell" dir="rtl"><div className="phone-invalid"><span>!</span><h1>אין גישה לחדר</h1><p>התחברו לחשבון המתאים דרך אזור המשתמש.</p><Link className="send-button inline-link" href="/dashboard">כניסה לאזור המשתמש</Link></div></main>;

  return <main className="browser-receiver" dir="rtl">
    <header className="phone-header"><Link className="brand" href="/dashboard"><span className="brand-mark"><span /><span /></span><span>WACopy</span></Link><span className="private-pill">תצוגת דפדפן פרטית</span></header>
    <section className="browser-receiver-card panel">
      <span className="browser-symbol">▣</span><h1>טקסט שהתקבל בחדר</h1><p>{message.updatedAt ? 'הטקסט התקבל ומוכן להעתקה' : 'ממתין לטקסט מהטלפון…'}</p>
      <div className={`received-text ${message.text ? '' : 'empty'}`}>{message.text || 'בטלפון בחרו יעד: העתקה בדפדפן'}</div>
      <button className="copy-button" onClick={copy} disabled={!message.text}>{state === 'copied' ? 'הועתק ללוח ✓' : 'העתקת הטקסט'}</button>
    </section>
    <footer><span>רק בעל החדר והמנהל מורשים לגשת</span><span>•</span><span>הטקסט נמחק לאחר ההעתקה</span></footer>
  </main>;
}
