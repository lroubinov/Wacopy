'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type BrowserMessage = { kind: 'text' | 'image' | null; id: string | null; text?: string; imageUrl?: string; mimeType?: string; updatedAt: string | null };

export default function BrowserRoomPage() {
  const roomIdRef = useRef('');
  const [message, setMessage] = useState<BrowserMessage>({ kind: null, id: null, text: '', updatedAt: null });
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

  async function imageAsPng(blob: Blob) {
    if (blob.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((png) => png ? resolve(png) : reject(new Error('Conversion failed')), 'image/png'));
  }

  async function copy() {
    if (!message.id) return;
    if (message.kind === 'image' && message.imageUrl) {
      const blob = await fetch(message.imageUrl, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Image not found');
        return response.blob();
      });
      const png = await imageAsPng(blob);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    } else if (message.kind === 'text' && message.text) {
      await navigator.clipboard.writeText(message.text);
    } else return;
    await fetch(`/api/account/browser?roomId=${encodeURIComponent(roomIdRef.current)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: message.id }) });
    setState('copied'); setMessage({ kind: null, id: null, text: '', updatedAt: null });
    window.setTimeout(() => setState('ready'), 1800);
  }

  if (state === 'locked') return <main className="phone-shell" dir="rtl"><div className="phone-invalid"><span>!</span><h1>אין גישה לחדר</h1><p>התחברו לחשבון המתאים דרך אזור המשתמש.</p><Link className="send-button inline-link" href="/dashboard">כניסה לאזור המשתמש</Link></div></main>;

  return <main className="browser-receiver" dir="rtl">
    <header className="phone-header"><Link className="brand" href="/dashboard"><span className="brand-mark"><span /><span /></span><span>WACopy</span></Link><span className="private-pill">תצוגת דפדפן פרטית</span></header>
    <section className="browser-receiver-card panel">
      <span className="browser-symbol">▣</span><h1>תוכן שהתקבל בחדר</h1><p>{message.updatedAt ? (message.kind === 'image' ? 'התמונה התקבלה ומוכנה להעתקה' : 'הטקסט התקבל ומוכן להעתקה') : 'ממתין לתוכן מהטלפון…'}</p>
      {message.kind === 'image' && message.imageUrl ? <div className="received-image"><img src={message.imageUrl} alt="תמונה שהתקבלה" /></div> : <div className={`received-text ${message.text ? '' : 'empty'}`}>{message.text || 'בטלפון בחרו יעד: העתקה בדפדפן'}</div>}
      <button className="copy-button" onClick={copy} disabled={!message.id}>{state === 'copied' ? 'הועתק ללוח ✓' : message.kind === 'image' ? 'העתקת התמונה' : 'העתקת הטקסט'}</button>
    </section>
    <footer><span>רק בעל החדר והמנהל מורשים לגשת</span><span>•</span><span>התוכן נמחק לאחר ההעתקה</span></footer>
  </main>;
}
