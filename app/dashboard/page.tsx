'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Device = { id: string; type: 'phone' | 'computer'; name: string; lastSeenAt: string | null };
type Room = { id: string; name: string; devices: Device[] };
type User = { id: string; username: string; displayName: string };
type Credential = { type: 'phone' | 'computer'; name: string; token: string; phoneUrl?: string; qr?: string };

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [locked, setLocked] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const meResponse = await fetch('/api/account/me', { cache: 'no-store' });
    if (meResponse.status === 401) { setLocked(true); return; }
    const me = await meResponse.json() as { role: string; user?: User };
    if (me.role === 'admin') { window.location.href = '/admin'; return; }
    const roomsResponse = await fetch('/api/account/rooms', { cache: 'no-store' });
    if (!roomsResponse.ok) { setLocked(true); return; }
    const data = await roomsResponse.json() as { rooms: Room[] };
    setUser(me.user ?? null);
    setRooms(data.rooms);
    setLocked(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoginError(false);
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!response.ok) { setLoginError(true); return; }
    setPassword(''); await load();
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    setUser(null); setRooms([]); setLocked(true);
  }

  async function addRoom(event: React.FormEvent) {
    event.preventDefault(); if (!roomName.trim() || busy) return;
    setBusy(true);
    await fetch('/api/account/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: roomName }) });
    setRoomName(''); await load(); setBusy(false);
  }

  async function addDevice(roomId: string, type: 'phone' | 'computer') {
    const name = window.prompt(type === 'phone' ? 'שם הטלפון או המשתמש' : 'שם המחשב');
    if (!name?.trim()) return;
    const response = await fetch('/api/account/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, type, name }) });
    if (!response.ok) return;
    const data = await response.json() as { device: Device; token: string };
    if (type === 'phone') {
      const phoneUrl = `${window.location.origin}/phone?token=${encodeURIComponent(data.token)}`;
      setCredential({ type, name, token: data.token, phoneUrl, qr: await QRCode.toDataURL(phoneUrl, { width: 320, margin: 2, color: { dark: '#11231f', light: '#ffffff' } }) });
    } else setCredential({ type, name, token: data.token });
    await load();
  }

  async function revoke(device: Device) {
    if (!window.confirm(`לבטל את הגישה של ${device.name}?`)) return;
    await fetch('/api/account/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id }) });
    await load();
  }

  return <main className="admin-shell" dir="rtl">
    <header className="admin-header">
      <Link className="brand" href="/"><span className="brand-mark"><span /><span /></span><span>WACopy</span></Link>
      <div className="account-heading"><span className="admin-kicker">האזור הפרטי שלי</span><h1>{user?.displayName || 'החדרים שלי'}</h1>{user && <button className="text-action" onClick={logout}>יציאה</button>}</div>
    </header>

    <section className="admin-create panel">
      <div><h2>יצירת חדר חדש</h2><p>רק אתם והמנהל יכולים לראות ולנהל את החדרים שלכם.</p></div>
      <form onSubmit={addRoom}><input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="שם החדר" maxLength={80} /><button className="send-button" disabled={!roomName.trim() || busy}>יצירת חדר</button></form>
    </section>

    <section className="rooms-grid">
      {rooms.map((room) => <article className="room-card panel" key={room.id}>
        <div className="room-title"><div><span>חדר פרטי</span><h2>{room.name}</h2></div><a className="browser-room-link" href={`/room?roomId=${encodeURIComponent(room.id)}`}>פתיחה בדפדפן</a></div>
        <div className="device-section">
          <div className="device-heading"><h3>טלפונים</h3><button onClick={() => addDevice(room.id, 'phone')}>+ הוספת טלפון</button></div>
          {room.devices.filter((device) => device.type === 'phone').map((device) => <div className="device-row" key={device.id}><span className="device-symbol">▯</span><strong>{device.name}</strong><button className="revoke" onClick={() => revoke(device)}>ביטול</button></div>)}
          {!room.devices.some((device) => device.type === 'phone') && <p className="empty-devices">עדיין לא חוברו טלפונים</p>}
        </div>
        <div className="device-section">
          <div className="device-heading"><h3>מחשבי Windows</h3><button onClick={() => addDevice(room.id, 'computer')}>+ הוספת מחשב</button></div>
          {room.devices.filter((device) => device.type === 'computer').map((device) => <div className="device-row" key={device.id}><span className="device-symbol">⊞</span><span><strong>{device.name}</strong><small>{device.lastSeenAt ? 'התחבר לאחרונה' : 'טרם התחבר'}</small></span><button className="revoke" onClick={() => revoke(device)}>ביטול</button></div>)}
          {!room.devices.some((device) => device.type === 'computer') && <p className="empty-devices">אפשר להשתמש בחדר בדפדפן גם ללא מחשב Windows</p>}
        </div>
      </article>)}
      {!rooms.length && !locked && <div className="admin-empty"><span>⌂</span><h2>עדיין אין חדרים</h2><p>צרו חדר ראשון וחברו אליו טלפון.</p></div>}
    </section>

    {credential && <div className="credential-overlay"><div className="credential-card">
      <button className="modal-close" onClick={() => setCredential(null)}>×</button>
      <span className="credential-type">{credential.type === 'phone' ? 'טלפון חדש' : 'מחשב חדש'}</span><h2>{credential.name}</h2>
      {/* QR is generated locally and does not use the framework image loader. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {credential.qr && <img src={credential.qr} alt={`QR עבור ${credential.name}`} />}
      <p>{credential.type === 'phone' ? 'סרקו את הקוד בטלפון. הקישור פרטי למכשיר הזה.' : 'הזינו את המפתח בהגדרות WACopy Connect במחשב.'}</p>
      <code>{credential.phoneUrl || credential.token}</code>
      <button className="send-button credential-copy" onClick={() => navigator.clipboard.writeText(credential.phoneUrl || credential.token)}>העתקה</button>
      <small>פרטי הגישה מוצגים פעם אחת בלבד.</small>
    </div></div>}

    {locked && <div className="login-screen"><form className="login-card" onSubmit={login}>
      <span className="brand-mark login-mark"><span /><span /></span><p className="login-eyebrow">אזור משתמש פרטי</p><h2>כניסה ל־WACopy</h2>
      <p>הזינו את שם המשתמש והסיסמה שקיבלתם מהמנהל.</p>
      <label htmlFor="user-name">שם משתמש</label><input id="user-name" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" dir="ltr" autoFocus />
      <label htmlFor="user-password" className="password-label">סיסמה</label><input id="user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
      {loginError && <span className="login-error">שם המשתמש או הסיסמה אינם נכונים</span>}
      <button className="send-button login-button" disabled={!username || !password}>כניסה</button>
    </form></div>}
  </main>;
}
