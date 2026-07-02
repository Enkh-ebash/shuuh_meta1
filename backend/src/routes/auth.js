const express = require('express');
const db = require('../db');
const { signUserToken } = require('../util/auth');
const { isValidRegister, isValidPhone, cleanName } = require('../util/validate');

const router = express.Router();

// POST /api/auth/register-or-login
// Citizens identify themselves with овог/нэр/регистр/утас. If the register number
// already exists, the phone number must match (acts as a lightweight identity check).
// NOTE: for production, replace this with real identity verification (e.g. SMS OTP
// or an integration with the national civil registry / e-Mongolia API).
router.post('/register-or-login', (req, res) => {
  const ovog = cleanName(req.body.ovog);
  const ner = cleanName(req.body.ner);
  const register = (req.body.register || '').trim().toUpperCase();
  const phone = (req.body.phone || '').trim();

  if (!ovog || !ner) {
    return res.status(400).json({ error: 'Овог, нэрээ бөглөнө үү.' });
  }
  if (!isValidRegister(register)) {
    return res.status(400).json({ error: 'Регистрийн дугаар буруу байна (жишээ: АБ12345678).' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Утасны дугаар 8 оронтой байна.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE register = ?').get(register);

  if (existing) {
    if (existing.phone !== phone) {
      return res.status(409).json({
        error: 'Энэ регистрийн дугаар өөр утасны дугаартай бүртгэлтэй байна. Утасны дугаараа шалгана уу.',
      });
    }
    const token = signUserToken(existing);
    return res.json({ token, user: { ovog: existing.ovog, ner: existing.ner, register: existing.register, phone: existing.phone } });
  }

  const now = Date.now();
  db.prepare('INSERT INTO users (ovog, ner, register, phone, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(ovog, ner, register, phone, now);

  const user = { ovog, ner, register, phone };
  const token = signUserToken(user);
  res.status(201).json({ token, user });
});

module.exports = router;
