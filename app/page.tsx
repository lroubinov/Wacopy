'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const suppliedToken = new URLSearchParams(window.location.search).get('token');
      if (suppliedToken) {
        window.location.replace(`/phone?token=${encodeURIComponent(suppliedToken)}`);
        return;
      }
      const savedToken = window.localStorage.getItem('wacopy_phone_token');
      const looksLikePhone = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100;
      if (savedToken && looksLikePhone) {
        window.location.replace('/phone');
        return;
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="entry-shell" dir="rtl">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="entry-header">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span>WACopy</span>
        </span>
      </header>

      <section className="entry-hero">
        <span className="entry-kicker">העברה פרטית בין הטלפון למחשב</span>
        <h1>איך תרצו להיכנס?</h1>
        <p>בחרו את סוג הכניסה. אין יותר סיסמה כללית בכניסה לאתר.</p>
      </section>

      <section className={`entry-options ${ready ? 'ready' : ''}`} aria-label="אפשרויות כניסה">
        <a className="entry-card entry-primary" href="/phone">
          <span className="entry-icon">▯</span>
          <span><strong>הטלפון שלי</strong><small>פתיחת החדר שכבר חובר באמצעות QR</small></span>
          <b>←</b>
        </a>
        <a className="entry-card" href="/dashboard">
          <span className="entry-icon">◎</span>
          <span><strong>כניסת משתמש</strong><small>שם המשתמש והסיסמה שקיבלתם מהמנהל</small></span>
          <b>←</b>
        </a>
        <a className="entry-card" href="/admin">
          <span className="entry-icon">⚙</span>
          <span><strong>כניסת מנהל</strong><small>סיסמת המנהל שהוגדרה ב־Synology</small></span>
          <b>←</b>
        </a>
      </section>

      <p className="entry-help">טלפון חדש? סרקו פעם אחת את ה־QR שמופיע בחדר. לאחר מכן הכתובת הראשית תפתח אותו אוטומטית.</p>
    </main>
  );
}
