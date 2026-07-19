// Usage: node src/db/seedAdmin.js <username> <password> ["Display Name"]
// Creates the admin account if it doesn't exist, or updates the password if it does.
const bcrypt = require('bcryptjs');
const db = require('./index');

const [, , username, password, displayName] = process.argv;

if (!username || !password) {
  console.log('Ашиглах заавар: node src/db/seedAdmin.js <username> <password> ["Харагдах нэр"]');
  process.exit(1);
}

if (password.length < 8) {
  console.log('Нууц үг дор хаяж 8 тэмдэгт байх ёстой.');
  process.exit(1);
}

(async () => {
  await db.ready;

  const hash = bcrypt.hashSync(password, 10);
  const existing = await db.prepare('SELECT id FROM admins WHERE username = ?').get(username);

  if (existing) {
    await db.prepare('UPDATE admins SET password_hash = ?, display_name = ? WHERE username = ?')
      .run(hash, displayName || username, username);
    console.log(`Admin "${username}" нууц үгийг шинэчиллээ.`);
  } else {
    await db.prepare('INSERT INTO admins (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)')
      .run(username, hash, displayName || username, Date.now());
    console.log(`Admin "${username}" амжилттай үүслээ.`);
  }

  process.exit(0);
})().catch((e) => {
  console.error('Алдаа:', e.message);
  process.exit(1);
});
