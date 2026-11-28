import axios from "axios";
import crypto from "crypto";
import Student from "../models/student.model.js";
import Shortlist from "../models/shortlist.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import { logger } from "../utils/logger.js";

const PLACEMENT_API = process.env.PLACEMENT_PORTAL_API;
const SYNC_KEY = process.env.DDAY_SYNC_KEY || "";
const CACHE_TTL_MS = 30_000;
// Per-roll-number cache, same 30s convention as intern-stats.controller.js's list cache.
// Bounded by total student count (a few thousand at most) — not an unbounded-growth risk.
// Many D-Day viewers look up the same popular roll numbers repeatedly; this also means a
// slow/degraded main portal (the failure mode this endpoint was already built to tolerate
// via the local-DB fallback below) doesn't force every single lookup to wait out the
// upstream timeout before serving a response.
const statsCache = new Map(); // rollNumber -> { data, fetchedAt }

function hmacForGet() {
  return SYNC_KEY
    ? crypto.createHmac("sha256", SYNC_KEY).update("{}").digest("hex")
    : "";
}

/** Build stats from local MongoDB when the portal has no data for this student */
async function buildFromLocalDB(rollNumber) {
  const studentDoc = await Student.findOne({ rollNumber })
    .populate("userId", "name emailId phoneNo department programme discipline cpi")
    .lean();
  if (!studentDoc) return null;

  const user = studentDoc.userId;
  if (!user) return null;

  const shortlists = await Shortlist.find({ studentId: user._id })
    .populate("companyId", "name description venue")
    .sort({ updatedAt: -1 })
    .lean();

  const approvedOffer = await Offer.findOne({
    studentId: user._id,
    approvalStatus: ApprovalStatus.APPROVED,
  })
    .populate("companyId", "name description")
    .lean();

  const trail = shortlists.map((s) => {
    const stage = s.stage;
    const inInterviews = stage && stage !== "REJECTED";
    let currentStage = "applied";
    if (s.isOffered)           currentStage = "offered";
    else if (stage === "REJECTED") currentStage = "applied";
    else if (inInterviews)     currentStage = "interview_call";

    return {
      job_id: s._id,
      company: s.companyId?.name || s.companyName || "Unknown",
      designation: s.companyId?.description || "",
      slot: s.companyId?.venue || "",
      stages: {
        applied:        true,
        oa_appeared:    false,
        oa_shortlisted: true,
        interview_call: !!inInterviews,
        offered:        !!s.isOffered,
      },
      current_stage: currentStage,
      is_placed_here: !!s.isStudentPlaced && s.studentPlacedCompany === (s.companyId?.name || s.companyName),
    };
  });

  return {
    student: {
      name: user.name,
      rollNumber: studentDoc.rollNumber,
      department: user.department || "—",
      programme: user.programme || "—",
      discipline: user.discipline || "—",
      cpi: typeof user.cpi === "number" ? user.cpi : null,
      iitgEmail: user.emailId,
      mobile: user.phoneNo || "—",
      isPlaced: !!studentDoc.isPlaced,
    },
    final_offer: approvedOffer ? {
      company: approvedOffer.isOffCampus
        ? approvedOffer.offCampusCompanyName || "Off-Campus"
        : approvedOffer.companyId?.name || "—",
      slot: approvedOffer.companyId?.description || (approvedOffer.isOffCampus ? "Off-Campus" : "—"),
      role: approvedOffer.offCampusRole || "",
      approved_at: approvedOffer.approvedAt,
      is_off_campus: !!approvedOffer.isOffCampus,
    } : null,
    totals: {
      applications:    shortlists.length,
      oa_appeared:     null,
      oa_shortlisted:  shortlists.length,
      interview_calls: shortlists.filter(s => s.stage && s.stage !== "REJECTED").length,
      offers:          shortlists.filter(s => s.isOffered).length,
      placed:          studentDoc.isPlaced ? 1 : 0,
    },
    trail,
    _source: "local",
  };
}

/** Fetch this student's DDay shortlist statuses keyed by normalised company name */
async function getDDayStatusMap(rollNumber) {
  try {
    const studentDoc = await Student.findOne({ rollNumber }).select("userId").lean();
    if (!studentDoc) return {};
    const shortlists = await Shortlist.find({ studentId: studentDoc.userId })
      .select("companyName status")
      .lean();
    const map = {};
    shortlists.forEach(s => {
      const key = (s.companyName || "").trim().toLowerCase();
      if (key) map[key] = s.status; // "shortlisted" | "waitlisted"
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * GET /api/placement-stats/:rollNumber
 * Tries placement portal first; falls back to local MongoDB on 404.
 * Always attaches live DDay shortlist status to each trail entry.
 */
export const getPlacementStatsByRoll = async (req, res) => {
  const { rollNumber } = req.params;
  const cacheBust = req.query.refresh === "1";
  const now = Date.now();

  const cached = statsCache.get(rollNumber);
  if (!cacheBust && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    // Still attach fresh DDay data (not cached — it changes in real-time)
    const ddayMap = await getDDayStatusMap(rollNumber);
    const data = attachDDayStatus(cached.data, ddayMap);
    return res.json(data);
  }

  // ── Try placement portal first ──────────────────────────────────────────
  if (PLACEMENT_API) {
    try {
      const upstream = await axios.get(
        `${PLACEMENT_API}/sync/placement-stats/${encodeURIComponent(rollNumber)}`,
        // Shortened from 12s — if the main portal is slow/degraded, a viewer shouldn't be
        // stuck waiting that long before even reaching the local-DB fallback below.
        { headers: { "x-sync-signature": hmacForGet() }, timeout: 3000 }
      );
      // Portal wraps response in { status, data } — unwrap before forwarding
      const payload = upstream.data?.data ?? upstream.data;
      statsCache.set(rollNumber, { data: payload, fetchedAt: now });
      const ddayMap = await getDDayStatusMap(rollNumber);
      return res.json(attachDDayStatus(payload, ddayMap));
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 404) {
        // Real portal error — log and fall through to local DB
        logger.warn(`getPlacementStatsByRoll portal error (${status}), falling back to local DB: ${err.message}`);
      }
      // 404 = student not in portal yet → fall through silently
    }
  }

  // ── Fallback: local MongoDB ─────────────────────────────────────────────
  try {
    const local = await buildFromLocalDB(rollNumber);
    if (!local) {
      return res.status(404).json({ message: "Student not found" });
    }
    statsCache.set(rollNumber, { data: local, fetchedAt: now });
    const ddayMap = await getDDayStatusMap(rollNumber);
    return res.json(attachDDayStatus(local, ddayMap));
  } catch (err) {
    logger.error("getPlacementStatsByRoll local fallback error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** Attach dday_status to each trail entry by matching company name */
function attachDDayStatus(data, ddayMap) {
  if (!data?.trail || !Object.keys(ddayMap).length) return data;
  return {
    ...data,
    trail: data.trail.map(entry => ({
      ...entry,
      dday_status: ddayMap[(entry.company || "").trim().toLowerCase()] || null,
    })),
  };
}
