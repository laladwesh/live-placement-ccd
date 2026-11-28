import axios from "axios";
import crypto from "crypto";
import PlacementSeason from "../models/placement-season.model.js";
import Company from "../models/company.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import { sendOfferApprovalEmail } from "../utils/mailer.js";
import { logger } from "../utils/logger.js";

const PLACEMENT_API = process.env.PLACEMENT_PORTAL_API;
const SYNC_KEY = process.env.DDAY_SYNC_KEY || "";

function makeSyncHeaders(body) {
  const sig = SYNC_KEY
    ? crypto.createHmac("sha256", SYNC_KEY).update(JSON.stringify(body)).digest("hex")
    : "";
  return { "x-sync-signature": sig, "Content-Type": "application/json" };
}

// Retries only transient failures (DNS/connection errors — no HTTP response at all,
// e.g. the EAI_AGAIN blips seen in production). An actual HTTP response (400/401/404)
// means the portal processed the request and rejected it for a real reason — retrying
// that would just get the same rejection, so it's thrown immediately instead.
async function postSyncWithRetry(url, body, headers, { retries = 2, delayMs = 1500, timeout = 8000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios.post(url, body, { headers, timeout });
    } catch (err) {
      lastErr = err;
      if (err.response || attempt === retries) throw err;
      logger.warn(`[sync] Transient error posting to ${url} (attempt ${attempt + 1}/${retries + 1}): ${err.code || err.message} — retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

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
      .populate("studentId", "name emailId phoneNo programme department discipline cpi")
      .populate("companyId", "name venue placementYear")
      .sort({ createdAt: -1 })
      .lean();

    // Batch-load rollNumbers from Student sidecar
    const userIds = offers.map(o => o.studentId?._id).filter(Boolean);
    const studentDocs = await Student.find({ userId: { $in: userIds } }).select("userId rollNumber").lean();
    const rollMap = new Map(studentDocs.map(s => [s.userId.toString(), s.rollNumber]));
    const enriched = offers.map(o => ({
      ...o,
      studentId: o.studentId ? { ...o.studentId, rollNumber: rollMap.get(o.studentId._id.toString()) || "" } : o.studentId,
    }));

    return res.json({ offers: enriched });
  } catch (err) {
    logger.error("getPrevOffers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/prev-placement/place-student
 * Directly places a student at an archived company and sends the approval email.
 * Also fires the same placement-portal sync webhook as the live approval flow
 * (admin.controller.js:approveOffer), so late placements made here don't leave the
 * student stuck as "Sitting_Placement" on the main portal.
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

    // Write-back to placement portal — same webhook as the live approval flow.
    // Always fire, even when the archived company has no placementPortalJobId:
    // the portal replies 400, and that failure is surfaced in the response below
    // instead of only logged, since a silent failure here means the student stays
    // placed in D-Day but never shows as placed on the main portal.
    let portalSyncWarning = null;
    {
      const webhookBody = {
        studentEmail: userDoc.emailId,
        placementPortalJobId: company.placementPortalJobId || null,
      };
      try {
        const r = await postSyncWithRetry(
          `${PLACEMENT_API}/sync/offer-approved`,
          webhookBody,
          makeSyncHeaders(webhookBody)
        );
        logger.info(
          `[sync] Placement portal notified: ${userDoc.emailId} placed ` +
            `(HTTP ${r.status}: ${JSON.stringify(r.data)})`
        );
      } catch (err) {
        const detail = err.response
          ? `HTTP ${err.response.status} ${JSON.stringify(err.response.data)}`
          : `${err.code || ""} ${err.message}`;
        logger.error(
          `[sync] Placement portal webhook failed for ${userDoc.emailId} ` +
            `→ ${PLACEMENT_API}/sync/offer-approved : ${detail}`
        );
        portalSyncWarning =
          `Student is placed in D-Day but the Placement Portal was NOT updated (${detail}). ` +
          `Fix the underlying issue (e.g. link this company via "Sync All Companies") and re-sync manually.`;
      }
    }

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
      ...(portalSyncWarning ? { warning: portalSyncWarning } : {}),
    });
  } catch (err) {
    logger.error("placeStudentDirect error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/prev-placement/export?year=2025-26
 * Returns all students for that year with placement status — for CSV export.
 */
export const exportStudentsForYear = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ message: "year query param required" });

    const students = await Student.find({ placementYear: year })
      .populate("userId", "name emailId cpi programme department discipline")
      .populate("placedCompany", "name")
      .lean();

    const rows = students.map(s => ({
      name: s.userId?.name || "",
      rollNumber: s.rollNumber || "",
      status: s.isPlaced ? "Placed" : "Unplaced",
      company: s.isPlaced ? (s.placedCompany?.name || "") : "",
      cpi: s.userId?.cpi ?? "",
      department: s.userId?.department || "",
      programme: s.userId?.programme || "",
      discipline: s.userId?.discipline || "",
      email: s.userId?.emailId || "",
    }));

    return res.json({ rows });
  } catch (err) {
    logger.error("exportStudentsForYear error", err);
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
