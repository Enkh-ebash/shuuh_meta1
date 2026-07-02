const express = require('express');
const db = require('../db');
const { requireAuth } = require('../util/auth');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const title = (req.body.title || '').trim().slice(0, 200);
  const body = (req.body.body || '').trim().slice(0, 4000);
  if (!title || !body) return res.status(400).json({ error: 'Гарчиг болон агуулгыг бөглөнө үү.' });

  const now = Date.now();
  db.prepare(
    'INSERT INTO feedback (register, ovog, ner, phone, title, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.sub, req.user.ovog, req.user.ner, req.user.phone, title, body, 'new', now);

  res.status(201).json({ ok: true });
});

router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, title, body, status, created_at FROM feedback WHERE register = ? ORDER BY created_at DESC')
    .all(req.user.sub);
  res.json({ items: rows });
});

module.exports = router;
