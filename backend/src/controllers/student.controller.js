// src/controllers/student.controller.js
import Shortlist from "../models/shortlist.model.js";
import Company from "../models/company.model.js";
import Offer from "../models/offer.model.js";
import User from "../models/user.model.js";
import { logger } from "../utils/logger.js";

/**
 * Get all shortlists for the logged-in student
 * GET /api/student/shortlists
 */
export const getMyShortlists = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all shortlists for this student with company details populated
    const shortlists = await Shortlist.find({ student: studentId })
      .populate("company", "name description logo ctc location jobRole visitDate maxRounds status isProcessCompleted")
      .sort({ createdAt: -1 });

    // Filter out companies where process is completed
    const activeShortlists = shortlists.filter(s => !s.company?.isProcessCompleted);

    // Count statistics (only for active shortlists)
    const stats = {
      total: activeShortlists.length,
      shortlisted: activeShortlists.filter(s => s.currentStage === "SHORTLISTED").length,
      waitlisted: activeShortlists.filter(s => s.currentStage === "WAITLISTED").length,
      inInterview: activeShortlists.filter(s => ["R1", "R2", "R3", "R4"].includes(s.currentStage)).length,
      offered: activeShortlists.filter(s => s.currentStage === "OFFERED").length,
      rejected: activeShortlists.filter(s => s.currentStage === "REJECTED").length
    };

    logger.info(`Student ${studentId} fetched ${activeShortlists.length} active shortlists`);

    res.json({
      success: true,
      stats,
      shortlists: activeShortlists
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
      student: studentId
    }).populate("company", "name description logo ctc location jobRole visitDate maxRounds status bond isProcessCompleted");

    if (!shortlist) {
      return res.status(404).json({
        success: false,
        message: "Shortlist not found"
      });
    }

    // Don't show details if process is completed
    if (shortlist.company?.isProcessCompleted) {
      return res.status(404).json({
        success: false,
        message: "Company interview process is completed"
      });
    }

    // Get offer details if the student has been offered
    let offer = null;
    if (shortlist.currentStage === "OFFERED") {
      offer = await Offer.findOne({
        student: studentId,
        company: shortlist.company._id
      }).populate("acceptedBy", "name email");
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

    // Get all offers for this student
    const offers = await Offer.find({ student: studentId })
      .populate("company", "name logo ctc location jobRole")
      .populate("acceptedBy", "name email")
      .sort({ createdAt: -1 });

    logger.info(`Student ${studentId} fetched ${offers.length} offers`);

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
    const studentId = req.user._id;

    const student = await User.findById(studentId).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    logger.info(`Student ${studentId} fetched profile`);

    res.json({
      success: true,
      student
    });
  } catch (err) {
    logger.error("Error fetching student profile:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
};
