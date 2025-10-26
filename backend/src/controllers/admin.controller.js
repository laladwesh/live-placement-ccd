import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import Shortlist from "../models/shortlist.model.js";
import { logger } from "../utils/logger.js";
import { emitOfferApproved, emitOfferRejected, emitOfferStatusUpdate } from "../config/socket.js";

/**
 * Create a user record used by admin.
 * Body: { name, email, role, password(optional), isAllowed(boolean), providers: [{provider, providerId}] }
 */
export const createUser = async (req, res) => {
  try {
    const { name, emailId, phoneNo, role, password, isAllowed, companyName, providers } = req.body;
    if (!emailId || !role) return res.status(400).json({ message: "emailId and role required" });

    const existing = await User.findOne({ emailId });
    if (existing) return res.status(409).json({ message: "Email already exists" });

    if (phoneNo) {
      const existingPhone = await User.findOne({ phoneNo });
      if (existingPhone) return res.status(409).json({ message: "Phone number already exists" });
    }

    let passwordHash;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const user = new User({
      name, 
      emailId, 
      phoneNo,
      role, 
      passwordHash, 
      isAllowed: !!isAllowed,
      companyName: role === 'poc' ? companyName : undefined,
      providers: providers || []
    });
    await user.save();

    return res.status(201).json({ message: "User created", user: { id: user._id, emailId: user.emailId } });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ 
        success: false,
        message: err.message
      });
    }
    logger.error("createUser error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all pending offers (waiting for admin approval)
 * GET /api/admin/offers/pending
 */
export const getPendingOffers = async (req, res) => {
  try {
    const pendingOffers = await Offer.find({ approvalStatus: ApprovalStatus.PENDING })
      .populate('studentId', 'name emailId phoneNo')
      .populate('companyId', 'name venue')
      .sort({ createdAt: -1 });

    // Enrich with rollNumber from Student model
    const enrichedOffers = await Promise.all(
      pendingOffers.map(async (offer) => {
        const student = await Student.findOne({ userId: offer.studentId._id });
        const offerObj = offer.toObject();
        if (student) {
          offerObj.studentId.rollNumber = student.rollNumber;
        }
        return offerObj;
      })
    );

    return res.json({
      success: true,
      count: enrichedOffers.length,
      offers: enrichedOffers
    });
  } catch (err) {
    logger.error("getPendingOffers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all approved/confirmed offers (includes auto-rejected ones)
 * GET /api/admin/offers/confirmed
 */
export const getConfirmedOffers = async (req, res) => {
  try {
    // Get all non-pending offers (APPROVED and REJECTED)
    const confirmedOffers = await Offer.find({ 
      approvalStatus: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] }
    })
      .populate('studentId', 'name emailId phoneNo')
      .populate('companyId', 'name venue')
      .populate('approvedBy', 'name emailId')
      .sort({ approvedAt: -1, createdAt: -1 });

    // Enrich with rollNumber from Student model
    const enrichedOffers = await Promise.all(
      confirmedOffers.map(async (offer) => {
        const student = await Student.findOne({ userId: offer.studentId._id });
        const offerObj = offer.toObject();
        if (student) {
          offerObj.studentId.rollNumber = student.rollNumber;
        }
        return offerObj;
      })
    );

    return res.json({
      success: true,
      count: enrichedOffers.length,
      offers: enrichedOffers
    });
  } catch (err) {
    logger.error("getConfirmedOffers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Approve an offer (move from pending to confirmed)
 * POST /api/admin/offers/:offerId/approve
 */
export const approveOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const adminId = req.user._id;

    const offer = await Offer.findById(offerId)
      .populate('studentId', 'name emailId phoneNo')
      .populate('companyId', 'name venue');

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.approvalStatus !== ApprovalStatus.PENDING) {
      return res.status(400).json({ 
        message: `Offer is already ${offer.approvalStatus.toLowerCase()}` 
      });
    }

    // Check if student is already placed
    const student = await Student.findOne({ userId: offer.studentId });
    if(!student){
      return res.status(404).json({message: "Student not found"});
    }
    if (student && student.isPlaced) {
      return res.status(400).json({ 
        message: "Student is already placed and cannot receive this offer" 
      });
    }

    // Approve the offer
    offer.approvalStatus = ApprovalStatus.APPROVED;
    offer.approvedBy = adminId;
    offer.approvedAt = new Date();
    offer.offerStatus = "ACCEPTED"; // Mark as accepted since admin approved
    await offer.save();
    
    // Update Student data as well
    student.isPlaced = true;
    student.placedCompany = offer.companyId;
    await student.save();

    // AUTO-REJECT ALL OTHER PENDING OFFERS FOR THIS STUDENT
    const otherPendingOffers = await Offer.find({
      studentId: offer.studentId._id,
      _id: { $ne: offer._id }, // Exclude the approved offer
      approvalStatus: ApprovalStatus.PENDING
    }).populate('companyId', 'name');

    // Reject all other pending offers
    for (const otherOffer of otherPendingOffers) {
      otherOffer.approvalStatus = ApprovalStatus.REJECTED;
      otherOffer.remarks = `${otherOffer.remarks || ''}\nAuto-rejected: Student placed at ${offer.companyId.name}`;
      await otherOffer.save();

      // Update shortlist to remove offered flag
      await Shortlist.findOneAndUpdate(
        { studentId: offer.studentId._id, companyId: otherOffer.companyId._id },
        { isOffered: false }
      );

      logger.info(`Auto-rejected offer from ${otherOffer.companyId.name} for ${offer.studentId.emailId} (placed at ${offer.companyId.name})`);
    }

    // UPDATE ALL SHORTLISTS FOR THIS STUDENT (mark as placed)
    await Shortlist.updateMany(
      { studentId: offer.studentId._id },
      { 
        $set: { 
          studentPlacedCompany: offer.companyId.name,
          isStudentPlaced: true 
        }
      }
    );

    logger.info(`Admin ${req.user.emailId} approved offer for ${offer.studentId.emailId} at ${offer.companyId.name}`);
    logger.info(`Auto-rejected ${otherPendingOffers.length} other pending offers for this student`);

    // Emit socket events to notify all relevant parties
    emitOfferApproved(
      offer.studentId._id.toString(),
      offer.companyId._id.toString(),
      {
        offerId: offer._id,
        companyId: offer.companyId._id,
        companyName: offer.companyId.name,
        studentId: offer.studentId._id,
        studentName: offer.studentId.name,
        approvalStatus: ApprovalStatus.APPROVED
      }
    );

    // Also emit status update for real-time dashboard refresh
    emitOfferStatusUpdate({
      offerId: offer._id,
      studentId: offer.studentId._id.toString(),
      companyId: offer.companyId._id.toString(),
      approvalStatus: ApprovalStatus.APPROVED,
      action: 'approved'
    });

    return res.json({
      success: true,
      message: "Offer approved and sent to student",
      offer
    });
  } catch (err) {
    logger.error("approveOffer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Reject an offer
 * POST /api/admin/offers/:offerId/reject
 */
export const rejectOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { reason } = req.body;

    const offer = await Offer.findById(offerId)
      .populate('studentId', 'name emailId')
      .populate('companyId', 'name');

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.approvalStatus !== ApprovalStatus.PENDING) {
      return res.status(400).json({ 
        message: `Offer is already ${offer.approvalStatus.toLowerCase()}` 
      });
    }

    // Reject the offer
    offer.approvalStatus = ApprovalStatus.REJECTED;
    offer.remarks = reason ? `${offer.remarks}\nRejected: ${reason}` : offer.remarks;
    await offer.save();

    // Update shortlist to remove offered flag
    await Shortlist.findOneAndUpdate(
      { studentId: offer.studentId._id, companyId: offer.companyId._id },
      { isOffered: false }
    );

    logger.info(`Admin ${req.user.emailId} rejected offer for ${offer.studentId.emailId} at ${offer.companyId.name}`);

    // Emit socket events to notify all relevant parties
    emitOfferRejected(
      offer.studentId._id.toString(),
      offer.companyId._id.toString(),
      {
        offerId: offer._id,
        companyId: offer.companyId._id,
        companyName: offer.companyId.name,
        studentId: offer.studentId._id,
        studentName: offer.studentId.name,
        approvalStatus: ApprovalStatus.REJECTED,
        reason
      }
    );

    // Also emit status update for real-time dashboard refresh
    emitOfferStatusUpdate({
      offerId: offer._id,
      studentId: offer.studentId._id.toString(),
      companyId: offer.companyId._id.toString(),
      approvalStatus: ApprovalStatus.REJECTED,
      action: 'rejected'
    });

    return res.json({
      success: true,
      message: "Offer rejected",
      offer
    });
  } catch (err) {
    logger.error("rejectOffer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
