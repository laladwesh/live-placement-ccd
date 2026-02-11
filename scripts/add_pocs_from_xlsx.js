// scripts/add_pocs_from_xlsx.js
// Usage: node scripts/add_pocs_from_xlsx.js [path/to/pocs.xlsx] [--dry-run]
// Reads an XLSX file and creates/updates POC users (fields: Name, Iitg mail id, Mobile Number)

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

dotenv.config();

import { connectDB } from '../src/config/db.js';
import User from '../src/models/user.model.js';

const normalize = (s) => (s || '').toString().trim();

const findKey = (keys, candidates) => {
  for (const c of candidates) {
    const k = keys.find(h => normalize(h).toLowerCase() === c.toLowerCase());
    if (k) return k;
  }
  for (const c of candidates) {
    const k = keys.find(h => normalize(h).toLowerCase().includes(c.toLowerCase()));
    if (k) return k;
  }
  return null;
};

const USAGE = `Usage: node scripts/add_pocs_from_xlsx.js [path/to/pocs.xlsx] [--dry-run]\nExample:\n  node scripts/add_pocs_from_xlsx.js scripts/pocs.xlsx --dry-run\n`;

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(USAGE);
    process.exit(1);
  }

  const filePath = args.find(a => !a.startsWith('--')) || 'scripts/pocs.xlsx';
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(filePath)) {
    console.error('[ERROR] XLSX not found at', filePath);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows || rows.length === 0) {
    console.error('[ERROR] No rows found in the sheet');
    process.exit(1);
  }

  const headers = Object.keys(rows[0]);
  const nameCandidates = ['name', 'full name'];
  const emailCandidates = ['iitg mail id', 'iitg mail', 'email id', 'email', 'iitg email'];
  const phoneCandidates = ['mobile number', 'mobile', 'mobile no', 'phone', 'phone no', 'phone number'];

  const nameKey = findKey(headers, nameCandidates);
  const emailKey = findKey(headers, emailCandidates);
  const phoneKey = findKey(headers, phoneCandidates);

  if (!emailKey) {
    console.error('[ERROR] Could not detect an email column. Headers:', headers.join(', '));
    process.exit(1);
  }

  const entries = rows.map(r => {
    const name = nameKey ? normalize(r[nameKey]) : '';
    const email = (r[emailKey] || '').toString().trim().toLowerCase();
    const phoneRaw = phoneKey ? (r[phoneKey] || '').toString() : '';
    let phone = phoneRaw.replace(/[^0-9]/g, '');
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length !== 10) phone = null;
    return { name, emailId: email, phoneNo: phone };
  }).filter(e => e.emailId);

  if (entries.length === 0) {
    console.error('[ERROR] No valid POC entries found (missing emails)');
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Detected ${entries.length} entries. Sample:`);
    console.table(entries.slice(0, 10));
    console.log('Run without --dry-run to actually create/update users.');
    process.exit(0);
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('[ERROR] Please set MONGO_URI in .env');
    process.exit(1);
  }

  await connectDB(MONGO_URI);

  let created = 0, updated = 0, skipped = 0;

  for (const p of entries) {
    try {
      const existing = await User.findOne({ emailId: p.emailId });
      if (!existing) {
        const newUser = new User({
          name: p.name || p.emailId,
          emailId: p.emailId,
          phoneNo: p.phoneNo || undefined,
          role: 'poc',
          isAllowed: true
        });
        await newUser.save();
        created++;
        console.log('[CREATED]', p.emailId);
      } else if (existing.role === 'poc') {
        const upd = {};
        if (p.name && p.name !== existing.name) upd.name = p.name;
        if (p.phoneNo && p.phoneNo !== existing.phoneNo) upd.phoneNo = p.phoneNo;
        if (Object.keys(upd).length > 0) {
          await User.updateOne({ _id: existing._id }, { $set: upd });
          updated++;
          console.log('[UPDATED]', p.emailId, upd);
        } else {
          console.log('[NO-OP]', p.emailId);
        }
      } else {
        skipped++;
        console.log('[SKIP] Email exists with role', existing.role, p.emailId);
      }
    } catch (err) {
      console.error('[ERROR] processing', p.emailId, err.message || err);
    }
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  process.exit(0);
};

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
