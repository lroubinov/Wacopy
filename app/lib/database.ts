import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type DeviceType = 'phone' | 'computer';
export type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
};
type DatabaseGlobal = typeof globalThis & { wacopyDatabase?: DatabaseSync };

function openDatabase() {
  const configuredPath = process.env.WACOPY_DB_PATH || (process.env.NODE_ENV === 'production' ? './data/wacopy.db' : ':memory:');
  const databasePath = configuredPath === ':memory:' ? configuredPath : resolve(configuredPath);
  if (databasePath !== ':memory:' && !existsSync(dirname(databasePath))) mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath, { timeout: 5000 });
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_norm TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    ) STRICT
  `);
  const roomColumns = database.prepare('PRAGMA table_info(rooms)').all() as Array<{ name: string }>;
  if (!roomColumns.some((column) => column.name === 'owner_user_id')) {
    database.exec('ALTER TABLE rooms ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE');
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('phone', 'computer')),
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT,
      revoked_at TEXT
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      phone_id TEXT NOT NULL REFERENCES devices(id),
      target_computer_id TEXT NOT NULL REFERENCES devices(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      pasted_at TEXT
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS browser_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      phone_id TEXT NOT NULL REFERENCES devices(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      copied_at TEXT
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS image_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      phone_id TEXT NOT NULL REFERENCES devices(id),
      target_kind TEXT NOT NULL CHECK(target_kind IN ('browser', 'computer')),
      target_computer_id TEXT REFERENCES devices(id),
      file_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png', 'image/jpeg')),
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    ) STRICT
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS file_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      phone_id TEXT NOT NULL REFERENCES devices(id),
      target_kind TEXT NOT NULL CHECK(target_kind IN ('browser', 'computer')),
      target_computer_id TEXT REFERENCES devices(id),
      file_name TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL CHECK(mime_type = 'application/pdf'),
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    ) STRICT
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_user_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_devices_room_type ON devices(room_id, type)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_messages_target_pending ON messages(target_computer_id, pasted_at, expires_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_browser_messages_room_pending ON browser_messages(room_id, copied_at, expires_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_image_messages_computer_pending ON image_messages(target_computer_id, consumed_at, expires_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_image_messages_browser_pending ON image_messages(room_id, target_kind, consumed_at, expires_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_file_messages_computer_pending ON file_messages(target_computer_id, consumed_at, expires_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_file_messages_browser_pending ON file_messages(room_id, target_kind, consumed_at, expires_at)');
  database.exec('PRAGMA optimize');
  return database;
}

export function db() {
  const shared = globalThis as DatabaseGlobal;
  shared.wacopyDatabase ??= openDatabase();
  return shared.wacopyDatabase;
}

function roomsWithDevices(where = '', value?: string) {
  const rooms = db().prepare(`
    SELECT rooms.id, rooms.name, rooms.owner_user_id AS ownerUserId, rooms.created_at AS createdAt,
           users.display_name AS ownerName, users.username AS ownerUsername
    FROM rooms LEFT JOIN users ON users.id = rooms.owner_user_id
    ${where} ORDER BY rooms.created_at DESC
  `).all(...(value ? [value] : [])) as Array<Record<string, unknown>>;
  const deviceQuery = db().prepare(`
    SELECT id, room_id AS roomId, type, name, created_at AS createdAt, last_seen_at AS lastSeenAt
    FROM devices WHERE room_id = ? AND revoked_at IS NULL ORDER BY type, created_at
  `);
  return rooms.map((room) => ({ ...room, devices: deviceQuery.all(room.id as string) }));
}

export function listRooms() {
  return roomsWithDevices();
}

export function listRoomsForUser(userId: string) {
  return roomsWithDevices('WHERE rooms.owner_user_id = ?', userId);
}

export function createRoom(name: string, ownerUserId: string | null = null) {
  const room = { id: crypto.randomUUID(), name: name.trim(), ownerUserId, createdAt: new Date().toISOString() };
  db().prepare('INSERT INTO rooms(id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)').run(room.id, room.name, room.ownerUserId, room.createdAt);
  return room;
}

export function deleteRoom(roomId: string) {
  const result = db().prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
  return result.changes > 0;
}

export function transferFilesForRoom(roomId: string) {
  return db().prepare(`
    SELECT file_name AS fileName FROM image_messages WHERE room_id = ?
    UNION ALL
    SELECT file_name AS fileName FROM file_messages WHERE room_id = ?
  `).all(roomId, roomId) as Array<{ fileName: string }>;
}

export function roomBelongsToUser(roomId: string, userId: string) {
  return Boolean(db().prepare('SELECT id FROM rooms WHERE id = ? AND owner_user_id = ?').get(roomId, userId));
}

export function roomExists(roomId: string) {
  return Boolean(db().prepare('SELECT id FROM rooms WHERE id = ?').get(roomId));
}

export function createUser(username: string, displayName: string, passwordSalt: string, passwordHash: string) {
  const user = { id: crypto.randomUUID(), username: username.trim(), displayName: displayName.trim(), createdAt: new Date().toISOString() };
  db().prepare(`
    INSERT INTO users(id, username, username_norm, display_name, password_salt, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.username, user.username.toLocaleLowerCase('en-US'), user.displayName, passwordSalt, passwordHash, user.createdAt);
  return user;
}

export function listUsers() {
  return db().prepare(`
    SELECT users.id, users.username, users.display_name AS displayName, users.created_at AS createdAt,
           COUNT(rooms.id) AS roomCount
    FROM users LEFT JOIN rooms ON rooms.owner_user_id = users.id
    WHERE users.revoked_at IS NULL
    GROUP BY users.id ORDER BY users.created_at DESC
  `).all();
}

export function findUserByUsername(username: string) {
  return db().prepare(`
    SELECT id, username, display_name AS displayName, password_salt AS passwordSalt, password_hash AS passwordHash
    FROM users WHERE username_norm = ? AND revoked_at IS NULL
  `).get(username.trim().toLocaleLowerCase('en-US')) as UserRecord | undefined;
}

export function findActiveUserById(userId: string) {
  return db().prepare(`
    SELECT id, username, display_name AS displayName, password_salt AS passwordSalt, password_hash AS passwordHash
    FROM users WHERE id = ? AND revoked_at IS NULL
  `).get(userId) as UserRecord | undefined;
}

export function revokeUser(userId: string) {
  const result = db().prepare('UPDATE users SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(new Date().toISOString(), userId);
  return result.changes > 0;
}

export function updateUserPassword(userId: string, passwordSalt: string, passwordHash: string) {
  const result = db().prepare(`
    UPDATE users SET password_salt = ?, password_hash = ?
    WHERE id = ? AND revoked_at IS NULL
  `).run(passwordSalt, passwordHash, userId);
  return result.changes > 0;
}

export function createDevice(roomId: string, type: DeviceType, name: string, tokenHash: string) {
  const device = { id: crypto.randomUUID(), roomId, type, name: name.trim(), createdAt: new Date().toISOString() };
  db().prepare(`
    INSERT INTO devices(id, room_id, type, name, token_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(device.id, roomId, type, device.name, tokenHash, device.createdAt);
  return device;
}

export function revokeDevice(deviceId: string) {
  const result = db().prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(new Date().toISOString(), deviceId);
  return result.changes > 0;
}

export function deviceBelongsToUser(deviceId: string, userId: string) {
  return Boolean(db().prepare(`
    SELECT devices.id FROM devices JOIN rooms ON rooms.id = devices.room_id
    WHERE devices.id = ? AND rooms.owner_user_id = ?
  `).get(deviceId, userId));
}

export function findDeviceByTokenHash(tokenHash: string, type: DeviceType) {
  const device = db().prepare(`
    SELECT id, room_id AS roomId, type, name FROM devices
    WHERE token_hash = ? AND type = ? AND revoked_at IS NULL
  `).get(tokenHash, type) as { id: string; roomId: string; type: DeviceType; name: string } | undefined;
  if (device) db().prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), device.id);
  return device;
}

export function phoneContext(phoneId: string, roomId: string) {
  const room = db().prepare('SELECT id, name FROM rooms WHERE id = ?').get(roomId) as { id: string; name: string } | undefined;
  const phone = db().prepare('SELECT id, name FROM devices WHERE id = ?').get(phoneId) as { id: string; name: string } | undefined;
  const computers = db().prepare(`
    SELECT id, name, last_seen_at AS lastSeenAt FROM devices
    WHERE room_id = ? AND type = 'computer' AND revoked_at IS NULL ORDER BY name
  `).all(roomId);
  return { room, phone, computers };
}

function expiringMessage(text: string) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
  };
}

export function sendToComputer(roomId: string, phoneId: string, targetComputerId: string, text: string) {
  const target = db().prepare(`
    SELECT id FROM devices WHERE id = ? AND room_id = ? AND type = 'computer' AND revoked_at IS NULL
  `).get(targetComputerId, roomId);
  if (!target) return null;
  const message = { ...expiringMessage(text), roomId, phoneId, targetComputerId };
  db().prepare(`
    INSERT INTO messages(id, room_id, phone_id, target_computer_id, text, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(message.id, roomId, phoneId, targetComputerId, message.text, message.createdAt, message.expiresAt);
  return message;
}

export function sendToBrowser(roomId: string, phoneId: string, text: string) {
  const message = { ...expiringMessage(text), roomId, phoneId };
  db().prepare(`
    INSERT INTO browser_messages(id, room_id, phone_id, text, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(message.id, roomId, phoneId, message.text, message.createdAt, message.expiresAt);
  return message;
}

export function sendImage(roomId: string, phoneId: string, target: string, fileName: string, mimeType: string, byteSize: number) {
  const targetKind = target === 'browser' ? 'browser' : 'computer';
  if (targetKind === 'computer') {
    const computer = db().prepare("SELECT id FROM devices WHERE id = ? AND room_id = ? AND type = 'computer' AND revoked_at IS NULL").get(target, roomId);
    if (!computer) return null;
  }
  const now = new Date();
  const message = { id: crypto.randomUUID(), roomId, phoneId, targetKind, targetComputerId: targetKind === 'computer' ? target : null, fileName, mimeType, byteSize, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString() };
  db().prepare(`INSERT INTO image_messages(id, room_id, phone_id, target_kind, target_computer_id, file_name, mime_type, byte_size, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(message.id, roomId, phoneId, message.targetKind, message.targetComputerId, fileName, mimeType, byteSize, message.createdAt, message.expiresAt);
  return message;
}

export function sendFile(roomId: string, phoneId: string, target: string, fileName: string, originalName: string, mimeType: string, byteSize: number) {
  const targetKind = target === 'browser' ? 'browser' : 'computer';
  if (targetKind === 'computer') {
    const computer = db().prepare("SELECT id FROM devices WHERE id = ? AND room_id = ? AND type = 'computer' AND revoked_at IS NULL").get(target, roomId);
    if (!computer) return null;
  }
  const now = new Date();
  const message = { id: crypto.randomUUID(), roomId, phoneId, targetKind, targetComputerId: targetKind === 'computer' ? target : null, fileName, originalName, mimeType, byteSize, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString() };
  db().prepare(`INSERT INTO file_messages(id, room_id, phone_id, target_kind, target_computer_id, file_name, original_name, mime_type, byte_size, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(message.id, roomId, phoneId, message.targetKind, message.targetComputerId, fileName, originalName, mimeType, byteSize, message.createdAt, message.expiresAt);
  return message;
}

export function expiredImageFiles() {
  const now = new Date().toISOString();
  const files = db().prepare('SELECT file_name AS fileName FROM image_messages WHERE expires_at <= ? OR consumed_at IS NOT NULL').all(now) as Array<{ fileName: string }>;
  db().prepare('DELETE FROM image_messages WHERE expires_at <= ? OR consumed_at IS NOT NULL').run(now);
  return files;
}

export function expiredTransferFiles() {
  const now = new Date().toISOString();
  const files = db().prepare('SELECT file_name AS fileName FROM file_messages WHERE expires_at <= ? OR consumed_at IS NOT NULL').all(now) as Array<{ fileName: string }>;
  db().prepare('DELETE FROM file_messages WHERE expires_at <= ? OR consumed_at IS NOT NULL').run(now);
  return files;
}

export function latestImageForComputer(computerId: string) {
  const now = new Date().toISOString();
  return db().prepare(`SELECT id, file_name AS fileName, mime_type AS mimeType, byte_size AS byteSize, created_at AS updatedAt FROM image_messages WHERE target_kind = 'computer' AND target_computer_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`).get(computerId, now) as { id: string; fileName: string; mimeType: string; byteSize: number; updatedAt: string } | undefined;
}

export function latestImageForBrowser(roomId: string) {
  const now = new Date().toISOString();
  return db().prepare(`SELECT id, file_name AS fileName, mime_type AS mimeType, byte_size AS byteSize, created_at AS updatedAt FROM image_messages WHERE target_kind = 'browser' AND room_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`).get(roomId, now) as { id: string; fileName: string; mimeType: string; byteSize: number; updatedAt: string } | undefined;
}

export function imageForComputer(computerId: string, messageId: string) {
  return db().prepare(`SELECT file_name AS fileName, mime_type AS mimeType FROM image_messages WHERE id = ? AND target_kind = 'computer' AND target_computer_id = ? AND consumed_at IS NULL AND expires_at > ?`).get(messageId, computerId, new Date().toISOString()) as { fileName: string; mimeType: string } | undefined;
}

export function imageForBrowser(roomId: string, messageId: string) {
  return db().prepare(`SELECT file_name AS fileName, mime_type AS mimeType FROM image_messages WHERE id = ? AND target_kind = 'browser' AND room_id = ? AND consumed_at IS NULL AND expires_at > ?`).get(messageId, roomId, new Date().toISOString()) as { fileName: string; mimeType: string } | undefined;
}

export function acknowledgeImage(targetKind: 'browser' | 'computer', targetId: string, messageId: string) {
  const targetColumn = targetKind === 'browser' ? 'room_id' : 'target_computer_id';
  const row = db().prepare(`SELECT file_name AS fileName FROM image_messages WHERE id = ? AND target_kind = ? AND ${targetColumn} = ? AND consumed_at IS NULL`).get(messageId, targetKind, targetId) as { fileName: string } | undefined;
  if (!row) return null;
  db().prepare('UPDATE image_messages SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), messageId);
  return row.fileName;
}

export function latestFileForComputer(computerId: string) {
  const now = new Date().toISOString();
  return db().prepare(`SELECT id, file_name AS fileName, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS updatedAt FROM file_messages WHERE target_kind = 'computer' AND target_computer_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`).get(computerId, now) as { id: string; fileName: string; originalName: string; mimeType: string; byteSize: number; updatedAt: string } | undefined;
}

export function latestFileForBrowser(roomId: string) {
  const now = new Date().toISOString();
  return db().prepare(`SELECT id, file_name AS fileName, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS updatedAt FROM file_messages WHERE target_kind = 'browser' AND room_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`).get(roomId, now) as { id: string; fileName: string; originalName: string; mimeType: string; byteSize: number; updatedAt: string } | undefined;
}

export function fileForComputer(computerId: string, messageId: string) {
  return db().prepare(`SELECT file_name AS fileName, original_name AS originalName, mime_type AS mimeType FROM file_messages WHERE id = ? AND target_kind = 'computer' AND target_computer_id = ? AND consumed_at IS NULL AND expires_at > ?`).get(messageId, computerId, new Date().toISOString()) as { fileName: string; originalName: string; mimeType: string } | undefined;
}

export function fileForBrowser(roomId: string, messageId: string) {
  return db().prepare(`SELECT file_name AS fileName, original_name AS originalName, mime_type AS mimeType FROM file_messages WHERE id = ? AND target_kind = 'browser' AND room_id = ? AND consumed_at IS NULL AND expires_at > ?`).get(messageId, roomId, new Date().toISOString()) as { fileName: string; originalName: string; mimeType: string } | undefined;
}

export function acknowledgeFile(targetKind: 'browser' | 'computer', targetId: string, messageId: string) {
  const targetColumn = targetKind === 'browser' ? 'room_id' : 'target_computer_id';
  const row = db().prepare(`SELECT file_name AS fileName FROM file_messages WHERE id = ? AND target_kind = ? AND ${targetColumn} = ? AND consumed_at IS NULL`).get(messageId, targetKind, targetId) as { fileName: string } | undefined;
  if (!row) return null;
  db().prepare('UPDATE file_messages SET consumed_at = ? WHERE id = ?').run(new Date().toISOString(), messageId);
  return row.fileName;
}

export function latestForComputer(computerId: string) {
  const now = new Date().toISOString();
  db().prepare('DELETE FROM messages WHERE expires_at <= ?').run(now);
  return db().prepare(`
    SELECT id, text, created_at AS updatedAt FROM messages
    WHERE target_computer_id = ? AND pasted_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(computerId, now) as { id: string; text: string; updatedAt: string } | undefined;
}

export function latestForBrowser(roomId: string) {
  const now = new Date().toISOString();
  db().prepare('DELETE FROM browser_messages WHERE expires_at <= ?').run(now);
  return db().prepare(`
    SELECT id, text, created_at AS updatedAt FROM browser_messages
    WHERE room_id = ? AND copied_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(roomId, now) as { id: string; text: string; updatedAt: string } | undefined;
}

export function acknowledgeMessage(computerId: string, messageId: string) {
  const result = db().prepare(`
    UPDATE messages SET pasted_at = ?
    WHERE id = ? AND target_computer_id = ? AND pasted_at IS NULL
  `).run(new Date().toISOString(), messageId, computerId);
  return result.changes > 0;
}

export function acknowledgeBrowserMessage(roomId: string, messageId: string) {
  const result = db().prepare(`
    UPDATE browser_messages SET copied_at = ?
    WHERE id = ? AND room_id = ? AND copied_at IS NULL
  `).run(new Date().toISOString(), messageId, roomId);
  return result.changes > 0;
}
