// backend/src/controllers/shortlist.controller.js
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Shortlist, { Status, Stage } from "../models/shortlist.model.js";
import { logger } from "../utils/logger.js";
import { emitStudentAdded, emitStudentRemoved } from "../config/socket.js";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * Upload CSV to add students to company shortlist
 * POST /api/admin/companies/:companyId/shortlist/upload
 * CSV Format: email,status (status: shortlisted or waitlisted)
 * Note: Students must already exist in database (uploaded via student master CSV first)
 */
export const uploadShortlistCSV = async (req, res) => {
  try {
    const { companyId } = req.params;

    // console.log("📤 COMPANY SHORTLIST CSV UPLOAD:");
    // console.log("   Company ID:", companyId);
    // console.log("   Admin:", req.user?.emailId);

    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const results = [];
    const errors = [];
    let lineNumber = 1; // Start from 1 (header is line 0)

    // Parse CSV from buffer
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    await new Promise((resolve, reject) => {
      bufferStream
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          // Support both 'email' and 'emailId' column names
          const emailValue = row.email || row.emailId;
          
          // Validate row - email is required
          if (!emailValue || !emailValue.trim()) {
            errors.push({ line: lineNumber, error: "Missing email" });
            return;
          }

          results.push({
            email: emailValue.trim().toLowerCase(),
            status: row.status?.trim().toLowerCase() || "shortlisted",
            lineNumber
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`  Parsed ${results.length} rows from CSV`);

    if (results.length === 0) {
      return res.status(400).json({ 
        message: "No valid entries found in CSV",
        errors 
      });
    }

    // Process each student
    const added = [];
    const updated = [];
    const failed = [];
    const notFound = [];

    for (const entry of results) {
      try {
        // Find user - student MUST exist in database already
        const user = await User.findOne({ emailId: entry.email });
        
        if (!user) {
          notFound.push({ 
            email: entry.email, 
            line: entry.lineNumber,
            error: "Student not found in database. Upload students first." 
          });
          continue;
        }

        // Verify user is a student
        if (user.role !== "student") {
          failed.push({ 
            email: entry.email, 
            line: entry.lineNumber,
            error: `User exists but is not a student (role: ${user.role})` 
          });
          continue;
        }

        // Ensure Student document exists
        let student = await Student.findOne({ userId: user._id });
        if (!student) {
          student = new Student({
            userId: user._id,
            isPlaced: false,
            shortlistedCompanies: [],
            waitlistedCompanies: [],
            placedCompany: null
          });
          await student.save();
        }

        // Check if shortlist entry already exists
        let shortlist = await Shortlist.findOne({ 
          studentId: user._id, 
          companyId: company._id 
        });

        const isShortlisted = entry.status === "shortlisted";

        if (shortlist) {
          // Update existing shortlist
          shortlist.status = isShortlisted ? Status.SHORTLISTED : Status.WAITLISTED;
          shortlist.studentEmail = user.emailId;
          shortlist.companyName = company.name;
          await shortlist.save();
          updated.push({ email: entry.email, name: user.name });
        } else {
          // Create new shortlist entry
          shortlist = new Shortlist({
            studentId: user._id,
            companyId: company._id,
            studentEmail: user.emailId,
            companyName: company.name,
            status: isShortlisted ? Status.SHORTLISTED : Status.WAITLISTED,
            stage: null,
            interviewStatus: null,
            isOffered: false
          });
          await shortlist.save();
          added.push({ email: entry.email, name: user.name });

          // Update Student document
          const student = await Student.findOne({ userId: user._id });
          if (isShortlisted && !student.shortlistedCompanies.includes(company._id)) {
            student.shortlistedCompanies.push(company._id);
          } else if (!isShortlisted && !student.waitlistedCompanies.includes(company._id)) {
            student.waitlistedCompanies.push(company._id);
          }
          await student.save();

          // Update Company document
          if (isShortlisted && !company.shortlistedStudents.includes(user._id)) {
            company.shortlistedStudents.push(user._id);
          } else if (!isShortlisted && !company.waitlistedStudents.includes(user._id)) {
            company.waitlistedStudents.push(user._id);
          }
          await company.save();
        }
      } catch (err) {
        logger.error(`Error processing ${entry.email}:`, err);
        failed.push({ email: entry.email, error: err.message });
      }
    }

    logger.info(`CSV upload complete for ${company.name}: ${added.length} added, ${updated.length} updated, ${failed.length} failed, ${notFound.length} not found`);

    // Emit socket event for bulk student addition
    if (added.length > 0 || updated.length > 0) {
      emitStudentAdded(company._id.toString(), {
        companyId: company._id,
        bulkUpload: true,
        count: added.length + updated.length
      });
    }

    return res.json({
      message: "CSV processed successfully",
      summary: {
        total: results.length,
        added: added.length,
        updated: updated.length,
        failed: failed.length,
        notFound: notFound.length
      },
      details: {
        added,
        updated,
        failed,
        notFound,
        errors
      }
    });

  } catch (err) {
    logger.error("uploadShortlistCSV error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * Add single student to company shortlist manually
 * POST /api/admin/companies/:companyId/shortlist
 * Body: { email, status }
 */
export const addStudentToShortlist = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, status } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const emailLower = email.trim().toLowerCase();

    // Student MUST already exist in database
    const user = await User.findOne({ emailId: emailLower });
    
    if (!user) {
      return res.status(404).json({ 
        message: "Student not found in database. Please upload master student list first." 
      });
    }

    // Verify user is a student
    if (user.role !== "student") {
      return res.status(400).json({ 
        message: `User exists but is not a student (role: ${user.role})` 
      });
    }

    // Ensure Student document exists
    let student = await Student.findOne({ userId: user._id });
    if (!student) {
      student = new Student({
        userId: user._id,
        isPlaced: false,
        shortlistedCompanies: [],
        waitlistedCompanies: [],
        placedCompany: null
      });
      await student.save();
    }

    // Check if already shortlisted
    const existing = await Shortlist.findOne({ 
      studentId: user._id, 
      companyId: company._id 
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Student is already in the shortlist for this company" 
      });
    }

    const isShortlisted = status === "waitlisted" ? false : true;

    // Create shortlist entry
    const shortlist = new Shortlist({
      studentId: user._id,
      companyId: company._id,
      studentEmail: user.emailId,
      companyName: company.name,
      status: isShortlisted ? Status.SHORTLISTED : Status.WAITLISTED,
      isOffered: false
    });

    await shortlist.save();
    await shortlist.populate('studentId', 'name emailId phoneNo');

    // Update Student document
    if (isShortlisted && !student.shortlistedCompanies.includes(company._id)) {
      student.shortlistedCompanies.push(company._id);
    } else if (!isShortlisted && !student.waitlistedCompanies.includes(company._id)) {
      student.waitlistedCompanies.push(company._id);
    }
    await student.save();

    // Update Company document
    if (isShortlisted && !company.shortlistedStudents.includes(user._id)) {
      company.shortlistedStudents.push(user._id);
    } else if (!isShortlisted && !company.waitlistedStudents.includes(user._id)) {
      company.waitlistedStudents.push(user._id);
    }
    await company.save();

    logger.info(`Student ${user.emailId} added to ${company.name} by ${req.user.emailId}`);

    // Emit socket event for real-time update
    emitStudentAdded(company._id.toString(), {
      shortlistId: shortlist._id,
      companyId: company._id,
      student: user._id,
      status: shortlist.status
    });

    return res.status(201).json({
      message: "Student added to shortlist successfully",
      shortlist
    });

  } catch (err) {
    logger.error("addStudentToShortlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all shortlisted students for a company
 * GET /api/admin/companies/:companyId/shortlist
 */
export const getCompanyShortlist = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const shortlists = await Shortlist.find({ companyId: companyId })
      .populate('studentId', 'name emailId phoneNo')
      .sort({ createdAt: -1 });

    // Get Student documents to check placement status
    const studentIds = shortlists.map(s => s.studentId._id);
    const students = await Student.find({ userId: { $in: studentIds } });
    const studentMap = new Map(students.map(s => [s.userId.toString(), s]));

    // Enrich shortlists with placement status and format for frontend
    const enrichedShortlists = shortlists.map(s => {
      const studentDoc = studentMap.get(s.studentId._id.toString());
      
      // Determine currentStage based on isOffered, stage, or status
      let currentStage;
      if (s.isOffered) {
        currentStage = "OFFERED";
      } else if (s.stage) {
        currentStage = s.stage; // R1, R2, R3, R4, or REJECTED
      } else {
        currentStage = s.status.toUpperCase(); // SHORTLISTED or WAITLISTED
      }

      return {
        _id: s._id,
        companyId: s.companyId,
        companyName: s.companyName,
        status: s.status,
        stage: s.stage,
        currentStage: currentStage,
        interviewStatus: s.interviewStatus,
        isOffered: s.isOffered,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        student: {
          _id: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.emailId,
          phoneNumber: s.studentId.phoneNo,
          rollNumber: studentDoc?.rollNumber,
          isPlaced: studentDoc?.isPlaced || false,
          isBlocked: studentDoc?.isBlocked || false
        }
      };
    });

    const stats = {
      total: shortlists.length,
      shortlisted: enrichedShortlists.filter(s => s.currentStage === "SHORTLISTED").length,
      waitlisted: enrichedShortlists.filter(s => s.currentStage === "WAITLISTED").length,
      inProgress: enrichedShortlists.filter(s => s.stage && [Stage.R1, Stage.R2, Stage.R3, Stage.R4].includes(s.stage)).length,
      offered: enrichedShortlists.filter(s => s.isOffered).length,
      rejected: enrichedShortlists.filter(s => s.stage === "REJECTED").length,
      placed: students.filter(s => s.isPlaced).length
    };

    return res.json({
      company,
      shortlists: enrichedShortlists,
      stats
    });

  } catch (err) {
    logger.error("getCompanyShortlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Remove student from shortlist
 * DELETE /api/admin/companies/:companyId/shortlist/:shortlistId
 */
export const removeStudentFromShortlist = async (req, res) => {
  try {
    const { companyId, shortlistId } = req.params;

    const shortlist = await Shortlist.findOne({ 
      _id: shortlistId, 
      companyId: companyId 
    });

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    const studentId = shortlist.studentId.toString();
    const isShortlisted = shortlist.status === Status.SHORTLISTED;

    await shortlist.deleteOne();

    // Update Student document
    const student = await Student.findOne({ userId: studentId });
    if (student) {
      if (isShortlisted) {
        student.shortlistedCompanies = student.shortlistedCompanies.filter(
          id => id.toString() !== companyId
        );
      } else {
        student.waitlistedCompanies = student.waitlistedCompanies.filter(
          id => id.toString() !== companyId
        );
      }
      await student.save();
    }

    // Update Company document
    const company = await Company.findById(companyId);
    if (company) {
      if (isShortlisted) {
        company.shortlistedStudents = company.shortlistedStudents.filter(
          id => id.toString() !== studentId
        );
      } else {
        company.waitlistedStudents = company.waitlistedStudents.filter(
          id => id.toString() !== studentId
        );
      }
      await company.save();
    }

    logger.info(`Shortlist entry ${shortlistId} deleted by ${req.user.emailId}`);

    // Emit socket event for real-time update
    emitStudentRemoved(companyId, studentId);

    return res.json({ message: "Student removed from shortlist successfully" });

  } catch (err) {
    logger.error("removeStudentFromShortlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Export multer middleware
export const uploadMiddleware = upload.single('csvFile');
