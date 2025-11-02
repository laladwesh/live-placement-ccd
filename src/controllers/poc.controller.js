// backend/src/controllers/poc.controller.js
import Company from "../models/company.model.js";
import Shortlist, { Status, Stage, InterviewStatus } from "../models/shortlist.model.js";
import Offer, { OfferStatus } from "../models/offer.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import { logger } from "../utils/logger.js";
import { emitShortlistUpdate, emitOfferCreated, emitStudentAdded, emitOfferStatusUpdate } from "../config/socket.js";
import { emitCompanyProcessChanged } from "../config/socket.js";

/**
 * Get POC's assigned companies
 * GET /api/poc/companies
 */
export const getPOCCompanies = async (req, res) => {
  try {
    const pocId = req.user._id;
    const userRole = req.user.role;

    // Build query based on role
    let query = { POCs: pocId };
    
    // If user is a POC (not admin), exclude completed processes
    if (userRole !== 'admin') {
      query.isProcessCompleted = false;
    }
    // Admins can see all companies even if process is completed

    // Find companies where this POC is assigned
    const companies = await Company.find(query)
      .populate('POCs', 'name emailId phoneNo')
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
    const userId = req.user._id;
    const userRole = req.user.role;

    // Admins can access any company
    // POCs can only access companies they're assigned to
    let company;
    
    if (userRole === 'admin') {
      // Admin can access any company (even completed processes)
      company = await Company.findById(companyId)
        .populate('POCs', 'name emailId phoneNo');
    } else {
      // POC must be assigned to this company AND process must not be completed
      company = await Company.findOne({ 
        _id: companyId, 
        POCs: userId,
        isProcessCompleted: false  // POCs cannot access completed processes
      }).populate('POCs', 'name emailId phoneNo');
    }

    if (!company) {
      return res.status(403).json({ 
        message: userRole === 'admin' 
          ? "Company not found" 
          : "You are not assigned to this company or the process is completed" 
      });
    }

    // Get all shortlisted students
    const shortlists = await Shortlist.find({ companyId: companyId })
      .populate('studentId', 'name emailId phoneNo')
      .sort({ createdAt: -1 });

    // Get Student documents for placement status
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

      // Check if student is placed at THIS specific company
      const isPlacedAtThisCompany = studentDoc?.isPlaced && 
        studentDoc?.placedCompany && 
        studentDoc.placedCompany.toString() === companyId.toString();

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
        isStudentPlaced: s.isStudentPlaced, // Student placed somewhere (this or other company)
        studentPlacedCompany: s.studentPlacedCompany, // Name of company where placed
        student: {
          _id: s.studentId._id,
          name: s.studentId.name,
          email: s.studentId.emailId,
          phoneNumber: s.studentId.phoneNo,
          rollNumber: studentDoc?.rollNumber,
          isPlaced: isPlacedAtThisCompany, // TRUE only if placed at THIS company
          isBlocked: studentDoc?.isBlocked || false
        }
      };
    });

    // Calculate stats based on company's maxRounds
    const maxRounds = company.maxRounds || 4;
    const stats = {
      total: shortlists.length,
      shortlisted: enrichedShortlists.filter(s => s.currentStage === "SHORTLISTED").length,
      waitlisted: enrichedShortlists.filter(s => s.currentStage === "WAITLISTED").length,
      offered: enrichedShortlists.filter(s => s.isOffered).length,
      placed: students.filter(s => s.isPlaced).length,
      rejected: enrichedShortlists.filter(s => s.stage === "REJECTED").length
    };

    // Add round stats dynamically based on maxRounds
    for (let i = 1; i <= maxRounds; i++) {
      stats[`r${i}`] = enrichedShortlists.filter(s => s.stage === `R${i}`).length;
    }

    return res.json({
      company,
      shortlists: enrichedShortlists,
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
 * Body: { stage: "R1" | "R2" | "R3" | "R4" | "REJECTED" }
 */
export const updateInterviewStage = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const { stage } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const shortlist = await Shortlist.findById(shortlistId)
      .populate('studentId', 'name emailId')
      .populate('companyId', 'name POCs maxRounds');

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    // Get company's maxRounds
    const maxRounds = shortlist.companyId.maxRounds || 4;
    
    // Build valid stages based on company's maxRounds
    const validStages = [Stage.REJECTED];
    for (let i = 1; i <= maxRounds; i++) {
      validStages.push(`R${i}`);
    }

    // Validate stage
    if (!validStages.includes(stage)) {
      return res.status(400).json({ 
        message: `Invalid stage. Must be R1-R${maxRounds} or REJECTED for this company` 
      });
    }

    // Admins can update any company, POCs only their assigned companies
    if (userRole !== 'admin') {
      // Verify POC is assigned to this company
      if (!shortlist.companyId.POCs.some(poc => poc.toString() === userId.toString())) {
        return res.status(403).json({ 
          message: "You are not assigned to this company" 
        });
      }
      
      // POCs cannot update completed processes
      if (shortlist.companyId.isProcessCompleted) {
        return res.status(403).json({ 
          message: "Cannot update interview stage - process is completed" 
        });
      }
    }

    // Check if student is already placed
    const student = await Student.findOne({ userId: shortlist.studentId._id });
    if (student && student.isPlaced) {
      return res.status(400).json({ 
        message: "Student is already placed and cannot be modified" 
      });
    }

    // Update stage
    shortlist.stage = stage;
    await shortlist.save();

    logger.info(`POC ${req.user.emailId} updated ${shortlist.studentId.emailId} to stage ${stage}`);

    // Emit socket event for real-time update
    emitShortlistUpdate(shortlist.companyId._id.toString(), shortlist.studentId._id.toString(), {
      shortlistId: shortlist._id,
      companyId: shortlist.companyId._id,
      studentId: shortlist.studentId._id,
      stage: shortlist.stage,
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
    const userId = req.user._id;
    const userRole = req.user.role;

    const shortlist = await Shortlist.findById(shortlistId)
      .populate('studentId', 'name emailId')
      .populate('companyId', 'name POCs');

    if (!shortlist) {
      return res.status(404).json({ message: "Shortlist entry not found" });
    }

    // Admins can create offers for any company, POCs only their assigned companies
    if (userRole !== 'admin') {
      // Verify POC is assigned to this company
      if (!shortlist.companyId.POCs.some(poc => poc.toString() === userId.toString())) {
        return res.status(403).json({ 
          message: "You are not assigned to this company" 
        });
      }
      
      // POCs cannot create offers for completed processes
      if (shortlist.companyId.isProcessCompleted) {
        return res.status(403).json({ 
          message: "Cannot create offer - process is completed" 
        });
      }
    }

    // Check if student is already placed
    const student = await Student.findOne({ userId: shortlist.studentId._id });
    if (student && student.isPlaced) {
      return res.status(400).json({ 
        message: "Student is already placed and cannot receive another offer" 
      });
    }

    // Check if offer already exists
    const existingOffer = await Offer.findOne({
      studentId: shortlist.studentId._id,
      companyId: shortlist.companyId._id
    });

    if (existingOffer) {
      return res.status(400).json({ 
        message: "Offer already exists for this student" 
      });
    }

    // Create offer with PENDING approval status (requires admin approval)
    const offer = new Offer({
      studentId: shortlist.studentId._id,
      companyId: shortlist.companyId._id,
      approvalStatus: "PENDING",  // Waiting for admin approval
      offerStatus: "PENDING",      // Will be sent to student after admin approves
      venue: shortlist.companyId.venue,
      remarks: `Offer created by ${req.user.name} (POC)`
    });

    await offer.save();

    // Update shortlist to mark as offered
    shortlist.isOffered = true;
    await shortlist.save();

    await offer.populate('studentId', 'name emailId phoneNo');
    await offer.populate('companyId', 'name venue');

    logger.info(`POC ${req.user.emailId} created offer for ${shortlist.studentId.emailId} at ${shortlist.companyId.name} - PENDING admin approval`);

    // Emit socket events for real-time update
    emitOfferCreated(shortlist.companyId._id.toString(), shortlist.studentId._id.toString(), {
      offerId: offer._id,
      companyId: offer.companyId._id,
      studentId: offer.studentId._id,
      companyName: offer.companyId.name,
      approvalStatus: "PENDING"
    });

    // Emit status update for admin dashboard
    emitOfferStatusUpdate({
      offerId: offer._id,
      studentId: offer.studentId._id.toString(),
      companyId: offer.companyId._id.toString(),
      studentName: offer.studentId.name,
      companyName: offer.companyId.name,
      approvalStatus: "PENDING",
      action: 'created'
    });

    emitShortlistUpdate(shortlist.companyId._id.toString(), shortlist.studentId._id.toString(), {
      shortlistId: shortlist._id,
      companyId: shortlist.companyId._id,
      studentId: shortlist.studentId._id,
      stage: shortlist.stage,
      updatedAt: shortlist.updatedAt
    });

    return res.status(201).json({
      message: "Offer created successfully and sent for admin approval",
      offer,
      shortlist,
      note: "Offer will be sent to student once admin approves it"
    });
  } catch (err) {
    logger.error("createOffer error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add walk-in student to company
 * POST /api/poc/companies/:companyId/walkin
 * Body: { email, name, phoneNo }
 */
export const addWalkInStudent = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, name, phoneNo } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Admins can add students to any company, POCs only their assigned companies
    let company;
    
    if (userRole === 'admin') {
      company = await Company.findById(companyId);
    } else {
      // Verify POC is assigned to this company AND process is not completed
      company = await Company.findOne({ 
        _id: companyId, 
        POCs: userId,
        isProcessCompleted: false  // POCs cannot add students to completed processes
      });
    }

    if (!company) {
      return res.status(403).json({ 
        message: userRole === 'admin' 
          ? "Company not found" 
          : "You are not assigned to this company or the process is completed" 
      });
    }

    const emailLower = email.trim().toLowerCase();

    // Find or create user by email
    let user = await User.findOne({ emailId: emailLower });
    
    if (!user) {
      user = new User({
        emailId: emailLower,
        name: name?.trim() || emailLower.split('@')[0],
        phoneNo: phoneNo?.trim() || "",
        role: "student",
        isAllowed: true
      });
      await user.save();

      // Create Student document
      const student = new Student({
        userId: user._id,
        isPlaced: false,
        shortlistedCompanies: [],
        waitlistedCompanies: [],
        placedCompany: null
      });
      await student.save();
    } else {
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
    }

    // Check if already shortlisted
    const existing = await Shortlist.findOne({ 
      studentId: user._id, 
      companyId: companyId 
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Student is already in the shortlist for this company" 
      });
    }

    // Create shortlist entry as walk-in
    const shortlist = new Shortlist({
      studentId: user._id,
      companyId: companyId,
      studentEmail: user.emailId,
      companyName: company.name,
      status: Status.SHORTLISTED,
      stage: null,
      interviewStatus: null,
      isOffered: false
    });

    await shortlist.save();
    await shortlist.populate('studentId', 'name emailId phoneNo');

    // Update Student document
    const student = await Student.findOne({ userId: user._id });
    if (!student.shortlistedCompanies.includes(company._id)) {
      student.shortlistedCompanies.push(company._id);
      await student.save();
    }

    // Update Company document
    if (!company.shortlistedStudents.includes(user._id)) {
      company.shortlistedStudents.push(user._id);
      await company.save();
    }

    logger.info(`POC ${req.user.emailId} added walk-in ${user.emailId} to ${company.name}`);

    // Emit socket event for real-time update
    emitStudentAdded(companyId, {
      shortlistId: shortlist._id,
      companyId: companyId,
      student: shortlist.studentId._id,
      status: shortlist.status
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
    const userId = req.user._id;
    const userRole = req.user.role;

    // Admins can mark any company as completed, POCs only their assigned companies
    let company;
    
    if (userRole === 'admin') {
      company = await Company.findById(companyId);
    } else {
      // Verify POC is assigned to this company
      company = await Company.findOne({ 
        _id: companyId, 
        POCs: userId 
      });
    }

    if (!company) {
      return res.status(403).json({ 
        message: "You are not assigned to this company" 
      });
    }

    // Mark company as completed
    company.isProcessCompleted = true;
    await company.save();

    // Get all shortlisted students for this company
    const shortlists = await Shortlist.find({ companyId: companyId })
      .populate('studentId', '_id');

    // Remove company from each student's shortlistedCompanies array
    const studentIds = shortlists.map(s => s.studentId._id);
    
    // This will be handled on the frontend by filtering out completed companies
    // We're just marking the company as completed here

    logger.info(`POC ${req.user.emailId} marked ${company.name} as process completed`);

  // Emit company process changed so other POCs remove/hide it in realtime
  emitCompanyProcessChanged(companyId, true);

    return res.json({
      message: "Company interview process marked as completed",
      company
    });
  } catch (err) {
    logger.error("markProcessCompleted error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
