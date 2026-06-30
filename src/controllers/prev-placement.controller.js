import PlacementSeason from "../models/placement-season.model.js";
import Company from "../models/company.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import { sendOfferApprovalEmail } from "../utils/mailer.js";
import { logger } from "../utils/logger.js";

// Shared helper: company IDs for a given year
async function companyIdsForYear(year) {
  const companies = await Company.find({ placementYear: year }).select("_id").lean();
  return companies.map(c => c._id);
}

/**
 * GET /api/prev-placement/seasons
 * Returns all seasons where isPrevActive = true, sorted newest first.
 */
export const getArchivedSeasons = async (req, res) => {
  try {
    const seasons = await PlacementSeason.find({ isPrevActive: true })
      .sort({ year: -1 })
      .lean();
    return res.json({ seasons });
  } catch (err) {
    logger.error("getArchivedSeasons error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/prev-placement/companies?year=2025-26
 */
export const getPrevCompanies = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ message: "year query param required" });

    const companies = await Company.find({ placementYear: year })
      .populate("POCs", "name emailId phoneNo")
      .sort({ name: 1 })
      .lean();

    return res.json({ companies });
  } catch (err) {
    logger.error("getPrevCompanies error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/prev-placement/offers?year=2025-26
 * Returns confirmed (APPROVED) and rejected offers whose company belongs to that year.
 */
export const getPrevOffers = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ message: "year query param required" });

    const companyIds = await companyIdsForYear(year);

    const offers = await Offer.find({
      companyId: { $in: companyIds },
      approvalStatus: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
    })
      .populate("studentId", "name emailId rollNumber phoneNo")
      .populate("companyId", "name venue placementYear")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ offers });
  } catch (err) {
    logger.error("getPrevOffers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/prev-placement/place-student
 * Directly places a student at an archived company and sends the approval email.
 * No placement portal webhook — admin-only, for late placements after season conclusion.
 * Body: { companyId, studentEmail }
 */
export const placeStudentDirect = async (req, res) => {
  try {
    const { companyId, studentEmail } = req.body;
    if (!companyId || !studentEmail) {
      return res.status(400).json({ message: "companyId and studentEmail are required" });
    }

    // Company must be archived
    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!company.placementYear) {
      return res.status(400).json({ message: "This company is not an archived company" });
    }

    // Season must have isLastFinished = true
    const season = await PlacementSeason.findOne({ year: company.placementYear });
    if (!season?.isLastFinished) {
      return res.status(403).json({ message: "This season is fully read-only (isLastFinished is not set)" });
    }

    // Find user by email
    const userDoc = await User.findOne({ emailId: studentEmail.trim().toLowerCase() });
    if (!userDoc) {
      return res.status(404).json({ message: `No user found with email ${studentEmail}` });
    }
    if (userDoc.role !== "student") {
      return res.status(400).json({ message: `${studentEmail} is not a student account` });
    }

    // Find student record
    const studentDoc = await Student.findOne({ userId: userDoc._id });
    if (!studentDoc) {
      return res.status(404).json({ message: "Student record not found" });
    }

    // Check if already placed at a DIFFERENT company in this season
    if (studentDoc.isPlaced) {
      return res.status(409).json({
        message: `${userDoc.name} is already placed at another company in the ${company.placementYear} season`,
      });
    }

    // Student must belong to the same placement year as the company
    if (studentDoc.placementYear !== company.placementYear) {
      const studentSeason = studentDoc.placementYear ?? "current season";
      const companySeason = company.placementYear;
      return res.status(400).json({
        message: `Student is registered under "${studentSeason}" but this company belongs to "${companySeason}". Year mismatch — cannot place.`,
      });
    }

    // Check for duplicate offer
    const existing = await Offer.findOne({
      studentId: userDoc._id,
      companyId: company._id,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    if (existing) {
      return res.status(409).json({ message: `${userDoc.name} is already placed at ${company.name}` });
    }

    // Create offer as already approved
    const offer = await Offer.create({
      studentId: userDoc._id,
      companyId: company._id,
      approvalStatus: ApprovalStatus.APPROVED,
      offerStatus: "ACCEPTED",
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    // Mark student as placed (update even if archived)
    studentDoc.isPlaced = true;
    studentDoc.placedCompany = company._id;
    await studentDoc.save();

    // Send placement confirmation email — fire and forget
    sendOfferApprovalEmail({
      to: userDoc.emailId,
      studentName: userDoc.name,
      companyName: company.name,
    }).catch(err => logger.error("placeStudentDirect: email failed", err.message));

    logger.info(`[prev-placement] ${req.user.emailId} placed ${userDoc.emailId} at ${company.name} (${company.placementYear})`);

    return res.status(201).json({
      success: true,
      message: `${userDoc.name} placed at ${company.name} and email sent`,
      offer,
    });
  } catch (err) {
    logger.error("placeStudentDirect error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/prev-placement/pending?year=2025-26
 * Pending offers for companies in the archived season — so admin can approve/reject late offers.
 * Reuses the existing approve/reject endpoints on /api/admin/offers/:id/approve|reject.
 */
export const getPrevPendingOffers = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ message: "year query param required" });

    const companyIds = await companyIdsForYear(year);

    const offers = await Offer.find({
      companyId: { $in: companyIds },
      approvalStatus: ApprovalStatus.PENDING,
    })
      .populate("studentId", "name emailId rollNumber phoneNo")
      .populate("companyId", "name venue placementYear")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ offers });
  } catch (err) {
    logger.error("getPrevPendingOffers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
