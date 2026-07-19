const express = require('express');
const db = require('../db');
const { requireAuth } = require('../util/auth');
const { isValidDate, cleanName, isValidRelation } = require('../util/validate');

const router = express.Router();
const LOCK_MS = 72 * 60 * 60 * 1000; // 72 hours
const WAVE_CAPACITY = 10;

// Compute the currently-active wave for a date: the wave people should see/book into.
// If the latest wave is full and still within its 72h lock, it is returned as 'full'
// (read-only). Once 72h has elapsed since it filled, a fresh (empty) wave is "opened"
// automatically — no cron job needed, it's computed on read.
function getCurrentLongWave(date) {
  const row = db.prepare('SELECT MAX(wave) as w FROM long_queue WHERE date = ?').get(date);
  const maxWave = row.w || 1;
  const entries = db
    .prepare('SELECT register, ovog, ner, phone, prisoner_ovog, prisoner_ner, relation, booked_at FROM long_queue WHERE date = ? AND wave = ? ORDER BY booked_at ASC')
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

router.get('/long/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });
  const info = await getCurrentLongWave(date);
  const alreadyIn = info.entries.some((e) => e.register === req.user.sub);
  res.json({ date, ...info, alreadyIn, capacity: WAVE_CAPACITY });
});

router.post('/long/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Огноо буруу байна.' });

  const info = await getCurrentLongWave(date);
  if (info.status === 'full') {
    return res.status(409).json({ error: 'Энэ өдөр дүүрсэн байна. Дараагийн ээлж нээгдэх хүртэл хүлээнэ үү.', lockedUntil: info.lockedUntil });
  }
  if (info.entries.some((e) => e.register === req.user.sub)) {
    return res.status(409).json({ error: 'Та энэ ээлжинд аль хэдийн бүртгэлтэй байна.' });
  }

  // Who they're visiting, and the visitor's relation to that prisoner. Both are
  // required so staff know who to bring forward without asking again in person.
  const prisonerOvog = cleanName(req.body.prisonerOvog);
  const prisonerNer = cleanName(req.body.prisonerNer);
  const relationChoice = typeof req.body.relation === 'string' ? req.body.relation.trim() : '';
  const relationOther = cleanName(req.body.relationOther);

  if (!prisonerOvog || !prisonerNer) {
    return res.status(400).json({ error: 'Хоригдлын овог, нэрийг бөглөнө үү.' });
  }
  if (!isValidRelation(relationChoice)) {
    return res.status(400).json({ error: 'Хоригдолтой ямар хамааралтайгаа сонгоно уу.' });
  }
  if (relationChoice === 'бусад' && !relationOther) {
    return res.status(400).json({ error: 'Хамаарлаа бичнэ үү.' });
  }
  const relation = relationChoice === 'бусад' ? `Бусад: ${relationOther}` : relationChoice;

  try {
    db.prepare(
      'INSERT INTO long_queue (date, wave, register, ovog, ner, phone, prisoner_ovog, prisoner_ner, relation, booked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(date, info.wave, req.user.sub, req.user.ovog, req.user.ner, req.user.phone, prisonerOvog, prisonerNer, relation, Date.now());
  } catch (e) {
    return res.status(409).json({ error: 'Захиалга авахад алдаа гарлаа. Дахин оролдоно уу.' });
  }

  res.status(201).json(getCurrentLongWave(date));
});

// Used by the calendar view to mark which dates are red (long queue is blocked).
// Rule (UI requirement):
// If wave at date D is filled at time T0, then dates from D forward (day-by-day)
// remain red for the next 72 hours. At the exact unlock moment, marking should
// stop (i.e., D+3 days should turn non-red).
router.get('/long-status/:yearMonth', requireAuth, (req, res) => {
  const { yearMonth } = req.params; // e.g. "2026-07"
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return res.status(400).json({ error: 'Огноо буруу байна.' });

  // We compute "blocked" intervals based on actual filled waves (wave capacity=10).
  // For each filled wave row, take:
  //   start = time when 3rd person booked (max booked_at within that wave)
  //   lockedUntil = start + LOCK_MS
  // Then any calendar day whose [dayStart, dayEnd] overlaps the interval [now, lockedUntil)
  // should be marked red.

  // Query all waves within the month.
  // Each distinct (date, wave) can be evaluated.
  const waves = await db
    .prepare(
      'SELECT date, wave, COUNT(*) as cnt, MAX(booked_at) as last_booked_at FROM long_queue WHERE date LIKE ? GROUP BY date, wave'
    )
    .all(`${yearMonth}-%`);

  const fullDatesSet = new Set();

  // For calendar red-marking we only care about days, not time-of-day.
  // Rule from UX: if the 3rd booking happens on date D, then D, D+1, D+2
  // are red; unlock moment at D+3 should stop marking.
  // Therefore we compute locked day-end as startDay + 3 days (exclusive).
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (const w of waves) {

    const cnt = w.cnt || 0;
    if (cnt < WAVE_CAPACITY) continue; // not filled

    const startBookedAt = w.last_booked_at;
    if (!startBookedAt) continue;

    const lockedUntil = startBookedAt + LOCK_MS;
    if (now >= lockedUntil) continue; // already unlocked

    // Determine which day strings in this month are blocked by this interval.
    // We only need to mark from the start date (w.date) onward, but since we only
    // fetch month candidates, we map by comparing day boundaries.

    // dayStart/dayEnd for candidate days: [00:00, 23:59:59.999]
    // For each day in month that overlaps [now, lockedUntil), mark red.
    const [yy, mm] = w.date.split('-');
    const year = Number(yy);
    const month = Number(mm);

    // Iterate days from w.date within month of yearMonth.
    const [baseY, baseM] = yearMonth.split('-');
    const baseYear = Number(baseY);
    const baseMonth = Number(baseM);

    const baseFirst = new Date(baseYear, baseMonth - 1, 1).getTime();
    const baseLastDay = new Date(baseYear, baseMonth, 0).getDate();

    // Iterate all days in this month and check overlap with [filledAt, lockedUntil).
    // IMPORTANT (UX rule): If unlock happens exactly at 7/5 00:00, then 7/5 must NOT be red.
    // So we treat the locked interval as half-open: [filledAt, lockedUntil)
    // and a day is red iff its interval overlaps that locked interval:
    //   dayStart < lockedUntil && dayEndExclusive > filledAt
    // (where dayEndExclusive is next-day 00:00).
    const filledAt = startBookedAt;

    for (let d = 1; d <= baseLastDay; d++) {
      const dayStart = new Date(baseYear, baseMonth - 1, d, 0, 0, 0, 0).getTime();
      const dayEndExclusive = new Date(baseYear, baseMonth - 1, d + 1, 0, 0, 0, 0).getTime();

      if (!(dayStart < lockedUntil && dayEndExclusive > filledAt)) continue;

      const dayStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      fullDatesSet.add(dayStr);
    }

  }


  res.json({ fullDates: Array.from(fullDatesSet).sort() });
});


module.exports = router;
