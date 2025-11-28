// ...existing code...
// admin_revert_placement.js
// Usage: node scripts/admin_revert_placement.js <rollNumber>
// Reverts a student's placement: sets all offers to pending, removes from placed lists, etc. (does NOT revert sent emails)

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Student from "../src/models/student.model.js";
import Offer from "../src/models/offer.model.js";
import Company from "../src/models/company.model.js";
import { connectDB } from "../src/config/db.js";

const main = async () => {
  const rollNumber = process.argv[2];
  if (!rollNumber) {
    console.error("Usage: node scripts/admin_revert_placement.js <rollNumber>");
    process.exit(1);
  }
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error("[ERROR] Please set MONGO_URI in .env");
      process.exit(1);
    }
    await connectDB(MONGO_URI);

    // 1. Find student by rollNumber
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      console.error(`[ERROR] No student found with rollNumber ${rollNumber}`);
      process.exit(1);
    }

    // 2. Set all offers for this student to PENDING (use student.userId)
    const offers = await Offer.find({ studentId: student.userId });
    for (const offer of offers) {
      offer.offerStatus = "PENDING";
      offer.approvalStatus = "PENDING";
      offer.remarks = "";
      await offer.save();
    }

    // 3. Remove student from all company placed lists (use student.userId)
    await Company.updateMany(
      { placedStudents: student.userId },
      { $pull: { placedStudents: student.userId } }
    );


    // 4. Unset isPlaced and placedCompany in student
    await Student.updateOne(
      { _id: student._id },
      { $set: { isPlaced: false, placedCompany: null } }
    );

    // 5. Reset isStudentPlaced and studentPlacedCompany in all Shortlists for this student
    const Shortlist = (await import("../src/models/shortlist.model.js")).default;
    await Shortlist.updateMany(
      { studentId: student.userId },
      { $set: { isStudentPlaced: false, studentPlacedCompany: "" } }
    );

    console.log(`Placement reverted for student ${rollNumber}. All offers set to PENDING. Student removed from placed lists and shortlists. (Emails not reverted)`);
    process.exit(0);
  } catch (err) {
    console.error("[ERROR] Revert error:", err);
    process.exit(1);
  }
};

main();
