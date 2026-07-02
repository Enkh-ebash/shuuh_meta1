const express = require('express');
const db = require('../db');
const { requireAuth } = require('../util/auth');
const { isValidDate } = require('../util/validate');

const router = express.Router();
const LOCK_MS = 72 * 60 * 60 * 1000; // 72 hours
const WAVE_CAPACITY = 3;

// Compute the currently-active wave for a date: the wave people should see/book into.
// If the latest wave is full and still within its 72h lock, it is returned as 'full'
// (read-only). Once 72h has elapsed since it filled, a fresh (empty) wave is "opened"
// automatically — no cron job needed, it's computed on read.
function getCurrentLongWave(date) {
  const row = db.prepare('SELECT MAX(wave) as w FROM long_queue WHERE date = ?').get(date);
  const maxWave = row.w || 1;
  const entries = db
    .prepare('SELECT register, ovog, ner, phone, booked_at FROM long_queue WHERE date = ? AND wave = ? ORDER BY booked_at ASC')
    .all(date, maxWave);

  if (entries.length >= WAVE_CAPACITY) {
    const lastBookedAt = Math.max(...entries.map((e) => e.booked_at));
    const lockedUntil = lastBookedAt + LOCK_MS;
    if (Date.now() < lockedUntil) {
      return { wave: maxWave, entries, status: 'full', lockedUntil };
    }
    return { wave: maxWave + 1, entries: [], status: 'open', lockedUntil: null };
  }
  return { wave: maxWave, entries, status: 'open', lockedUntil: null };
}

router.get('/long/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });
  const info = getCurrentLongWave(date);
  const alreadyIn = info.entries.some((e) => e.register === req.user.sub);
  res.json({ date, ...info, alreadyIn, capacity: WAVE_CAPACITY });
});

router.post('/long/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });

  const info = getCurrentLongWave(date);
  if (info.status === 'full') {
    return res.status(409).json({ error: 'Энэ өдөр дүүрсэн байна. Дараагийн ээлж нээгдэх хүртэл хүлээнэ үү.', lockedUntil: info.lockedUntil });
  }
  if (info.entries.some((e) => e.register === req.user.sub)) {
    return res.status(409).json({ error: 'Та энэ ээлжинд аль хэдийн бүртгэлтэй байна.' });
  }

  try {
    db.prepare(
      'INSERT INTO long_queue (date, wave, register, ovog, ner, phone, booked_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(date, info.wave, req.user.sub, req.user.ovog, req.user.ner, req.user.phone, Date.now());
  } catch (e) {
    return res.status(409).json({ error: 'Захиалга авахад алдаа гарлаа. Дахин оролдоно уу.' });
  }

  res.status(201).json(getCurrentLongWave(date));
});

router.get('/simple/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });
  const entries = db
    .prepare('SELECT register, ovog, ner, phone, booked_at FROM simple_queue WHERE date = ? ORDER BY booked_at ASC')
    .all(date);
  const myIndex = entries.findIndex((e) => e.register === req.user.sub);
  res.json({ date, entries, alreadyIn: myIndex >= 0, myPosition: myIndex >= 0 ? myIndex + 1 : null });
});

router.post('/simple/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });

  try {
    db.prepare(
      'INSERT INTO simple_queue (date, register, ovog, ner, phone, booked_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(date, req.user.sub, req.user.ovog, req.user.ner, req.user.phone, Date.now());
  } catch (e) {
    return res.status(409).json({ error: 'Та энэ өдрийн дараалалд аль хэдийн бүртгэлтэй байна.' });
  }

  const entries = db
    .prepare('SELECT register, ovog, ner, phone, booked_at FROM simple_queue WHERE date = ? ORDER BY booked_at ASC')
    .all(date);
  res.status(201).json({ date, entries });
});

// Used by the calendar view to mark which dates are currently full (long queue).
router.get('/long-status/:yearMonth', requireAuth, (req, res) => {
  const { yearMonth } = req.params; // e.g. "2026-07"
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return res.status(400).json({ error: 'Огноо буруу байна.' });
  // Collect only dates that have any long_queue rows in this month.
  // Then mark a date red if the currently-active wave is "full" at this moment.
  // IMPORTANT: When a wave is full, it becomes unlockable only when Date.now() >= lockedUntil.
  const dates = db
    .prepare('SELECT DISTINCT date FROM long_queue WHERE date LIKE ?')
    .all(`${yearMonth}-%`) // e.g. "2026-07-%"
    .map((r) => r.date);

  const fullDates = dates
    .map((d) => {
      const info = getCurrentLongWave(d);
      return info.status === 'full' ? d : null;
    })
    .filter(Boolean);

  res.json({ fullDates });

});

module.exports = router;
