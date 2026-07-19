// Usage: node src/db/seedAbout.js
// Seeds organization/about_info row id=1.
// Modify values here if needed.

const db = require('./index');

const row = {
  id: 1,
  phone: '86010457',
  email: 'Jargalsuren089@gmail.com',
  address: 'Ховд аймаг Жаргалант сум Рашаант баг 9 дүгээр баг',
  social: '',
  org_type: 'Төсвийн байгууллага',
  register_no: '9066543',
  founded_at: '2022-12-14',
  tax_id: '17900823966',
  activity_code: '6910',
  activity_main: 'Хуулийн үйл ажиллагаа',
  is_branch: 0,
  parent_org: 'Шүүхийн шийдвэр гүйцэтгэх ерөнхий газар',
  org_full_address: 'Ховд аймаг Жаргалант сум Рашаант баг 9 дүгээр баг',
  responsibilities: 'хууль хэрэгжүүлэх',
  budget_admin: 'Хууль зүй, дотоод хэргийн сайд',
  accountant: 'Д.Жаргалсүрэн (88008329, 92118842), Г.Ганбат (99084912, 94555954)',
};

(async () => {
  await db.ready; // about_info table is already created by the main schema migration

  const now = Date.now();

  // Upsert (SQLite/libSQL: INSERT OR REPLACE with fixed PK)
  await db.prepare(
    `INSERT OR REPLACE INTO about_info
     (id, phone, email, address, social, org_type, register_no, founded_at, tax_id, activity_code, activity_main, is_branch, parent_org, org_full_address, responsibilities, budget_admin, accountant, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.phone,
    row.email,
    row.address,
    row.social,
    row.org_type,
    row.register_no,
    row.founded_at,
    row.tax_id,
    row.activity_code,
    row.activity_main,
    row.is_branch,
    row.parent_org,
    row.org_full_address,
    row.responsibilities,
    row.budget_admin,
    row.accountant,
    now
  );

  console.log('Seeded about_info id=1');
  process.exit(0);
})().catch((e) => {
  console.error('Алдаа:', e.message);
  process.exit(1);
});
