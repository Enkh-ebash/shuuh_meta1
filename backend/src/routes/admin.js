const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signAdminToken, requireAdmin } = require('../util/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' });
  }
  const token = signAdminToken(admin);
  res.json({ token, displayName: admin.display_name });
});

router.get('/users', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT ovog, ner, register, phone, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ items: rows });
});

router.get('/queue/long', requireAdmin, (req, res) => {
  const rows = db
    .prepare('SELECT date, wave, register, ovog, ner, phone, booked_at FROM long_queue ORDER BY date DESC, wave DESC, booked_at ASC')
    .all();
  res.json({ items: rows });
});

router.get('/queue/simple', requireAdmin, (req, res) => {
  const rows = db
    .prepare('SELECT date, register, ovog, ner, phone, booked_at FROM simple_queue ORDER BY date DESC, booked_at ASC')
    .all();
  res.json({ items: rows });
});

router.get('/feedback', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
  res.json({ items: rows });
});

router.patch('/feedback/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const status = (req.body.status || '').trim();
  if (!['new', 'reviewed', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Статус буруу байна.' });
  }
  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

router.post('/news', requireAdmin, (req, res) => {
  const title = (req.body.title || '').trim().slice(0, 200);
  const body = (req.body.body || '').trim().slice(0, 4000);
  const imgUrl = (req.body.img_url || '').trim().slice(0, 1000) || null;
  if (!title || !body) return res.status(400).json({ error: 'Гарчиг болон агуулгыг бөглөнө үү.' });

  db.prepare('INSERT INTO news (title, body, img_url, created_at) VALUES (?, ?, ?, ?)').run(
    title, body, imgUrl, Date.now()
  );
  res.status(201).json({ ok: true });
});

router.delete('/news/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
