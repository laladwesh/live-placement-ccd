// scripts/export_companies_summary.js
// Usage: node scripts/export_companies_summary.js [--out <path>]
// Exports a CSV of all companies with counts: shortlisted, waitlisted, total (shortlisted+waitlisted), and placed.

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { connectDB } from '../src/config/db.js';
import Company from '../src/models/company.model.js';
import Shortlist from '../src/models/shortlist.model.js';
import Student from '../src/models/student.model.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGO_URI;

const header = [
  'Company',
  'Venue',
  'Slot/Description',
  'Shortlisted',
  'Waitlisted',
  'TotalCandidates',
  'Placed'
];

const csvEscape = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const main = async () => {
  if (!MONGO_URI) {
    console.error('[ERROR] Please set MONGO_URI in .env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let outPath = null;
  const outIndex = args.indexOf('--out');
  if (outIndex !== -1 && args[outIndex + 1]) {
    outPath = args[outIndex + 1];
  }
  if (!outPath) {
    outPath = path.join(__dirname, 'companies_export.csv');
  }

  await connectDB(MONGO_URI);

  // Aggregate shortlist counts per company
  const shortlistAgg = await Shortlist.aggregate([
    {
      $group: {
        _id: '$companyId',
        shortlisted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0]
          }
        },
        waitlisted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    }
  ]);

  const shortlistMap = new Map();
  shortlistAgg.forEach((row) => {
    shortlistMap.set(String(row._id), {
      shortlisted: row.shortlisted || 0,
      waitlisted: row.waitlisted || 0,
      total: row.total || 0
    });
  });

  // Aggregate placed counts per company using Student.placedCompany
  const placedAgg = await Student.aggregate([
    { $match: { isPlaced: true, placedCompany: { $ne: null } } },
    { $group: { _id: '$placedCompany', placed: { $sum: 1 } } }
  ]);

  const placedMap = new Map();
  placedAgg.forEach((row) => {
    placedMap.set(String(row._id), row.placed || 0);
  });

  const companies = await Company.find({}).sort({ name: 1 }).lean();

  const lines = [header.join(',')];

  companies.forEach((c) => {
    const counts = shortlistMap.get(String(c._id)) || {
      shortlisted: 0,
      waitlisted: 0,
      total: 0
    };
    const placed = placedMap.get(String(c._id)) || 0;

    const row = [
      csvEscape(c.name),
      csvEscape(c.venue || ''),
      csvEscape(c.description || ''),
      counts.shortlisted,
      counts.waitlisted,
      counts.total,
      placed
    ];
    lines.push(row.join(','));
  });

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`[OK] Exported ${companies.length} companies to ${outPath}`);
};

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
