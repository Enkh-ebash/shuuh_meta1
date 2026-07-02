const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET тохируулаагүй байна. .env файлыг шалгана уу (.env.example-ийг хуулна уу).');
}

function signUserToken(user) {
  return jwt.sign(
    { sub: user.register, ovog: user.ovog, ner: user.ner, phone: user.phone, role: 'citizen' },
    SECRET,
    { expiresIn: '30d' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.username, role: 'admin', displayName: admin.display_name },
    SECRET,
    { expiresIn: '12h' }
  );
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type === 'Bearer' ? token : null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Нэвтрэх шаардлагатай.' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Сешн хугацаа дууссан эсвэл токен буруу байна.' });
  }
}

function requireAdmin(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Admin нэвтрэх шаардлагатай.' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Зөвшөөрөлгүй.' });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Admin сешн хугацаа дууссан эсвэл токен буруу байна.' });
  }
}

module.exports = { signUserToken, signAdminToken, requireAuth, requireAdmin };
