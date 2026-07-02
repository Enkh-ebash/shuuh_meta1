// Mongolian civil register number: 2 Cyrillic letters + 8 digits (e.g. АБ12345678)
const REGISTER_RE = /^[А-ЯЁӨҮ]{2}\d{8}$/i;
// Mongolian mobile numbers: 8 digits
const PHONE_RE = /^\d{8}$/;

function isValidRegister(v) {
  return typeof v === 'string' && REGISTER_RE.test(v.trim());
}

function isValidPhone(v) {
  return typeof v === 'string' && PHONE_RE.test(v.trim());
}

function isValidDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());
}

function cleanName(v) {
  return typeof v === 'string' ? v.trim().slice(0, 80) : '';
}

module.exports = { isValidRegister, isValidPhone, isValidDate, cleanName };
