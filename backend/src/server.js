require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const queueRoutes = require('./routes/queue');
const feedbackRoutes = require('./routes/feedback');
const newsRoutes = require('./routes/news');
const adminRoutes = require('./routes/admin');
const aboutRoutes = require('./routes/about');
+const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (болон ихэнх PaaS сервис) proxy ард ажилладаг тул
// X-Forwarded-For header-ийг итгэмжлэхийг зааж өгөх ёстой.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '200kb' }));

// Basic abuse protection on write-heavy / auth endpoints.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/admin', adminRoutes);


// Serve the built frontend (static files) in production.
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Central error handler (keeps error details out of responses).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Серверийн алдаа гарлаа.' });
});

db.ready.then(() => {
  app.listen(PORT, () => {
    console.log(`Khovd-457 API сервер http://localhost:${PORT} дээр ажиллаж байна`);
  });
});
