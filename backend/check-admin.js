(async () => {
  const db = require('./src/db');
  await db.ready;
  const admins = await db.prepare('SELECT username, display_name, password_hash FROM admins').all();
  console.log('Admins in Turso:', admins.map(a => ({
    username: a.username,
    display_name: a.display_name,
    hash_prefix: a.password_hash.slice(0, 10)
  })));
  const bcrypt = require('bcryptjs');
  const test = await db.prepare('SELECT * FROM admins WHERE username = ?').get('Davaajaw');
  if (!test) {
    console.log('Davaajaw олдсонгүй!');
  } else {
    console.log('Davaajaw олдсон. Нууц үг тохирч байна уу:', bcrypt.compareSync('Suld457++', test.password_hash));
  }
})();
