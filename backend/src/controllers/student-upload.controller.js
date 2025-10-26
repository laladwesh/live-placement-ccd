// backend/src/controllers/student-upload.controller.js
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import csv from "csv-parser";
import { Readable } from "stream";
import { logger } from "../utils/logger.js";

/**
 * Upload students from CSV
 * POST /api/admin/students/upload
 * Expects multipart/form-data with 'file' field
 * CSV Format: email,name,rollNumber,phoneNo
 */
export const uploadStudentsCSV = async (req, res) => {
  try {
    console.log("📤 STUDENT CSV UPLOAD:");
    console.log("   Admin:", req.user.emailId);
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = [];
    const errors = [];
    let lineNumber = 1; // Start at 1 (header is line 0)

    // Parse CSV from buffer
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (row) => {
          lineNumber++;
          results.push({ ...row, lineNumber });
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`   📊 Parsed ${results.length} rows from CSV`);

    // Validate and process each student
    const created = [];
    const updated = [];
    const skipped = [];

    for (const row of results) {
      const { email, emailId, name, rollNumber, phoneNo, lineNumber } = row;
      
      // Support both 'email' and 'emailId' column names
      const studentEmail = (emailId || email || "").trim().toLowerCase();
      const studentName = (name || "").trim();
      const studentRollNumber = (rollNumber || "").trim();
      const studentPhoneNo = (phoneNo || "").trim();

      // Validate required fields
      if (!studentEmail) {
        errors.push(`Line ${lineNumber}: Missing email`);
        skipped.push({ lineNumber, email: studentEmail, reason: "Missing email" });
        continue;
      }

      if (!studentName) {
        errors.push(`Line ${lineNumber}: Missing name for ${studentEmail}`);
        skipped.push({ lineNumber, email: studentEmail, reason: "Missing name" });
        continue;
      }

      // Check if user already exists
      let user = await User.findOne({ emailId: studentEmail });

      if (user) {
        // User exists - check if it's a student
        if (user.role !== "student") {
          errors.push(`Line ${lineNumber}: ${studentEmail} exists but is not a student (role: ${user.role})`);
          skipped.push({ lineNumber, email: studentEmail, reason: `Already exists as ${user.role}` });
          continue;
        }

        // Update user details
        user.name = studentName;
        user.phoneNo = studentPhoneNo;
        await user.save();

        // Check if Student document exists
        let studentDoc = await Student.findOne({ userId: user._id });
        if (!studentDoc) {
          studentDoc = new Student({
            userId: user._id,
            rollNumber: studentRollNumber,
            isPlaced: false,
            shortlistedCompanies: [],
            waitlistedCompanies: [],
            placedCompany: null
          });
          await studentDoc.save();
        } else {
          // Update roll number if provided
          if (studentRollNumber) {
            studentDoc.rollNumber = studentRollNumber;
            await studentDoc.save();
          }
        }

        updated.push({ email: studentEmail, name: studentName });
      } else {
        // Create new user
        user = new User({
          name: studentName,
          emailId: studentEmail,
          phoneNo: studentPhoneNo,
          role: "student",
          isAllowed: true,
          providers: []
        });
        await user.save();

        // Create Student document
        const studentDoc = new Student({
          userId: user._id,
          rollNumber: studentRollNumber,
          isPlaced: false,
          shortlistedCompanies: [],
          waitlistedCompanies: [],
          placedCompany: null
        });
        await studentDoc.save();

        created.push({ email: studentEmail, name: studentName });
      }
    }

    logger.info(`Student CSV upload by ${req.user.emailId}: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped`);

    return res.status(200).json({
      success: true,
      message: "Students uploaded successfully",
      summary: {
        total: results.length,
        created: created.length,
        updated: updated.length,
        skipped: skipped.length
      },
      details: {
        created,
        updated,
        skipped,
        errors
      }
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ 
        success: false,
        message: err.message
      });
    }
    logger.error("uploadStudentsCSV error:", err);
    return res.status(500).json({ 
      message: "Server error during CSV upload",
      error: err.message 
    });
  }
};

/**
 * Get all students
 * GET /api/admin/students
 */
export const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate('userId', 'name emailId phoneNo role')
      .populate('shortlistedCompanies', 'name')
      .populate('waitlistedCompanies', 'name')
      .populate('placedCompany', 'name')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: students.length,
      students
    });
  } catch (err) {
    logger.error("getAllStudents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add single student manually
 * POST /api/admin/students
 * Body: { email, name, rollNumber, phoneNo }
 */
export const addStudentManually = async (req, res) => {
  try {
    console.log("➕ ADD STUDENT MANUALLY:");
    console.log("   Admin:", req.user.emailId);
    console.log("   Data:", req.body);

    const { email, emailId, name, rollNumber, phoneNo } = req.body;
    
    // Support both 'email' and 'emailId' field names
    const studentEmail = (emailId || email || "").trim().toLowerCase();
    const studentName = (name || "").trim();
    const studentRollNumber = (rollNumber || "").trim();
    const studentPhoneNo = (phoneNo || "").trim();

    // Validate required fields
    if (!studentEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!studentName) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ emailId: studentEmail });
    if (existingUser) {
      return res.status(409).json({ 
        message: `Student with email ${studentEmail} already exists` 
      });
    }

    // Create new user
    const user = new User({
      name: studentName,
      emailId: studentEmail,
      phoneNo: studentPhoneNo,
      role: "student",
      isAllowed: true,
      providers: []
    });
    await user.save();

    // Create Student document
    const studentDoc = new Student({
      userId: user._id,
      rollNumber: studentRollNumber,
      isPlaced: false,
      shortlistedCompanies: [],
      waitlistedCompanies: [],
      placedCompany: null
    });
    await studentDoc.save();

    // Populate for response
    await studentDoc.populate('userId', 'name emailId phoneNo role');

    logger.info(`Student created manually by ${req.user.emailId}: ${studentEmail}`);

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: studentDoc
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ 
        success: false,
        message: err.message
      });
    }
    logger.error("addStudentManually error:", err);
    return res.status(500).json({ 
      message: "Server error",
      error: err.message 
    });
  }
};
