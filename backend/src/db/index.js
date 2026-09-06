
const { createClient } = require('@libsql/client');

require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    'TURSO_DATABASE_URL тохируулаагүй байна. .env файлыг шалгана уу (.env.example-ийг хуулна уу).'
  );
}

const client = createClient({ url, authToken });


function prepare(sql) {
  return {
    get: async (...args) => {
      const res = await client.execute({ sql, args });
      return res.rows[0];
    },
    all: async (...args) => {
      const res = await client.execute({ sql, args });
      return res.rows;
    },
    run: async (...args) => {
      const res = await client.execute({ sql, args });
      return { changes: Number(res.rowsAffected || 0), lastInsertRowid: res.lastInsertRowid };
    },
  };
}

async function exec(sql) {
  await client.executeMultiple(sql);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ovog TEXT NOT NULL,
  ner TEXT NOT NULL,
  register TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL
);

-- Long-duration queue ("удаан хугацааны эргэлт"): each date can have multiple "waves".
-- A wave (rotation) holds up to 10 people; once full, it locks for 72 hours; after that
-- a new wave opens automatically. Waves are not numbered/labeled as "shifts" to users —
-- it's presented as one continuous rotation that refills after each 72h lock.
CREATE TABLE IF NOT EXISTS long_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  wave INTEGER NOT NULL,
  register TEXT NOT NULL,
  ovog TEXT NOT NULL,
  ner TEXT NOT NULL,
  phone TEXT NOT NULL,
  booked_at INTEGER NOT NULL,
  prisoner_ovog TEXT NOT NULL DEFAULT '',
  prisoner_ner TEXT NOT NULL DEFAULT '',
  relation TEXT NOT NULL DEFAULT '',
  UNIQUE(date, wave, register)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  register TEXT NOT NULL,
  ovog TEXT NOT NULL,
  ner TEXT NOT NULL,
  phone TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  img_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_long_queue_date ON long_queue(date);

-- Organization info shown in the intro page.
CREATE TABLE IF NOT EXISTS about_info (
  id INTEGER PRIMARY KEY,
  phone TEXT,
  email TEXT,
  address TEXT,
  social TEXT,
  org_type TEXT,
  register_no TEXT,
  founded_at TEXT,
  tax_id TEXT,
  activity_code TEXT,
  activity_main TEXT,
  is_branch INTEGER DEFAULT 0,
  parent_org TEXT,
  org_full_address TEXT,
  responsibilities TEXT,
  budget_admin TEXT,
  accountant TEXT,
  created_at INTEGER NOT NULL
);
`;

async function migrate() {
  await exec(SCHEMA);

  // Existing installs (created before this feature existed) won't have these
  // columns yet — CREATE TABLE IF NOT EXISTS above only fires on a fresh DB.
  const cols = (await client.execute('PRAGMA table_info(long_queue)')).rows.map((c) => c.name);
  if (!cols.includes('prisoner_ovog')) await client.execute("ALTER TABLE long_queue ADD COLUMN prisoner_ovog TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('prisoner_ner')) await client.execute("ALTER TABLE long_queue ADD COLUMN prisoner_ner TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('relation')) await client.execute("ALTER TABLE long_queue ADD COLUMN relation TEXT NOT NULL DEFAULT ''");
}

// Resolves once the schema is ready. server.js awaits this before accepting
// requests; seed/maintenance scripts should also `await require('./db').ready`
// before running their own queries.
const ready = migrate().catch((e) => {
  console.error('DB migration/connection failed:', e.message);
  process.exit(1);
});

module.exports = { prepare, exec, client, ready };
