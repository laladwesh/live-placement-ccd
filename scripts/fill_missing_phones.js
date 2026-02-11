// scripts/fill_missing_phones.js
// Usage:
//   node scripts/fill_missing_phones.js [inputCsvPath] [outputCsvPath]
// Defaults:
//   input: "hoja bhai.csv" (project root)
//   output: "scripts/hoja_bhai_filled.csv"

import fs from 'fs';
import path from 'path';

const rand10 = () => {
  // generate a random 10-digit number as string, not starting with 0
  const first = Math.floor(Math.random() * 9) + 1;
  let s = String(first);
  for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10);
  return s;
};

const usage = `Usage: node scripts/fill_missing_phones.js [inputCsvPath] [outputCsvPath]\nDefaults: input="hoja bhai.csv", output="scripts/hoja_bhai_filled.csv"`;

const main = () => {
  const args = process.argv.slice(2);
  const input = args[0] || 'hoja bhai.csv';
  const output = args[1] || 'scripts/hoja_bhai_filled.csv';

  if (!fs.existsSync(input)) {
    console.error('[ERROR] Input CSV not found:', input);
    console.error(usage);
    process.exit(1);
  }

  const raw = fs.readFileSync(input, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0) {
    console.error('[ERROR] Empty CSV');
    process.exit(1);
  }

  const header = lines[0].split(',');
  const phoneIdx = header.findIndex(h => h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno');
  // fallback to 'phoneNo' column name commonly used in this repo
  const phoneIdxFallback = header.findIndex(h => h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno');
  // Better: try common variants
  const phoneIdx2 = header.findIndex(h => ['phoneno','phone','phoneno','phonenumber','phonenumber','phoneno','phoneno','phoneno','phoneno','phoneno','phoneno'].includes(h.trim().toLowerCase()));
  let idx = header.findIndex(h => h.trim().toLowerCase() === 'phoneno' || h.trim().toLowerCase() === 'phoneno');
  // Real detection: look for header containing 'phone' or 'phon'
  if (idx === -1) idx = header.findIndex(h => h.toLowerCase().includes('phone'));
  if (idx === -1) idx = header.findIndex(h => h.toLowerCase().includes('phon'));
  if (idx === -1) {
    console.error('[ERROR] Could not find phone column in header:', header.join(','));
    process.exit(1);
  }

  const outLines = [];
  outLines.push(header.join(','));

  // collect existing phones to avoid collisions
  const existing = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // skip empty line
    const cols = line.split(',');
    const phoneRaw = cols[idx] ? cols[idx].trim() : '';
    let phone = phoneRaw.replace(/[^0-9]/g, '');
    if (!phone) {
      // generate unique random phone
      let tries = 0;
      do {
        phone = rand10();
        tries++;
        if (tries > 1000) break;
      } while (existing.has(phone));
      cols[idx] = phone;
    }
    existing.add(phone);
    outLines.push(cols.map(c => c === undefined ? '' : c).join(','));
  }

  // backup original
  const backupPath = output + '.bak';
  try {
    if (fs.existsSync(output)) fs.copyFileSync(output, backupPath);
  } catch (err) {
    // ignore
  }

  fs.writeFileSync(output, outLines.join('\n'), 'utf8');
  console.log('Wrote', output, 'with filled phone numbers (empty values replaced).');
};

main();
