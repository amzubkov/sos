import {open, type DB} from '@op-engineering/op-sqlite';

let db: DB;

export async function initDatabase(): Promise<void> {
  db = open({name: 'sos.db'});
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      username TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      added_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact TEXT NOT NULL,
      direction TEXT NOT NULL,
      plaintext TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_msg_contact ON messages(contact, timestamp)',
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS keys (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Migration: add muted column
  try {
    await db.execute('ALTER TABLE contacts ADD COLUMN muted INTEGER NOT NULL DEFAULT 0');
  } catch (_) {
    // column already exists
  }
}

export async function setKey(key: string, value: string): Promise<void> {
  await db.execute(
    'INSERT OR REPLACE INTO keys (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export async function getKey(key: string): Promise<string | null> {
  const res = await db.execute('SELECT value FROM keys WHERE key = ?', [key]);
  if (res.rows.length === 0) return null;
  return res.rows[0].value as string;
}

export async function saveContact(
  username: string,
  publicKey: string,
): Promise<void> {
  await db.execute(
    'INSERT OR REPLACE INTO contacts (username, public_key, added_at) VALUES (?, ?, ?)',
    [username, publicKey, new Date().toISOString()],
  );
}

export async function getContact(
  username: string,
): Promise<{username: string; public_key: string; muted: number} | null> {
  const res = await db.execute(
    'SELECT username, public_key, muted FROM contacts WHERE username = ?',
    [username],
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as {username: string; public_key: string; muted: number};
}

export async function setMuted(username: string, muted: boolean): Promise<void> {
  await db.execute('UPDATE contacts SET muted = ? WHERE username = ?', [muted ? 1 : 0, username]);
}

export async function isMuted(username: string): Promise<boolean> {
  const res = await db.execute('SELECT muted FROM contacts WHERE username = ?', [username]);
  if (res.rows.length === 0) return false;
  return (res.rows[0] as {muted: number}).muted === 1;
}

export async function getAllContacts(): Promise<
  {username: string; public_key: string}[]
> {
  const res = await db.execute(
    'SELECT username, public_key FROM contacts ORDER BY added_at DESC',
  );
  return res.rows as {username: string; public_key: string}[];
}

export async function saveMessage(
  contact: string,
  direction: 'in' | 'out',
  plaintext: string,
  timestamp?: string,
): Promise<void> {
  await db.execute(
    'INSERT INTO messages (contact, direction, plaintext, timestamp) VALUES (?, ?, ?, ?)',
    [contact, direction, plaintext, timestamp || new Date().toISOString()],
  );
}

export async function getMessages(
  contact: string,
  limit = 100,
  offset = 0,
): Promise<
  {id: number; direction: string; plaintext: string; timestamp: string}[]
> {
  const res = await db.execute(
    'SELECT id, direction, plaintext, timestamp FROM messages WHERE contact = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [contact, limit, offset],
  );
  return (res.rows as {id: number; direction: string; plaintext: string; timestamp: string}[]).reverse();
}

export async function getChatList(): Promise<
  {username: string; lastMessage: string; lastTime: string; muted: number}[]
> {
  const res = await db.execute(`
    SELECT c.username,
      c.muted,
      m.plaintext as lastMessage,
      m.timestamp as lastTime
    FROM contacts c
    LEFT JOIN messages m ON m.contact = c.username
      AND m.id = (SELECT MAX(id) FROM messages WHERE contact = c.username)
    ORDER BY m.timestamp DESC, c.added_at DESC
  `);
  return res.rows as {username: string; lastMessage: string; lastTime: string; muted: number}[];
}
