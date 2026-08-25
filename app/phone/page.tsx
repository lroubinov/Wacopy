'use client';

import { useEffect, useState } from 'react';

type Computer = { id: string; name: string; lastSeenAt: string | null };
type Context = { room: { id: string; name: string }; phone: { id: string; name: string }; computers: Computer[] };

export default function PhonePage() {
  const [token, setToken] = useState('');
  const [context, setContext] = useState<Context | null>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'sent' | 'invalid'>('loading');

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
    if (!text.trim() || !target) return;
    setState('sending');
    const response = await fetch('/api/phone/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetComputerId: target, text }) });
    if (!response.ok) { setState('ready'); return; }
    setText(''); setState('sent'); window.setTimeout(() => setState('ready'), 2200);
  }

  if (state === 'loading') return <main className="phone-shell"><div className="phone-loading">מתחבר לחדר הפרטי…</div></main>;
  if (state === 'invalid' || !context) return <main className="phone-shell"><div className="phone-invalid"><span>!</span><h1>הקישור אינו פעיל</h1><p>בקשו ממנהל המערכת ליצור QR חדש עבור הטלפון.</p></div></main>;

  return <main className="phone-shell" dir="rtl">
    <header className="phone-header"><a className="brand" href="#"><span className="brand-mark"><span /><span /></span><span>WACopy</span></a><span className="private-pill">חדר פרטי</span></header>
    <section className="phone-welcome"><span>שלום, {context.phone.name}</span><h1>{context.room.name}</h1><p>הדביקו את הטקסט ובחרו לאיזה מחשב לשלוח אותו.</p></section>
    <form className="phone-compose panel" onSubmit={send}>
      <label htmlFor="phone-target">מחשב יעד</label>
      <select id="phone-target" value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="browser">העתקה בדפדפן</option>
        {context.computers.map((computer) => <option key={computer.id} value={computer.id}>{computer.name}</option>)}
      </select>
      {!context.computers.length && <p className="no-computers">אין מחשב Windows מחובר — ניתן עדיין לשלוח לדפדפן.</p>}
      <label htmlFor="phone-text">הטקסט להעברה</label>
      <textarea id="phone-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="לחיצה ארוכה כאן כדי להדביק טקסט…" maxLength={20000} />
      <div className="phone-counter">{text.length.toLocaleString('he-IL')} / 20,000</div>
      <button className="send-button phone-send" disabled={!text.trim() || !target || state === 'sending'}>{state === 'sending' ? 'שולח…' : state === 'sent' ? 'נשלח בהצלחה ✓' : 'שליחה למחשב'}</button>
    </form>
    <footer><span>החיבור מוצפן</span><span>•</span><span>הטקסט נמחק לאחר ההדבקה</span></footer>
  </main>;
}
