import Student from "../models/student.model.js";
import Shortlist from "../models/shortlist.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/placement-stats/:rollNumber
 * Returns full placement season funnel + trail for one student.
 */
export const getPlacementStatsByRoll = async (req, res) => {
  try {
    const { rollNumber } = req.params;

    const studentDoc = await Student.findOne({ rollNumber })
      .populate("userId", "name emailId phoneNo department programme cpi")
      .lean();
    if (!studentDoc) {
      return res.status(404).json({ message: "Student not found for this roll number" });
    }

    const user = studentDoc.userId;
    if (!user) {
      return res.status(404).json({ message: "Student user record missing" });
    }

    // All shortlists for this student (current season only — placementYear: null)
    const shortlists = await Shortlist.find({ studentId: user._id })
      .populate("companyId", "name description venue slot")
      .sort({ updatedAt: -1 })
      .lean();

    // Approved offer (if any)
    const approvedOffer = await Offer.findOne({
      studentId: user._id,
      approvalStatus: ApprovalStatus.APPROVED,
    })
      .populate("companyId", "name description slot")
      .lean();

    // Build trail
    const trail = shortlists.map((s) => {
      const stage = s.stage; // R1 | R2 | R3 | R4 | REJECTED | null
      const inInterviews = stage && stage !== "REJECTED";
      const r1 = inInterviews;
      const r2 = stage === "R2" || stage === "R3" || stage === "R4";
      const r3 = stage === "R3" || stage === "R4";
      const r4 = stage === "R4";

      let currentStage = "shortlisted";
      if (s.isOffered) currentStage = "offered";
      else if (stage === "REJECTED") currentStage = "rejected";
      else if (stage === "R4") currentStage = "r4";
      else if (stage === "R3") currentStage = "r3";
      else if (stage === "R2") currentStage = "r2";
      else if (stage === "R1") currentStage = "r1";

      return {
        job_id: s._id,
        company: s.companyId?.name || s.companyName || "Unknown",
        designation: s.companyId?.description || "",
        slot: s.companyId?.slot || s.companyId?.venue || "",
        stages: { shortlisted: true, r1, r2, r3, r4, offered: !!s.isOffered },
        current_stage: currentStage,
        is_placed_here: !!s.isStudentPlaced && s.studentPlacedCompany === (s.companyId?.name || s.companyName),
      };
    });

    // Funnel totals
    const applications = shortlists.length;
    const in_interviews = shortlists.filter((s) => s.stage && s.stage !== "REJECTED").length;
    const offers = shortlists.filter((s) => s.isOffered).length;

    return res.json({
      student: {
        name: user.name,
        rollNumber: studentDoc.rollNumber,
        department: user.department || "—",
        programme: user.programme || "—",
        cpi: typeof user.cpi === "number" ? user.cpi : null,
        iitgEmail: user.emailId,
        mobile: user.phoneNo || "—",
        isPlaced: !!studentDoc.isPlaced,
      },
      final_offer: approvedOffer
        ? {
            company: approvedOffer.isOffCampus
              ? approvedOffer.offCampusCompanyName || "Off-Campus"
              : approvedOffer.companyId?.name || "—",
            slot: approvedOffer.companyId?.slot || approvedOffer.companyId?.description || (approvedOffer.isOffCampus ? "Off-Campus" : "—"),
            role: approvedOffer.offCampusRole || "",
            approved_at: approvedOffer.approvedAt,
            is_off_campus: !!approvedOffer.isOffCampus,
          }
        : null,
      totals: { applications, in_interviews, offers, placed: studentDoc.isPlaced ? 1 : 0 },
      trail,
    });
  } catch (err) {
    logger.error("getPlacementStatsByRoll error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
