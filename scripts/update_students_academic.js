import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import xlsx from 'xlsx';

import { connectDB } from '../src/config/db.js';
import Student from '../src/models/student.model.js';
import User from '../src/models/user.model.js';

const parseCSV = (filePath) => new Promise((resolve, reject) => {
  const rows = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', () => resolve(rows))
    .on('error', (err) => reject(err));
});

const parseXLSX = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};

const normalizeRow = (row) => {
  // Normalize key names (case-insensitive)
  const normalized = {};
  for (const k of Object.keys(row)) {
    const lower = k.trim().toLowerCase();
    normalized[lower] = (row[k] || '').toString().trim();
  }

  const roll = (normalized['rollnumber'] || normalized['roll'] || normalized['roll no'] || normalized['roll_no'] || '').replace(/\s+/g, '');
  const cpiRaw = normalized['cpi'] || normalized['cgpa'] || normalized['gpa'] || '';
  const cpi = cpiRaw === '' ? null : Number(cpiRaw);
  const programme = normalized['programme'] || normalized['program'] || normalized['course'] || '';
  const department = normalized['department'] || normalized['dept'] || '';

  return { rollNumber: roll, cpi, programme, department };
};

const main = async () => {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: node scripts/update_students_academic.js <path-to-csv-or-xlsx> [--dry-run]');
      process.exit(1);
    }

    const filePath = args[0];
    const dryRun = args.includes('--dry-run');

    if (!fs.existsSync(filePath)) {
      console.error('[ERROR] File not found:', filePath);
      process.exit(1);
    }

    const ext = path.extname(filePath).toLowerCase();

    let rawRows = [];
    if (ext === '.csv') {
      rawRows = await parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rawRows = parseXLSX(filePath);
    } else {
      console.error('[ERROR] Unsupported file type. Provide CSV or XLSX');
      process.exit(1);
    }

    if (rawRows.length === 0) {
      console.warn('[WARN] No rows parsed from file. Exiting.');
      process.exit(0);
    }

    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('[ERROR] Please set MONGO_URI in .env');
      process.exit(1);
    }

    await connectDB(MONGO_URI);

    let updated = 0, notFound = 0, failed = 0;

    for (const r of rawRows) {
      try {
        const row = normalizeRow(r);
        if (!row.rollNumber) {
          console.warn('[SKIP] Missing rollNumber for row:', r);
          continue;
        }

        // Try to find student by rollNumber
        const student = await Student.findOne({ rollNumber: row.rollNumber });
        if (!student) {
          console.warn('[NOT FOUND] student with roll', row.rollNumber);
          notFound++;
          continue;
        }

        const user = await User.findById(student.userId);
        if (!user) {
          console.warn('[NOT FOUND] user for student with roll', row.rollNumber);
          notFound++;
          continue;
        }

        const updates = {};
        if (row.programme) updates.programme = row.programme;
        if (row.department) updates.department = row.department;
        if (typeof row.cpi === 'number' && !Number.isNaN(row.cpi)) updates.cpi = row.cpi;

        if (Object.keys(updates).length === 0) {
          console.log('[NO-OP] nothing to update for', row.rollNumber);
          continue;
        }

        if (dryRun) {
          console.log('[DRY] would update', user._id.toString(), updates);
        } else {
          await User.updateOne({ _id: user._id }, { $set: updates });
          console.log('[UPDATED] user', user.emailId || user._id, updates);
        }

        updated++;
      } catch (err) {
        console.error('[ERROR] processing row:', r, err.message || err);
        failed++;
      }
    }

    console.log(`Done. Updated: ${updated}, NotFound: ${notFound}, Failed: ${failed}`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
};

main();
