const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT id, title, body, img_url, created_at FROM news ORDER BY created_at DESC').all();
  res.json({ items: rows });
});

module.exports = router;
