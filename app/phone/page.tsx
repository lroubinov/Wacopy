'use client';

import { useEffect, useMemo, useState } from 'react';

type Computer = { id: string; name: string; lastSeenAt: string | null };
type Context = { room: { id: string; name: string }; phone: { id: string; name: string }; computers: Computer[] };

export default function PhonePage() {
  const [token, setToken] = useState('');
  const [context, setContext] = useState<Context | null>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [target, setTarget] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'sent' | 'invalid'>('loading');
  const imagePreview = useMemo(() => image ? URL.createObjectURL(image) : '', [image]);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function chooseImage(file: File | null) {
    if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) return;
    setImage(file);
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
        if (!response.ok) { setState('invalid'); return; }
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
    if ((!text.trim() && !image) || !target) return;
    setState('sending');
    let response: Response;
    if (image) {
      const form = new FormData();
      form.set('targetComputerId', target);
      form.set('image', image);
      response = await fetch('/api/phone/send-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    } else {
      response = await fetch('/api/phone/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetComputerId: target, text }) });
    }
    if (!response.ok) { setState('ready'); return; }
    setText(''); setImage(null); setState('sent'); window.setTimeout(() => setState('ready'), 2200);
  }

  if (state === 'loading') return <main className="phone-shell"><div className="phone-loading">מתחבר לחדר הפרטי…</div></main>;
  if (state === 'invalid' || !context) return <main className="phone-shell"><div className="phone-invalid"><span>!</span><h1>הקישור אינו פעיל</h1><p>בקשו ממנהל המערכת ליצור QR חדש עבור הטלפון.</p></div></main>;

  return <main className="phone-shell" dir="rtl">
    <header className="phone-header"><a className="brand" href="#"><span className="brand-mark"><span /><span /></span><span>WACopy</span></a><span className="private-pill">חדר פרטי</span></header>
    <section className="phone-welcome"><span>שלום, {context.phone.name}</span><h1>{context.room.name}</h1><p>הדביקו טקסט או תמונה ובחרו את יעד השליחה.</p></section>
    <form className="phone-compose panel" onSubmit={send}>
      <label htmlFor="phone-target">מחשב יעד</label>
      <select id="phone-target" value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="browser">העתקה בדפדפן</option>
        {context.computers.map((computer) => <option key={computer.id} value={computer.id}>{computer.name}</option>)}
      </select>
      {!context.computers.length && <p className="no-computers">אין מחשב Windows מחובר — ניתן עדיין לשלוח לדפדפן.</p>}
      <label htmlFor="phone-text">תוכן להעברה</label>
      <textarea id="phone-text" value={text} onChange={(event) => { setText(event.target.value); if (event.target.value) setImage(null); }} onPaste={(event) => {
        const pasted = Array.from(event.clipboardData.items).find((item) => item.type === 'image/png' || item.type === 'image/jpeg')?.getAsFile();
        if (pasted) { event.preventDefault(); chooseImage(pasted); }
      }} placeholder="לחיצה ארוכה כאן כדי להדביק טקסט או תמונה…" maxLength={20000} />
      {imagePreview && <div className="phone-image-preview"><img src={imagePreview} alt="תמונה שנבחרה להעברה" /><button type="button" onClick={() => setImage(null)}>הסרת התמונה</button></div>}
      <div className="phone-media-row"><span className="phone-counter">{image ? `${(image.size / 1024 / 1024).toFixed(1)} MB` : `${text.length.toLocaleString('he-IL')} / 20,000`}</span><label className="image-picker">בחירת תמונה<input type="file" accept="image/png,image/jpeg" onChange={(event) => chooseImage(event.target.files?.[0] || null)} /></label></div>
      <p className="image-limit">PNG או JPEG, תמונה אחת, עד 10MB</p>
      <button className="send-button phone-send" disabled={(!text.trim() && !image) || !target || state === 'sending'}>{state === 'sending' ? 'שולח…' : state === 'sent' ? 'נשלח בהצלחה ✓' : image ? 'שליחת התמונה' : 'שליחת הטקסט'}</button>
    </form>
    <footer><span>החיבור מוצפן</span><span>•</span><span>התוכן נמחק לאחר ההדבקה</span></footer>
  </main>;
}
