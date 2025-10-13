// backend/src/controllers/poc.controller.js
import Company from "../models/company.model.js";
import Shortlist, { Stage } from "../models/shortlist.model.js";
import Offer, { OfferStatus } from "../models/offer.model.js";
import User from "../models/user.model.js";
import { logger } from "../utils/logger.js";
import { emitShortlistUpdate, emitOfferCreated, emitStudentAdded } from "../config/socket.js";

/**
 * Get POC's assigned companies
 * GET /api/poc/companies
 */
export const getPOCCompanies = async (req, res) => {
  try {
    const pocId = req.user._id;

    // Find companies where this POC is assigned
    const companies = await Company.find({ pocs: pocId })
      .populate('pocs', 'name email phoneNumber')
      .sort({ name: 1 });

    return res.json({ companies });
  } catch (err) {
    logger.error("getPOCCompanies error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get shortlisted students for a company (POC view)
 * GET /api/poc/companies/:companyId/students
 */
export const getPOCCompanyStudents = async (req, res) => {
  try {
    const { companyId } = req.params;
    const pocId = req.user._id;

    // Verify POC is assigned to this company
    const company = await Company.findOne({ 
      _id: companyId, 
      pocs: pocId 
    }).populate('pocs', 'name email phoneNumber');

    if (!company) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
    }

    // Get all shortlisted students
    const shortlists = await Shortlist.find({ company: companyId })
      .populate('student', 'name email rollNumber phoneNumber isPlaced isBlocked')
      .populate('updatedByPocId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate stats
    const stats = {
      total: shortlists.length,
      shortlisted: shortlists.filter(s => s.currentStage === Stage.SHORTLISTED).length,
      waitlisted: shortlists.filter(s => s.currentStage === "WAITLISTED").length,
      r1: shortlists.filter(s => s.currentStage === "R1").length,
      r2: shortlists.filter(s => s.currentStage === "R2").length,
      r3: shortlists.filter(s => s.currentStage === "R3").length,
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
    logger.error("getPOCCompanyStudents error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update student interview stage
 * PATCH /api/poc/shortlist/:shortlistId/stage
 * Body: { stage: "R1" | "R2" | "R3" | "REJECTED" }
 */
export const updateInterviewStage = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const { stage } = req.body;
    const pocId = req.user._id;

    // Validate stage
    const validStages = ["R1", "R2", "R3", Stage.REJECTED];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ 
        message: "Invalid stage. Must be R1, R2, R3, or REJECTED" 
      });
    }

    const shortlist = await Shortlist.findById(shortlistId)
      .populate('student', 'name email isPlaced isBlocked')
      .populate('company', 'name pocs');

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    // Verify POC is assigned to this company
    if (!shortlist.company.pocs.some(poc => poc.toString() === pocId.toString())) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
    }

    // Check if student is already placed
    if (shortlist.student.isPlaced) {
      return res.status(400).json({ 
        message: "Student is already placed and cannot be modified" 
      });
    }

    // Update stage
    shortlist.currentStage = stage;
    shortlist.updatedByPocId = pocId;
    shortlist.updatedAt = new Date();
    await shortlist.save();

    await shortlist.populate('updatedByPocId', 'name email');

    logger.info(`POC ${req.user.email} updated ${shortlist.student.email} to stage ${stage}`);

    // Emit socket event for real-time update
    emitShortlistUpdate(shortlist.company._id.toString(), shortlist.student._id.toString(), {
      shortlistId: shortlist._id,
      companyId: shortlist.company._id,
      studentId: shortlist.student._id,
      stage: shortlist.currentStage,
      updatedAt: shortlist.updatedAt
    });

    return res.json({
      message: "Interview stage updated successfully",
      shortlist
    });
  } catch (err) {
    logger.error("updateInterviewStage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create offer for a student
 * POST /api/poc/shortlist/:shortlistId/offer
 */
export const createOffer = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const pocId = req.user._id;

    const shortlist = await Shortlist.findById(shortlistId)
      .populate('student', 'name email isPlaced isBlocked')
      .populate('company', 'name pocs');

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    // Verify POC is assigned to this company
    if (!shortlist.company.pocs.some(poc => poc.toString() === pocId.toString())) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
    }

    // Check if student is already placed
    if (shortlist.student.isPlaced) {
      return res.status(400).json({ 
        message: "Student is already placed and cannot receive another offer" 
      });
    }

    // Check if offer already exists
    const existingOffer = await Offer.findOne({
      student: shortlist.student._id,
      company: shortlist.company._id
    });

    if (existingOffer) {
      return res.status(400).json({ 
        message: "Offer already exists for this student" 
      });
    }

    // Create offer
    const offer = new Offer({
      student: shortlist.student._id,
      company: shortlist.company._id,
      offerStatus: OfferStatus.PENDING,
      remarks: `Offer created by ${req.user.name}`
    });

    await offer.save();

    // Update shortlist stage to OFFERED
    shortlist.currentStage = Stage.OFFERED;
    shortlist.updatedByPocId = pocId;
    shortlist.updatedAt = new Date();
    await shortlist.save();

    await offer.populate('student', 'name email phoneNumber');
    await offer.populate('company', 'name venue');

    logger.info(`POC ${req.user.email} created offer for ${shortlist.student.email} at ${shortlist.company.name}`);

    // Emit socket events for real-time update
    emitOfferCreated(shortlist.company._id.toString(), shortlist.student._id.toString(), {
      offerId: offer._id,
      companyId: offer.company._id,
      studentId: offer.student._id,
      companyName: offer.company.name
    });

    emitShortlistUpdate(shortlist.company._id.toString(), shortlist.student._id.toString(), {
      shortlistId: shortlist._id,
      companyId: shortlist.company._id,
      studentId: shortlist.student._id,
      stage: shortlist.currentStage,
      updatedAt: shortlist.updatedAt
    });

    return res.status(201).json({
      message: "Offer created successfully",
      offer,
      shortlist
    });
  } catch (err) {
    logger.error("createOffer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add walk-in student to company
 * POST /api/poc/companies/:companyId/walkin
 * Body: { email, name, phoneNumber }
 */
export const addWalkInStudent = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rollNumber, email, name, phoneNumber } = req.body;
    const pocId = req.user._id;

    if (!rollNumber || !rollNumber.trim()) {
      return res.status(400).json({ message: "Roll number is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Verify POC is assigned to this company
    const company = await Company.findOne({ 
      _id: companyId, 
      pocs: pocId 
    });

    if (!company) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
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
    }

    // Check if already shortlisted
    const existing = await Shortlist.findOne({ 
      student: user._id, 
      company: companyId 
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Student is already in the shortlist for this company" 
      });
    }

    // Create shortlist entry as walk-in
    const shortlist = new Shortlist({
      student: user._id,
      company: companyId,
      currentStage: Stage.SHORTLISTED,
      remarks: "Walk-in candidate",
      updatedByPocId: pocId
    });

    await shortlist.save();
    await shortlist.populate('student', 'name email rollNumber phoneNumber');

    logger.info(`POC ${req.user.email} added walk-in ${user.email} to ${company.name}`);

    // Emit socket event for real-time update
    emitStudentAdded(companyId, {
      shortlistId: shortlist._id,
      companyId: companyId,
      student: shortlist.student._id,
      stage: shortlist.currentStage
    });

    return res.status(201).json({
      message: "Walk-in student added successfully",
      shortlist
    });
  } catch (err) {
    logger.error("addWalkInStudent error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Mark company interview process as completed
 * POST /api/poc/companies/:companyId/complete
 */
export const markProcessCompleted = async (req, res) => {
  try {
    const { companyId } = req.params;
    const pocId = req.user._id;

    // Verify POC is assigned to this company
    const company = await Company.findOne({ 
      _id: companyId, 
      pocs: pocId 
    });

    if (!company) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
    }

    // Mark company as completed
    company.isProcessCompleted = true;
    await company.save();

    // Get all shortlisted students for this company
    const shortlists = await Shortlist.find({ company: companyId })
      .populate('student', '_id');

    // Remove company from each student's shortlistedCompanies array
    const studentIds = shortlists.map(s => s.student._id);
    
    // This will be handled on the frontend by filtering out completed companies
    // We're just marking the company as completed here

    logger.info(`POC ${req.user.email} marked ${company.name} as process completed`);

    return res.json({
      message: "Company interview process marked as completed",
      company
    });
  } catch (err) {
    logger.error("markProcessCompleted error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
