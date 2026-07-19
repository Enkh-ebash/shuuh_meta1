// Node built-in SQLite (available Node >=22.5). Avoids native-module build issues entirely.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'khovd457.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
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

-- Long-duration queue ("урт хугцааны эргэлт"): each date can have multiple "waves".
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
`);

// Migration: existing installs (created before this feature existed) won't have
// these columns yet — CREATE TABLE IF NOT EXISTS above only fires on a fresh DB.
(function migrateLongQueueColumns() {
  const cols = db.prepare('PRAGMA table_info(long_queue)').all().map((c) => c.name);
  if (!cols.includes('prisoner_ovog')) db.exec("ALTER TABLE long_queue ADD COLUMN prisoner_ovog TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('prisoner_ner')) db.exec("ALTER TABLE long_queue ADD COLUMN prisoner_ner TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('relation')) db.exec("ALTER TABLE long_queue ADD COLUMN relation TEXT NOT NULL DEFAULT ''");
})();

module.exports = db;
