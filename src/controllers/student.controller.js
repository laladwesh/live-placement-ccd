// src/controllers/student.controller.js
import Shortlist, { Status, Stage } from "../models/shortlist.model.js";
import Company from "../models/company.model.js";
import Offer from "../models/offer.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import { logger } from "../utils/logger.js";

/**
 * Get all shortlists for the logged-in student
 * GET /api/student/shortlists
 */
export const getMyShortlists = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all shortlists for this student with company details populated
   const shortlists = await Shortlist.find({ studentId })
  .populate({
    path: "companyId",
    select: "name venue isProcessCompleted POCs",
    populate: {
      path: "POCs",
      model: "User",
      select: "emailId name phoneNo",
    },
  })
  .sort({ createdAt: -1 });

    // Get pending offers for this student to show "CCD Confirmation Pending"
    const pendingOffers = await Offer.find({
      studentId: studentId,
      approvalStatus: "PENDING"  // Only offers awaiting admin approval
    }).select("companyId");
    
    const pendingOfferCompanyIds = new Set(
      pendingOffers.map(o => o.companyId.toString())
    );

    // Filter out companies where:
    // 1. Process is completed
    // 2. Student is REJECTED
    const activeShortlists = shortlists.filter(s => {
      // Remove if process completed
      if (s.companyId?.isProcessCompleted) return false;
      
      // Remove if student is rejected
      if (s.stage === "REJECTED") return false;
      
      return true;
    });

    // Enrich shortlists with offer status
    const enrichedShortlists = activeShortlists.map(s => {
      const shortlistObj = s.toObject();
      
      // Check if there's a pending offer for this company
      if (pendingOfferCompanyIds.has(s.companyId._id.toString())) {
        shortlistObj.hasPendingOffer = true;
      }
      
      return shortlistObj;
    });

    // Count statistics (only for active shortlists)
    const stats = {
      total: activeShortlists.length,
      shortlisted: activeShortlists.filter(s => s.status === Status.SHORTLISTED).length,
      waitlisted: activeShortlists.filter(s => s.status === Status.WAITLISTED).length,
      inInterview: activeShortlists.filter(s => s.stage && [Stage.R1, Stage.R2, Stage.R3, Stage.R4].includes(s.stage)).length,
      offered: activeShortlists.filter(s => s.isOffered).length,
      rejected: 0 // Don't show rejected in stats since we filter them out
    };

    logger.info(`Student ${studentId} fetched ${activeShortlists.length} active shortlists (rejected companies hidden)`);

    res.json({
      success: true,
      stats,
      shortlists: enrichedShortlists
    });
  } catch (err) {
    logger.error("Error fetching student shortlists:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shortlists"
    });
  }
};

/**
 * Get detailed information about a specific shortlist
 * GET /api/student/shortlists/:shortlistId
 */
export const getShortlistDetails = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const studentId = req.user._id;

    // Find the shortlist and verify it belongs to this student
    const shortlist = await Shortlist.findOne({
      _id: shortlistId,
      studentId: studentId
    }).populate("companyId", "name venue isProcessCompleted");

    if (!shortlist) {
      return res.status(404).json({
        success: false,
        message: "Shortlist not found"
      });
    }

    // Don't show details if process is completed
    if (shortlist.companyId?.isProcessCompleted) {
      return res.status(404).json({
        success: false,
        message: "Company interview process is completed"
      });
    }

    // Get offer details if the student has been offered
    let offer = null;
    if (shortlist.isOffered) {
      offer = await Offer.findOne({
        student: studentId,
        company: shortlist.companyId._id
      }).populate("acceptedBy", "name emailId");
    }

    logger.info(`Student ${studentId} viewed shortlist details ${shortlistId}`);

    res.json({
      success: true,
      shortlist,
      offer
    });
  } catch (err) {
    logger.error("Error fetching shortlist details:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shortlist details"
    });
  }
};

/**
 * Get all offers for the logged-in student
 * GET /api/student/offers
 */
export const getMyOffers = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get only APPROVED offers (admin has approved them)
    const offers = await Offer.find({ 
      studentId: studentId,
      approvalStatus: "APPROVED"  // Only show admin-approved offers
    })
      .populate("companyId", "name venue")
      .populate("acceptedBy", "name emailId")
      .populate("approvedBy", "name emailId")
      .sort({ approvedAt: -1 });

    logger.info(`Student ${studentId} fetched ${offers.length} approved offers`);

    res.json({
      success: true,
      count: offers.length,
      offers
    });
  } catch (err) {
    logger.error("Error fetching student offers:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch offers"
    });
  }
};

/**
 * Get student's own profile and placement status
 * GET /api/student/profile
 */
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user details
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get student-specific data
    const student = await Student.findOne({ userId })
      .populate("placedCompany", "name");

    // Get shortlist statistics
    const totalShortlists = await Shortlist.countDocuments({ studentId: userId });
    const activeShortlists = await Shortlist.countDocuments({
      studentId: userId,
      stage: { $in: [Stage.R1, Stage.R2, Stage.R3, Stage.R4] }
    });

    logger.info(`Student ${userId} fetched profile`);

    res.json({
      success: true,
      profile: {
        _id: user._id,
        name: user.name,
        emailId: user.emailId,
        phoneNo: user.phoneNo,
        role: user.role,
        isPlaced: student?.isPlaced || false,
        placedCompany: student?.placedCompany || null,
        shortlistedCount: student?.shortlistedCompanies?.length || 0,
        waitlistedCount: student?.waitlistedCompanies?.length || 0,
        totalShortlists,
        activeShortlists
      }
    });
  } catch (err) {
    logger.error("Error fetching student profile:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
};
