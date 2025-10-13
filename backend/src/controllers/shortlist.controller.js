// backend/src/controllers/shortlist.controller.js
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import Shortlist, { Stage } from "../models/shortlist.model.js";
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
 * CSV Format: rollNumber,email,name,phoneNumber,status (status: shortlisted or waitlisted)
 */
export const uploadShortlistCSV = async (req, res) => {
  try {
    const { companyId } = req.params;

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
          // Validate row - rollNumber is now required
          if (!row.rollNumber || !row.rollNumber.trim()) {
            errors.push({ line: lineNumber, error: "Missing roll number" });
            return;
          }
          if (!row.email || !row.email.trim()) {
            errors.push({ line: lineNumber, error: "Missing email" });
            return;
          }

          results.push({
            rollNumber: row.rollNumber.trim().toUpperCase(),
            email: row.email.trim().toLowerCase(),
            name: row.name?.trim() || "",
            phoneNumber: row.phoneNumber?.trim() || "",
            status: row.status?.trim().toLowerCase() || "shortlisted"
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

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

    for (const entry of results) {
      try {
        // Find or create user by roll number (unique identifier)
        let user = await User.findOne({ rollNumber: entry.rollNumber });
        
        if (!user) {
          // Create new student user
          user = new User({
            rollNumber: entry.rollNumber,
            email: entry.email,
            name: entry.name || entry.email.split('@')[0],
            phoneNumber: entry.phoneNumber,
            role: "student",
            isAllowed: true
          });
          await user.save();
        } else {
          // Update existing user info if provided
          if (entry.email && user.email !== entry.email) user.email = entry.email;
          if (entry.name && !user.name) user.name = entry.name;
          if (entry.phoneNumber && !user.phoneNumber) user.phoneNumber = entry.phoneNumber;
          await user.save();
        }

        // Check if shortlist entry already exists
        let shortlist = await Shortlist.findOne({ 
          student: user._id, 
          company: company._id 
        });

        if (shortlist) {
          // Update existing shortlist
          shortlist.currentStage = entry.status === "waitlisted" ? "WAITLISTED" : Stage.SHORTLISTED;
          shortlist.updatedByPocId = req.user._id;
          shortlist.updatedAt = new Date();
          await shortlist.save();
          updated.push({ rollNumber: entry.rollNumber, email: entry.email, name: user.name });
        } else {
          // Create new shortlist entry
          shortlist = new Shortlist({
            student: user._id,
            company: company._id,
            currentStage: entry.status === "waitlisted" ? "WAITLISTED" : Stage.SHORTLISTED,
            updatedByPocId: req.user._id
          });
          await shortlist.save();
          added.push({ rollNumber: entry.rollNumber, email: entry.email, name: user.name });
        }
      } catch (err) {
        logger.error(`Error processing ${entry.rollNumber} (${entry.email}):`, err);
        failed.push({ rollNumber: entry.rollNumber, email: entry.email, error: err.message });
      }
    }

    logger.info(`CSV upload complete for ${company.name}: ${added.length} added, ${updated.length} updated, ${failed.length} failed`);

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
        failed: failed.length
      },
      details: { added, updated, failed },
      csvErrors: errors
    });

  } catch (err) {
    logger.error("uploadShortlistCSV error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * Add single student to company shortlist manually
 * POST /api/admin/companies/:companyId/shortlist
 * Body: { rollNumber, email, name, phoneNumber, status }
 */
export const addStudentToShortlist = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rollNumber, email, name, phoneNumber, status } = req.body;

    if (!rollNumber || !rollNumber.trim()) {
      return res.status(400).json({ message: "Roll number is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const rollNumberUpper = rollNumber.trim().toUpperCase();
    const emailLower = email.trim().toLowerCase();

    // Find or create user by roll number
    let user = await User.findOne({ rollNumber: rollNumberUpper });
    
    if (!user) {
      user = new User({
        rollNumber: rollNumberUpper,
        email: emailLower,
        name: name?.trim() || emailLower.split('@')[0],
        phoneNumber: phoneNumber?.trim() || "",
        role: "student",
        isAllowed: true
      });
      await user.save();
    } else {
      // Update user info if provided and not already set
      let updated = false;
      if (email && emailLower !== user.email) {
        user.email = emailLower;
        updated = true;
      }
      if (name && name.trim() && !user.name) {
        user.name = name.trim();
        updated = true;
      }
      if (phoneNumber && phoneNumber.trim() && !user.phoneNumber) {
        user.phoneNumber = phoneNumber.trim();
        updated = true;
      }
      if (updated) await user.save();
    }

    // Check if already shortlisted
    const existing = await Shortlist.findOne({ 
      student: user._id, 
      company: company._id 
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Student is already shortlisted for this company" 
      });
    }

    // Create shortlist entry
    const shortlist = new Shortlist({
      student: user._id,
      company: company._id,
      currentStage: status === "waitlisted" ? "WAITLISTED" : Stage.SHORTLISTED,
      updatedByPocId: req.user._id
    });

    await shortlist.save();
    await shortlist.populate('student', 'name email rollNumber phoneNumber');

    logger.info(`Student ${user.rollNumber} (${user.email}) added to ${company.name} by ${req.user.email}`);

    // Emit socket event for real-time update
    emitStudentAdded(company._id.toString(), {
      shortlistId: shortlist._id,
      companyId: company._id,
      student: user._id,
      stage: shortlist.currentStage
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

    const shortlists = await Shortlist.find({ company: companyId })
      .populate('student', 'name email rollNumber phoneNumber isPlaced isBlocked')
      .populate('updatedByPocId', 'name email')
      .sort({ createdAt: -1 });

    const stats = {
      total: shortlists.length,
      shortlisted: shortlists.filter(s => s.currentStage === Stage.SHORTLISTED).length,
      waitlisted: shortlists.filter(s => s.currentStage === "WAITLISTED").length,
      inProgress: shortlists.filter(s => ["R1", "R2", "R3"].includes(s.currentStage)).length,
      offered: shortlists.filter(s => s.currentStage === Stage.OFFERED).length,
      rejected: shortlists.filter(s => s.currentStage === Stage.REJECTED).length,
      placed: shortlists.filter(s => s.student?.isPlaced).length
    };

    return res.json({
      company,
      shortlists,
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
      company: companyId 
    });

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    const studentId = shortlist.student.toString();

    await shortlist.deleteOne();

    logger.info(`Shortlist entry ${shortlistId} deleted by ${req.user.email}`);

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
