// One-off maintenance script.
//
// 1) Drops the stale `simple_queue` table (leftover from the retired "энгийн
//    эргэлт" feature — no longer created or read by the app, but old installs
//    still have it).
// 2) Wipes ALL registered citizen accounts, ALL long-queue (урт хугцааны
//    эргэлт) bookings, and ALL feedback (санал хүсэлт).
//
// This does NOT touch: admins, news, about_info.
//
// IMPORTANT: JWT tokens are self-contained and are not checked against the
// database on each request (see backend/src/util/auth.js). Citizens who are
// still logged in will keep working until their token expires (30 days) even
// after their row is deleted here — deleting the row does not "log them out".
// If you need to force everyone out immediately, rotate JWT_SECRET in your
// .env file and restart the server; that invalidates every existing token
// (admin sessions too).
//
// Usage (from the backend/ folder):
//   node scripts/reset-data.js
//
// Since data now lives in Turso rather than a local file, there's no local
// .db file to back up first — take a Turso snapshot/backup instead if you
// might need this data later (see: turso db show <name>, or the Turso
// dashboard's backup/restore options).

const db = require('../src/db');

async function main() {
  await db.ready;
  const client = db.client;

  await client.execute('DROP TABLE IF EXISTS simple_queue');
  console.log('Dropped stale simple_queue table (if it existed).');

  const counts = {
    users: (await client.execute('SELECT COUNT(*) as c FROM users')).rows[0].c,
    long_queue: (await client.execute('SELECT COUNT(*) as c FROM long_queue')).rows[0].c,
    feedback: (await client.execute('SELECT COUNT(*) as c FROM feedback')).rows[0].c,
  };

  // Executed as a single atomic batch so a mid-way failure can't leave things
  // half-deleted.
  await client.batch(
    [
      'DELETE FROM users',
      'DELETE FROM long_queue',
      'DELETE FROM feedback',
      "DELETE FROM sqlite_sequence WHERE name IN ('users', 'long_queue', 'feedback')",
    ],
    'write'
  );

  console.log('Deleted:', counts);
  console.log('Done. users, long_queue, and feedback are now empty. admins/news/about_info were left untouched.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Reset failed. Error:', e.message);
  process.exit(1);
});
