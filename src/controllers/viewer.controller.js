import Offer, { ApprovalStatus } from "../models/offer.model.js";
import Student from "../models/student.model.js";
import Company from "../models/company.model.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/viewers/confirmed
 * Returns all confirmed offers (approved + auto-rejected), no sockets, minimal processing.
 * Protected route: permit('viewer') on router side.
 */
export const getConfirmedForViewer = async (req, res) => {
  try {
    const offerQuery = { approvalStatus: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] } };

    const confirmedOffers = await Offer.find(offerQuery)
      .populate('studentId', 'name emailId phoneNo programme department cpi')
      .populate('companyId', 'name venue')
      .populate('approvedBy', 'name emailId')
      .sort({ approvedAt: -1, createdAt: -1 });

    // Enrich with rollNumber from Student model and ensure academic fields present
    const enrichedOffers = await Promise.all(
      confirmedOffers.map(async (offer) => {
        const student = await Student.findOne({ userId: offer.studentId._id });
        const offerObj = offer.toObject();
        if (student) {
          offerObj.studentId.rollNumber = student.rollNumber;
        }
        offerObj.studentId.programme = offerObj.studentId.programme || null;
        offerObj.studentId.department = offerObj.studentId.department || null;
        offerObj.studentId.cpi = (typeof offerObj.studentId.cpi === 'number') ? offerObj.studentId.cpi : null;
        return offerObj;
      })
    );

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
