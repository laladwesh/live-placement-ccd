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
