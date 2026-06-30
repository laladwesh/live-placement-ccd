import Offer, { ApprovalStatus } from "../models/offer.model.js";
import Student from "../models/student.model.js";
import Company from "../models/company.model.js";
import PlacementSeason from "../models/placement-season.model.js";
import { logger } from "../utils/logger.js";

export const getSeasonsForViewer = async (req, res) => {
  try {
    const seasons = await PlacementSeason.find({ isPrevActive: true }).sort({ year: -1 }).lean();
    return res.json({ seasons });
  } catch (err) {
    logger.error("getSeasonsForViewer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/viewers/confirmed
 * Returns all confirmed offers (approved + auto-rejected), no sockets, minimal processing.
 * Protected route: permit('viewer') on router side.
 */
export const getConfirmedForViewer = async (req, res) => {
  try {
    // ?year=current (default) → current season only
    // ?year=2025-26           → that archived season
    // ?year=all               → everything
    const { year } = req.query;
    let companyIds = null;
    if (!year || year === "current") {
      const cos = await Company.find({ placementYear: null }).select("_id").lean();
      companyIds = cos.map(c => c._id);
    } else if (year !== "all") {
      const cos = await Company.find({ placementYear: year }).select("_id").lean();
      companyIds = cos.map(c => c._id);
    }

    const offerQuery = { approvalStatus: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] } };
    if (companyIds) offerQuery.companyId = { $in: companyIds };

    const confirmedOffers = await Offer.find(offerQuery)
      .populate('studentId', 'name emailId phoneNo programme department cpi')
      .populate('companyId', 'name venue')
      .populate('approvedBy', 'name emailId')
      .sort({ approvedAt: -1, createdAt: -1 });

    // Batch-load Student docs (one query instead of N) to get rollNumber
    const vUserIds = confirmedOffers.map(o => o.studentId._id);
    const vStudentDocs = await Student.find({ userId: { $in: vUserIds } }).select('userId rollNumber').lean();
    const vRollMap = new Map(vStudentDocs.map(s => [s.userId.toString(), s.rollNumber]));

    const enrichedOffers = confirmedOffers.map(offer => {
      const offerObj = offer.toObject();
      offerObj.studentId.rollNumber = vRollMap.get(offer.studentId._id.toString()) || "";
      offerObj.studentId.programme = offerObj.studentId.programme || null;
      offerObj.studentId.department = offerObj.studentId.department || null;
      offerObj.studentId.cpi = (typeof offerObj.studentId.cpi === 'number') ? offerObj.studentId.cpi : null;
      return offerObj;
    });

    return res.json({ success: true, count: enrichedOffers.length, offers: enrichedOffers });
  } catch (err) {
    logger.error("getConfirmedForViewer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/viewers/student/:studentId/details
 * Returns student contact + academic fields + cross-company shortlist details
 */
export const getStudentDetailsForViewer = async (req, res) => {
  try {
    const { studentId } = req.params;

    const user = await Student.findOne({ userId: studentId });
    // Also fetch the User doc for contact fields
    const UserModel = (await import('../models/user.model.js')).default;
    const studentUser = await UserModel.findById(studentId).select('name emailId phoneNo programme department cpi');
    if (!studentUser) return res.status(404).json({ message: 'Student not found' });

    // Get shortlists for this student
    const Shortlist = (await import('../models/shortlist.model.js')).default;
    const shortlists = await Shortlist.find({ studentId: studentId })
      .populate({ path: 'companyId', select: 'name description venue POCs', populate: { path: 'POCs', select: 'name phoneNo emailId' } })
      .sort({ 'companyId.name': 1 });

    const companyDetails = shortlists.map(s => {
      const comp = s.companyId || null;
      let currentStatus = s.status;
      if (s.isOffered) currentStatus = 'OFFERED';
      else if (s.stage) currentStatus = s.stage;

      return {
        companyName: comp?.name || s.companyName || 'Deleted Company',
        status: currentStatus,
        slot: comp?.description || s.companyName?.description || 'N/A',
        venue: comp?.venue || 'N/A',
        pocs: Array.isArray(comp?.POCs) ? comp.POCs.map(p => ({ name: p?.name || 'N/A', phone: p?.phoneNo || 'N/A', email: p?.emailId || 'N/A' })) : []
      };
    });

    return res.json({
      student: {
        name: studentUser.name,
        email: studentUser.emailId,
        phone: studentUser.phoneNo,
        programme: studentUser.programme || null,
        department: studentUser.department || null,
        cpi: (typeof studentUser.cpi === 'number') ? studentUser.cpi : null,
        rollNumber: user?.rollNumber || null
      },
      companies: companyDetails
    });
  } catch (err) {
    logger.error('getStudentDetailsForViewer error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
