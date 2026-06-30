import PlacementSeason from "../models/placement-season.model.js";
import Company from "../models/company.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
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
