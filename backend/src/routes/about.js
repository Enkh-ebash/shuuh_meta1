const express = require('express');
const db = require('../db');
const router = express.Router();

// Public: GET /api/about
// Returns organization/contact info used by the frontend.
router.get('/', async (req, res) => {
  const row = await db
    .prepare(
      'SELECT phone, email, address, social, org_type, register_no, founded_at, tax_id, activity_code, activity_main, is_branch, parent_org, org_full_address, responsibilities, budget_admin, accountant FROM about_info WHERE id = 1'
    )
    .get();

  if (!row) return res.json({});

  res.json({
    phone: row.phone,
    email: row.email,
    address: row.address,
    social: row.social,
    org_type: row.org_type,
    register_no: row.register_no,
    founded_at: row.founded_at,
    tax_id: row.tax_id,
    activity_code: row.activity_code,
    activity_main: row.activity_main,
    is_branch: row.is_branch,
    parent_org: row.parent_org,
    org_full_address: row.org_full_address,
    responsibilities: row.responsibilities,
    budget_admin: row.budget_admin,
    accountant: row.accountant,
    
  });
});


module.exports = router;

