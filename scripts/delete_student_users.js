// scripts/delete_student_users.js
// Safe deletion tool for users with role 'student'.
// Usage:
//   node scripts/delete_student_users.js --dry-run
//   node scripts/delete_student_users.js --confirm    # performs deletion (must have MONGO_URI in .env)
//   node scripts/delete_student_users.js --confirm --backupDir=./scripts/backups

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/user.model.js';
import Student from '../src/models/student.model.js';
import Offer from '../src/models/offer.model.js';
import Company from '../src/models/company.model.js';
import Shortlist from '../src/models/shortlist.model.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, confirm: false, backupDir: './scripts/backups' };
  for (const a of args) {
    if (a === '--dry-run') opts.dryRun = true;
    if (a === '--confirm') opts.confirm = true;
    if (a.startsWith('--backupDir=')) opts.backupDir = a.split('=')[1];
  }
  if (!args.length) opts.dryRun = true;
  return opts;
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const main = async () => {
  const opts = parseArgs();

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI && opts.confirm) {
    console.error('[ERROR] MONGO_URI not set in .env; required for confirm deletion');
    process.exit(1);
  }

  if (opts.confirm) await connectDB(MONGO_URI);
  else if (opts.dryRun) {
    // connect is optional for dry-run; we still need DB to get counts, so connect if MONGO_URI present
    if (MONGO_URI) await connectDB(MONGO_URI);
  }

  // Find student users
  const students = await User.find({ role: 'student' }).lean();
  const ids = students.map(s => s._id);

  console.log('Found', students.length, "users with role='student'");
  if (students.length > 0) console.log('Example:', students.slice(0,5).map(s => ({ _id: s._id, emailId: s.emailId, name: s.name })));

  // Related counts
  const studentDocsCount = await Student.countDocuments({ userId: { $in: ids } });
  const offersCount = await Offer.countDocuments({ studentId: { $in: ids } });
  const companiesWithPlaced = await Company.countDocuments({ placedStudents: { $in: ids } });
  const shortlistsCount = await Shortlist.countDocuments({ studentId: { $in: ids } });

  console.log('Related counts:');
  console.log('  Student docs:', studentDocsCount);
  console.log('  Offers:', offersCount);
  console.log('  Companies with placedStudents:', companiesWithPlaced);
  console.log('  Shortlists referencing:', shortlistsCount);

  if (opts.dryRun && !opts.confirm) {
    console.log('\nDry-run; no changes made. To perform deletion run with --confirm.');
    process.exit(0);
  }

  // Back up related data before deletion
  const backupDir = opts.backupDir || './scripts/backups';
  ensureDir(backupDir);
  const ts = timestamp();
  const usersBackup = path.join(backupDir, `users_students_backup_${ts}.json`);
  const studentsBackup = path.join(backupDir, `students_backup_${ts}.json`);
  const offersBackup = path.join(backupDir, `offers_backup_${ts}.json`);

  console.log('Writing backups to', backupDir);
  fs.writeFileSync(usersBackup, JSON.stringify(students, null, 2));
  const studentDocs = await Student.find({ userId: { $in: ids } }).lean();
  fs.writeFileSync(studentsBackup, JSON.stringify(studentDocs, null, 2));
  const offerDocs = await Offer.find({ studentId: { $in: ids } }).lean();
  fs.writeFileSync(offersBackup, JSON.stringify(offerDocs, null, 2));

  // Perform deletions/cleanup
  console.log('Deleting User documents...');
  const delUsers = await User.deleteMany({ _id: { $in: ids } });
  console.log('Deleted users:', delUsers.deletedCount || 0);

  console.log('Deleting Student documents...');
  const delStudents = await Student.deleteMany({ userId: { $in: ids } });
  console.log('Deleted students:', delStudents.deletedCount || 0);

  console.log('Deleting Offer documents...');
  const delOffers = await Offer.deleteMany({ studentId: { $in: ids } });
  console.log('Deleted offers:', delOffers.deletedCount || 0);

  console.log('Removing users from Company.placedStudents arrays...');
  const updCompanies = await Company.updateMany(
    { placedStudents: { $in: ids } },
    { $pull: { placedStudents: { $in: ids } } }
  );
  console.log('Companies modified:', updCompanies.modifiedCount || 0);

  console.log('Updating Shortlist entries...');
  const updShortlists = await Shortlist.updateMany(
    { studentId: { $in: ids } },
    { $set: { isStudentPlaced: false, studentPlacedCompany: '' } }
  );
  console.log('Shortlists modified:', updShortlists.modifiedCount || 0);

  console.log('Deletion and cleanup complete. Backups saved to:', backupDir);
  process.exit(0);
};

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
