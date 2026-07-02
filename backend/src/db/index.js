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
-- A wave holds up to 3 people; once full, it locks for 72 hours; after that a new wave opens.
CREATE TABLE IF NOT EXISTS long_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  wave INTEGER NOT NULL,
  register TEXT NOT NULL,
  ovog TEXT NOT NULL,
  ner TEXT NOT NULL,
  phone TEXT NOT NULL,
  booked_at INTEGER NOT NULL,
  UNIQUE(date, wave, register)
);

-- Regular queue ("энгийн эргэлт"): simple ordered daily sign-up, no capacity lock.
CREATE TABLE IF NOT EXISTS simple_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  register TEXT NOT NULL,
  ovog TEXT NOT NULL,
  ner TEXT NOT NULL,
  phone TEXT NOT NULL,
  booked_at INTEGER NOT NULL,
  UNIQUE(date, register)
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
CREATE INDEX IF NOT EXISTS idx_simple_queue_date ON simple_queue(date);
`);

module.exports = db;
