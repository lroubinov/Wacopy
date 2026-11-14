'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Computer = { id: string; name: string; lastSeenAt: string | null };
type Context = { room: { id: string; name: string }; phone: { id: string; name: string }; computers: Computer[] };

export default function PhonePage() {
  const [token, setToken] = useState('');
  const [context, setContext] = useState<Context | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [convertImageToPdf, setConvertImageToPdf] = useState(false);
  const [target, setTarget] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'sent' | 'invalid'>('loading');
  const imagePreview = useMemo(() => file && file.type.startsWith('image/') ? URL.createObjectURL(file) : '', [file]);
  const isPdf = Boolean(file && (file.type === 'application/pdf' || file.name.toLocaleLowerCase('en-US').endsWith('.pdf')));
  const willSendPdf = isPdf || Boolean(imagePreview && convertImageToPdf);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function chooseFile(selected: File | null, convertByDefault = false) {
    const supported = selected && (['image/png', 'image/jpeg', 'application/pdf'].includes(selected.type) || selected.name.toLocaleLowerCase('en-US').endsWith('.pdf'));
    if (!selected || !supported || selected.size > 10 * 1024 * 1024) return;
    setFile(selected);
    setConvertImageToPdf(Boolean(selected.type.startsWith('image/') && convertByDefault));
    setText('');
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const supplied = params.get('token');
      const saved = supplied || window.localStorage.getItem('wacopy_phone_token') || '';
      if (supplied) {
        window.localStorage.setItem('wacopy_phone_token', supplied);
        window.history.replaceState({}, '', '/phone');
      }
      if (!saved) { setState('invalid'); return; }
      setToken(saved);
      fetch('/api/phone/context', { headers: { Authorization: `Bearer ${saved}` }, cache: 'no-store' }).then(async (response) => {
        if (!response.ok) { window.localStorage.removeItem('wacopy_phone_token'); setState('invalid'); return; }
        const data = await response.json() as Context;
        setContext(data);
        setTarget('browser');
        setState('ready');
      }).catch(() => setState('invalid'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if ((!text.trim() && !file) || !target) return;
    setState('sending');
    let response: Response;
    if (file) {
      const form = new FormData();
      form.set('targetComputerId', target);
      form.set('file', file);
      if (convertImageToPdf && !isPdf) form.set('convertToPdf', 'true');
      response = await fetch('/api/phone/send-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    } else {
      response = await fetch('/api/phone/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetComputerId: target, text }) });
    }
    if (!response.ok) { setState('ready'); return; }
    setText(''); setFile(null); setConvertImageToPdf(false); setState('sent'); window.setTimeout(() => setState('ready'), 2200);
  }

  if (state === 'loading') return <main className="phone-shell"><div className="phone-loading">מתחבר לחדר הפרטי…</div></main>;
  if (state === 'invalid' || !context) return <main className="phone-shell"><div className="phone-invalid"><span>!</span><h1>הקישור אינו פעיל</h1><p>בקשו ממנהל המערכת ליצור QR חדש עבור הטלפון.</p><Link className="send-button inline-link" href="/">חזרה לבחירת כניסה</Link></div></main>;

  return <main className="phone-shell" dir="rtl">
    <header className="phone-header"><Link className="brand" href="/"><span className="brand-mark"><span /><span /></span><span>WACopy</span></Link><span className="private-pill">חדר פרטי</span></header>
    <section className="phone-welcome"><span>שלום, {context.phone.name}</span><h1>{context.room.name}</h1><p>הדביקו טקסט או בחרו תמונה או PDF, ואז בחרו את יעד השליחה.</p></section>
    <form className="phone-compose panel" onSubmit={send}>
      <label htmlFor="phone-target">מחשב יעד</label>
      <select id="phone-target" value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="browser">העתקה בדפדפן</option>
        {context.computers.map((computer) => <option key={computer.id} value={computer.id}>{computer.name}</option>)}
      </select>
      {!context.computers.length && <p className="no-computers">אין מחשב Windows מחובר — ניתן עדיין לשלוח לדפדפן.</p>}
      <label htmlFor="phone-text">תוכן להעברה</label>
      <textarea id="phone-text" value={text} onChange={(event) => { setText(event.target.value); if (event.target.value) { setFile(null); setConvertImageToPdf(false); } }} onPaste={(event) => {
        const pasted = Array.from(event.clipboardData.items).find((item) => item.type === 'image/png' || item.type === 'image/jpeg')?.getAsFile();
        if (pasted) { event.preventDefault(); chooseFile(pasted); }
      }} placeholder="לחיצה ארוכה כאן כדי להדביק טקסט או תמונה…" maxLength={20000} />
      {imagePreview && <div className="phone-image-preview"><img src={imagePreview} alt="תמונה שנבחרה להעברה" />{convertImageToPdf && <span className="pdf-format-badge">יישלח כ־PDF</span>}<button type="button" onClick={() => { setFile(null); setConvertImageToPdf(false); }}>הסרת הקובץ</button></div>}
      {isPdf && file && <div className="phone-file-preview"><span>PDF</span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={() => { setFile(null); setConvertImageToPdf(false); }}>הסרה</button></div>}
      {imagePreview && <div className="phone-format-picker"><button type="button" className={convertImageToPdf ? '' : 'active'} onClick={() => setConvertImageToPdf(false)}>שליחה כתמונה</button><button type="button" className={convertImageToPdf ? 'active' : ''} onClick={() => setConvertImageToPdf(true)}>המרה ל־PDF</button></div>}
      <div className="phone-media-row"><span className="phone-counter">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${text.length.toLocaleString('he-IL')} / 20,000`}</span><div className="phone-file-actions"><label className="image-picker">צילום מסמך<input type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0] || null, true)} /></label><label className="image-picker">בחירת קובץ<input type="file" accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files?.[0] || null)} /></label></div></div>
      <p className="image-limit">PNG, JPEG או PDF, קובץ אחד, עד 10MB</p>
      <button className="send-button phone-send" disabled={(!text.trim() && !file) || !target || state === 'sending'}>{state === 'sending' ? (convertImageToPdf ? 'ממיר ושולח…' : 'שולח…') : state === 'sent' ? 'נשלח בהצלחה ✓' : willSendPdf ? 'שליחת ה־PDF' : file ? 'שליחת התמונה' : 'שליחת הטקסט'}</button>
    </form>
    <footer><span>החיבור מוצפן</span><span>•</span><span>התוכן נמחק לאחר ההדבקה</span></footer>
  </main>;
}
