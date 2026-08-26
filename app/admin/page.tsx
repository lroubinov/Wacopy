'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Device = { id: string; type: 'phone' | 'computer'; name: string; lastSeenAt: string | null };
type Room = { id: string; name: string; createdAt: string; ownerName: string | null; ownerUsername: string | null; devices: Device[] };
type User = { id: string; username: string; displayName: string; roomCount: number };
type Credential = { type: 'phone' | 'computer' | 'user'; name: string; token: string; username?: string; phoneUrl?: string; qr?: string };

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRooms = useCallback(async () => {
    const response = await fetch('/api/admin/rooms', { cache: 'no-store' });
    if (response.status === 401) { setLocked(true); return; }
    const data = await response.json() as { rooms: Room[] };
    setRooms(data.rooms);
    const usersResponse = await fetch('/api/admin/users', { cache: 'no-store' });
    if (usersResponse.ok) setUsers(((await usersResponse.json()) as { users: User[] }).users);
    setLocked(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRooms(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRooms]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (response.ok) { setPassword(''); await loadRooms(); }
  }

  async function addRoom(event: React.FormEvent) {
    event.preventDefault();
    if (!roomName.trim() || busy) return;
    setBusy(true);
    await fetch('/api/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: roomName }) });
    setRoomName('');
    await loadRooms();
    setBusy(false);
  }

  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim() || newUserPassword.length < 8 || busy) return;
    setBusy(true);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUsername, displayName: newDisplayName, password: newUserPassword }) });
    if (response.ok) {
      const data = await response.json() as { user: User };
      setCredential({ type: 'user', name: data.user.displayName, username: data.user.username, token: newUserPassword });
      setNewUsername(''); setNewDisplayName(''); setNewUserPassword('');
      await loadRooms();
    }
    setBusy(false);
  }

  async function saveResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!resetUser || resetPassword.length < 8) { setResetError(true); return; }
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: resetUser.id, password: resetPassword }) });
    if (!response.ok) { setResetError(true); return; }
    setResetUser(null); setResetPassword(''); setResetError(false);
  }

  async function removeRoom(room: Room) {
    if (!window.confirm(`למחוק לצמיתות את החדר ${room.name} ואת כל המכשירים והתכנים שבו?`)) return;
    await fetch('/api/admin/rooms', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id }) });
    await loadRooms();
  }

  async function removeUser(user: User) {
    if (!window.confirm(`לבטל את המשתמש ${user.displayName} ואת הגישה לכל החדרים שלו?`)) return;
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    await loadRooms();
  }

  async function addDevice(roomId: string, type: 'phone' | 'computer') {
    const label = type === 'phone' ? 'שם הטלפון או המשתמש' : 'שם המחשב';
    const name = window.prompt(label);
    if (!name?.trim()) return;
    const response = await fetch('/api/admin/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, type, name }) });
    if (!response.ok) return;
    const data = await response.json() as { device: Device; token: string };
    if (type === 'phone') {
      const phoneUrl = `${window.location.origin}/phone?token=${encodeURIComponent(data.token)}`;
      setCredential({ type, name, token: data.token, phoneUrl, qr: await QRCode.toDataURL(phoneUrl, { width: 320, margin: 2, color: { dark: '#11231f', light: '#ffffff' } }) });
    } else {
      setCredential({ type, name, token: data.token });
    }
    await loadRooms();
  }

  async function revoke(device: Device) {
    if (!window.confirm(`לבטל את הגישה של ${device.name}?`)) return;
    await fetch('/api/admin/devices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id }) });
    await loadRooms();
  }

  return (
    <main className="admin-shell" dir="rtl">
      <header className="admin-header">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><span /><span /></span><span>WACopy</span></Link>
        <div><span className="admin-kicker">ניהול מערכת</span><h1>חדרים ומכשירים</h1></div>
      </header>

      <section className="admin-users panel">
        <div className="section-title"><div><h2>משתמשים</h2><p>כל משתמש מקבל אזור פרטי ויכול ליצור ולנהל רק את החדרים שלו.</p></div></div>
        <form className="user-create-form" onSubmit={addUser}>
          <input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="שם לתצוגה" maxLength={80} />
          <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="שם משתמש באנגלית" maxLength={40} dir="ltr" />
          <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="סיסמה — לפחות 8 תווים" minLength={8} maxLength={128} dir="ltr" autoComplete="new-password" />
          <button className="send-button" disabled={!newDisplayName.trim() || !newUsername.trim() || newUserPassword.length < 8 || busy}>יצירת משתמש</button>
        </form>
        <div className="users-list">
          {users.map((user) => <div className="user-row" key={user.id}><span className="user-avatar">{user.displayName.slice(0, 1)}</span><span><strong>{user.displayName}</strong><small>{user.username} · {user.roomCount} חדרים</small></span><div className="user-actions"><button className="text-action" onClick={() => { setResetUser(user); setResetPassword(''); setResetError(false); }}>שינוי סיסמה</button><button className="revoke" onClick={() => removeUser(user)}>ביטול משתמש</button></div></div>)}
          {!users.length && <p className="empty-devices">עדיין לא נוצרו משתמשים</p>}
        </div>
      </section>

      <section className="admin-create panel">
        <div><h2>יצירת חדר פרטי</h2><p>כל חדר מבודד לחלוטין ויכול להכיל מספר טלפונים ומחשבים.</p></div>
        <form onSubmit={addRoom}><input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="לדוגמה: ד״ר ישראלי" maxLength={80} /><button className="send-button" disabled={!roomName.trim() || busy}>יצירת חדר</button></form>
      </section>

      <section className="rooms-grid">
        {rooms.map((room) => (
          <article className="room-card panel" key={room.id}>
            <div className="room-title"><div><span>{room.ownerName ? `${room.ownerName} · ${room.ownerUsername}` : 'חדר מנהל'}</span><h2>{room.name}</h2></div><div className="room-actions"><Link className="browser-room-link" href={`/room?roomId=${room.id}`}>דפדפן</Link><button className="delete-room" onClick={() => removeRoom(room)}>מחיקת חדר</button><span className="device-count">{room.devices.length} מכשירים</span></div></div>
            <div className="device-section">
              <div className="device-heading"><h3>טלפונים</h3><button onClick={() => addDevice(room.id, 'phone')}>+ הוספת טלפון</button></div>
              {room.devices.filter((device) => device.type === 'phone').map((device) => <div className="device-row" key={device.id}><span className="device-symbol">▯</span><strong>{device.name}</strong><button className="revoke" onClick={() => revoke(device)}>ביטול</button></div>)}
              {!room.devices.some((device) => device.type === 'phone') && <p className="empty-devices">עדיין לא חוברו טלפונים</p>}
            </div>
            <div className="device-section">
              <div className="device-heading"><h3>מחשבים</h3><button onClick={() => addDevice(room.id, 'computer')}>+ הוספת מחשב</button></div>
              {room.devices.filter((device) => device.type === 'computer').map((device) => <div className="device-row" key={device.id}><span className="device-symbol">⊞</span><span><strong>{device.name}</strong><small>{device.lastSeenAt ? 'מחובר לאחרונה' : 'טרם התחבר'}</small></span><button className="revoke" onClick={() => revoke(device)}>ביטול</button></div>)}
              {!room.devices.some((device) => device.type === 'computer') && <p className="empty-devices">עדיין לא חוברו מחשבים</p>}
            </div>
          </article>
        ))}
        {!rooms.length && <div className="admin-empty"><span>⌂</span><h2>עדיין אין חדרים</h2><p>צרו את החדר הראשון כדי להתחיל לחבר טלפונים ומחשבים.</p></div>}
      </section>

      {credential && <div className="credential-overlay"><div className="credential-card">
        <button className="modal-close" onClick={() => setCredential(null)}>×</button>
        <span className="credential-type">{credential.type === 'phone' ? 'טלפון חדש' : credential.type === 'computer' ? 'מחשב חדש' : 'משתמש חדש'}</span><h2>{credential.name}</h2>
        {/* QR is generated locally as a data URL and cannot use the framework image loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {credential.qr && <img src={credential.qr} alt={`QR עבור ${credential.name}`} />}
        {credential.phoneUrl && <p>סרקו את הקוד בטלפון. הקישור פרטי ומיועד למכשיר הזה בלבד.</p>}
        {credential.type === 'computer' && <p>העתיקו את המפתח והזינו אותו בהגדרות WACopy Connect במחשב.</p>}
        {credential.type === 'user' && <p>מסרו למשתמש את פרטי הכניסה הבאים. הסיסמה מוצגת פעם אחת בלבד.</p>}
        {credential.type === 'user' && <code>שם משתמש: {credential.username}<br />סיסמה: {credential.token}</code>}
        {credential.type !== 'user' && <code>{credential.type === 'phone' ? credential.phoneUrl : credential.token}</code>}
        <button className="send-button credential-copy" onClick={() => navigator.clipboard.writeText(credential.type === 'user' ? `שם משתמש: ${credential.username}\nסיסמה: ${credential.token}` : credential.type === 'phone' ? credential.phoneUrl! : credential.token)}>העתקה</button>
        <small>פרטי הגישה מוצגים פעם אחת בלבד. במקרה הצורך ניתן לבטל וליצור מחדש.</small>
      </div></div>}

      {resetUser && <div className="credential-overlay"><form className="credential-card reset-card" onSubmit={saveResetPassword}>
        <button type="button" className="modal-close" onClick={() => setResetUser(null)}>×</button>
        <span className="credential-type">שינוי סיסמה</span><h2>{resetUser.displayName}</h2>
        <p>הגדירו סיסמה חדשה באורך 8 תווים לפחות.</p>
        <label htmlFor="reset-password">סיסמה חדשה</label>
        <input id="reset-password" type="password" value={resetPassword} onChange={(event) => { setResetPassword(event.target.value); setResetError(false); }} minLength={8} maxLength={128} autoComplete="new-password" autoFocus />
        {resetError && <span className="login-error">הסיסמה חייבת להכיל לפחות 8 תווים</span>}
        <button className="send-button credential-copy" disabled={resetPassword.length < 8}>שמירת הסיסמה</button>
      </form></div>}

      {locked && <div className="login-screen"><form className="login-card" onSubmit={login}><span className="brand-mark login-mark"><span /><span /></span><p className="login-eyebrow">גישה למנהל</p><h2>כניסה לניהול</h2><p>הזינו את סיסמת המנהל של WACopy.</p><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /><button className="send-button login-button">כניסה</button></form></div>}
    </main>
  );
}
