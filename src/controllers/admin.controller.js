import bcrypt from "bcryptjs";
import crypto from "crypto";
import axios from "axios";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Company from "../models/company.model.js";
import Offer, { ApprovalStatus } from "../models/offer.model.js";
import Shortlist, { Status } from "../models/shortlist.model.js";
import { sendOfferApprovalEmail } from "../utils/mailer.js";
import { logger } from "../utils/logger.js";
import { emitOfferApproved, emitOfferRejected, emitOfferStatusUpdate, emitStudentPlaced } from "../config/socket.js";

const PLACEMENT_API = process.env.PLACEMENT_PORTAL_API ;
const SYNC_KEY = process.env.DDAY_SYNC_KEY || "";

function makeSyncHeaders(body) {
  const sig = SYNC_KEY
    ? crypto.createHmac("sha256", SYNC_KEY).update(JSON.stringify(body)).digest("hex")
    : "";
  return { "x-sync-signature": sig, "Content-Type": "application/json" };
}

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
    // Only show pending offers for current-season companies (placementYear: null)
    const currentCompanies = await Company.find({ placementYear: null }).select('_id').lean();
    const currentCompanyIds = currentCompanies.map(c => c._id);

    const pendingOffers = await Offer.find({
      approvalStatus: ApprovalStatus.PENDING,
      companyId: { $in: currentCompanyIds },
    })
      .populate('studentId', 'name emailId phoneNo')
      .populate('companyId', 'name venue')
      .sort({ createdAt: -1 });

    // Batch-load Student docs (one query instead of N) to get rollNumber
    const userIds = pendingOffers.map(o => o.studentId._id);
    const studentDocs = await Student.find({ userId: { $in: userIds } }).select('userId rollNumber').lean();
    const rollMap = new Map(studentDocs.map(s => [s.userId.toString(), s.rollNumber]));

    const enrichedOffers = pendingOffers.map(offer => {
      const offerObj = offer.toObject();
      offerObj.studentId.rollNumber = rollMap.get(offer.studentId._id.toString()) || "";
      return offerObj;
    });

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
    // Read optional server-side filters from query
    const { programme, department, cpiMin, cpiMax } = req.query;

    // If any academic filters provided, find matching user ids first
    let matchingUserIds = null;
    if (programme || department || cpiMin || cpiMax) {
      const userQuery = {};
      if (programme) userQuery.programme = programme;
      if (department) userQuery.department = department;
      if (cpiMin || cpiMax) {
        userQuery.cpi = {};
        if (cpiMin) userQuery.cpi.$gte = Number(cpiMin);
        if (cpiMax) userQuery.cpi.$lte = Number(cpiMax);
      }
      const users = await User.find(userQuery).select('_id');
      matchingUserIds = users.map(u => u._id);
      // If no users match, return empty
      if (matchingUserIds.length === 0) {
        return res.json({ success: true, count: 0, offers: [] });
      }
    }

    // Only show offers for current-season companies (placementYear: null)
    const currentCompanyObjs = await Company.find({ placementYear: null }).select('_id').lean();
    const currentCompanyIds = currentCompanyObjs.map(c => c._id);

    // Build offer query
    const offerQuery = {
      approvalStatus: { $in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
      companyId: { $in: currentCompanyIds },
    };
    if (matchingUserIds) offerQuery.studentId = { $in: matchingUserIds };

    const confirmedOffers = await Offer.find(offerQuery)
      .populate('studentId', 'name emailId phoneNo programme department cpi')
      .populate('companyId', 'name venue')
      .populate('approvedBy', 'name emailId')
      .sort({ approvedAt: -1, createdAt: -1 });

    // Batch-load Student docs (one query instead of N) to get rollNumber
    const confUserIds = confirmedOffers.map(o => o.studentId._id);
    const confStudentDocs = await Student.find({ userId: { $in: confUserIds } }).select('userId rollNumber').lean();
    const confRollMap = new Map(confStudentDocs.map(s => [s.userId.toString(), s.rollNumber]));

    const enrichedOffers = confirmedOffers.map(offer => {
      const offerObj = offer.toObject();
      offerObj.studentId.rollNumber = confRollMap.get(offer.studentId._id.toString()) || "";
      offerObj.studentId.programme = offerObj.studentId.programme || null;
      offerObj.studentId.department = offerObj.studentId.department || null;
      offerObj.studentId.cpi = (typeof offerObj.studentId.cpi === 'number') ? offerObj.studentId.cpi : null;
      return offerObj;
    });

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

    // Atomically flip the offer from PENDING → APPROVED so two concurrent admins can't both win
    const approvedOffer = await Offer.findOneAndUpdate(
      { _id: offerId, approvalStatus: ApprovalStatus.PENDING },
      { $set: { approvalStatus: ApprovalStatus.APPROVED, approvedBy: adminId, approvedAt: new Date(), offerStatus: "ACCEPTED" } },
      { new: true }
    ).populate('studentId', 'name emailId phoneNo').populate('companyId', 'name venue');

    if (!approvedOffer) {
      return res.status(400).json({ message: "Offer is already processed or no longer pending" });
    }

    // Atomically mark student as placed only if not already placed (race guard)
    const student = await Student.findOneAndUpdate(
      { userId: approvedOffer.studentId._id, isPlaced: false },
      { $set: { isPlaced: true, placedCompany: approvedOffer.companyId._id } },
      { new: true }
    );

    if (!student) {
      // Student was already placed by a concurrent approval — roll back the offer
      await Offer.findByIdAndUpdate(offerId, { $set: { approvalStatus: ApprovalStatus.PENDING, approvedBy: null, approvedAt: null, offerStatus: "PENDING" } });
      return res.status(409).json({ message: "Student is already placed — offer rolled back to pending" });
    }

    logger.info(`Student ${approvedOffer.studentId.emailId} marked as placed at ${approvedOffer.companyId.name}`);

    // AUTO-REJECT ALL OTHER PENDING OFFERS FOR THIS STUDENT
    const otherPendingOffers = await Offer.find({
      studentId: approvedOffer.studentId._id,
      _id: { $ne: approvedOffer._id },
      approvalStatus: ApprovalStatus.PENDING
    }).populate('companyId', 'name');

    for (const otherOffer of otherPendingOffers) {
      otherOffer.approvalStatus = ApprovalStatus.REJECTED;
      otherOffer.remarks = `${otherOffer.remarks || ''}\nAuto-rejected: Student placed at ${approvedOffer.companyId.name}`;
      await otherOffer.save();

      await Shortlist.findOneAndUpdate(
        { studentId: approvedOffer.studentId._id, companyId: otherOffer.companyId._id },
        { isOffered: false }
      );

      logger.info(`Auto-rejected offer from ${otherOffer.companyId.name} for ${approvedOffer.studentId.emailId} (placed at ${approvedOffer.companyId.name})`);
    }

    // UPDATE ALL SHORTLISTS FOR THIS STUDENT (mark as placed)
    await Shortlist.updateMany(
      { studentId: approvedOffer.studentId._id },
      { $set: { studentPlacedCompany: approvedOffer.companyId.name, isStudentPlaced: true } }
    );

    // GET ALL COMPANIES WHERE THIS STUDENT IS SHORTLISTED (for real-time notification)
    const studentShortlists = await Shortlist.find({
      studentId: approvedOffer.studentId._id
    }).select('companyId');
    const shortlistedCompanyIds = studentShortlists.map(s => s.companyId);

    // ADD STUDENT TO COMPANY'S PLACED STUDENTS LIST
    await Company.findByIdAndUpdate(
      approvedOffer.companyId._id,
      { $addToSet: { placedStudents: approvedOffer.studentId._id } }
    );

    logger.info(`Admin ${req.user.emailId} approved offer for ${approvedOffer.studentId.emailId} at ${approvedOffer.companyId.name}`);
    logger.info(`Auto-rejected ${otherPendingOffers.length} other pending offers for this student`);

    emitStudentPlaced(
      approvedOffer.studentId._id.toString(),
      approvedOffer.companyId._id.toString(),
      approvedOffer.companyId.name,
      shortlistedCompanyIds
    );

    emitOfferApproved(
      approvedOffer.studentId._id.toString(),
      approvedOffer.companyId._id.toString(),
      {
        offerId: approvedOffer._id,
        companyId: approvedOffer.companyId._id,
        companyName: approvedOffer.companyId.name,
        studentId: approvedOffer.studentId._id,
        studentName: approvedOffer.studentId.name,
        approvalStatus: ApprovalStatus.APPROVED
      }
    );

    emitOfferStatusUpdate({
      offerId: approvedOffer._id,
      studentId: approvedOffer.studentId._id.toString(),
      companyId: approvedOffer.companyId._id.toString(),
      approvalStatus: ApprovalStatus.APPROVED,
      action: 'approved'
    });

    try {
      await sendOfferApprovalEmail({
        to: approvedOffer.studentId.emailId,
        studentName: approvedOffer.studentId.name,
        companyName: approvedOffer.companyId.name,
      });
      logger.info(`Offer approval email sent to ${approvedOffer.studentId.emailId} for ${approvedOffer.companyId.name}`);
    } catch (mailErr) {
      logger.error("Failed to send offer approval email:", mailErr);
    }

    // Fire-and-forget write-back to placement portal
    if (approvedOffer.companyId.placementPortalJobId) {
      const webhookBody = {
        studentEmail: approvedOffer.studentId.emailId,
        placementPortalJobId: approvedOffer.companyId.placementPortalJobId,
      };
      axios
        .post(`${PLACEMENT_API}/sync/offer-approved`, webhookBody, {
          headers: makeSyncHeaders(webhookBody),
          timeout: 8000,
        })
        .then(() => logger.info(`[sync] Placement portal notified: ${approvedOffer.studentId.emailId} placed`))
        .catch((err) => logger.error("[sync] Placement portal webhook failed:", err.message));
    } else {
      logger.warn(`[sync] No placementPortalJobId on company ${approvedOffer.companyId.name} — skipping write-back`);
    }

    return res.json({
      success: true,
      message: "Offer approved and sent to student",
      offer: approvedOffer
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

/**
 * Set company process completion state (admin only)
 * POST /api/admin/companies/:companyId/complete
 * Body: { completed: boolean }
 */
export const setCompanyProcessComplete = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { completed } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    company.isProcessCompleted = !!completed;
    await company.save();

    logger.info(`Admin ${req.user.emailId} set isProcessCompleted=${company.isProcessCompleted} for ${company.name}`);

    // Emit process changed so POCs/admin views update in realtime
    try {
      const { emitCompanyProcessChanged } = await import("../config/socket.js");
      emitCompanyProcessChanged(company._id.toString(), company.isProcessCompleted);
    } catch (e) {
      logger.error("Failed to emit company process changed", e);
    }

    return res.json({
      success: true,
      message: `Company process ${company.isProcessCompleted ? 'marked completed' : 'reopened'}`,
      company
    });
  } catch (err) {
    logger.error("setCompanyProcessComplete error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get detailed cross-company status for a student (admin view)
 * GET /api/admin/students/:studentId/details
 */
export const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find student user
    const studentUser = await User.findById(studentId);
    if (!studentUser) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Find all shortlists for this student
    const shortlists = await Shortlist.find({ studentId: studentId })
      .populate({
        path: 'companyId',
        select: 'name description venue POCs',
        populate: {
          path: 'POCs',
          select: 'name phoneNo emailId'
        }
      })
      .sort({ 'companyId.name': 1 });

    // Format response
    const companyDetails = shortlists.map(s => {
      let currentStatus = s.status;
      if (s.isOffered) currentStatus = "OFFERED";
      else if (s.stage) currentStatus = s.stage;

      const comp = s.companyId || null;

      return {
        companyName: comp?.name || s.companyName || "Deleted Company",
        status: currentStatus,
        slot: comp?.description || s.companyName?.description || "N/A",
        venue: comp?.venue || "N/A",
        pocs: Array.isArray(comp?.POCs) ? comp.POCs.map(p => ({
          name: p?.name || "N/A",
          phone: p?.phoneNo || "N/A",
          email: p?.emailId || "N/A"
        })) : []
      };
    });

    return res.json({
      student: {
        name: studentUser.name,
        email: studentUser.emailId,
        phone: studentUser.phoneNo,
        programme: studentUser.programme || null,
        department: studentUser.department || null,
        cpi: typeof studentUser.cpi === 'number' ? studentUser.cpi : null
      },
      companies: companyDetails
    });

  } catch (err) {
    logger.error("getStudentDetails (admin) error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// HMAC for outbound GET requests to placement portal (no request body → sign "{}")
function makeSyncHmacForGet() {
  return SYNC_KEY
    ? crypto.createHmac("sha256", SYNC_KEY).update("{}").digest("hex")
    : "";
}

// POST /admin/sync/students  — pull all students from placement portal, upsert into dday
export const syncStudentsFromPortal = async (req, res) => {
  try {
    const { data } = await axios.get(`${PLACEMENT_API}/sync/students`, {
      headers: { "x-sync-signature": makeSyncHmacForGet() },
      timeout: 30000,
    });
    if (data.status !== "success") {
      return res.status(502).json({ message: "Placement portal returned error" });
    }

    let created = 0, updated = 0;
    for (const s of data.data) {
      const email = s.email?.toLowerCase();
      if (!email) continue;

      let user = await User.findOne({ emailId: email });
      if (!user) {
        const phoneValid = s.phoneNo && /^\d{10}$/.test(s.phoneNo);
        user = await User.create({
          name: s.name || email,
          emailId: email,
          ...(phoneValid ? { phoneNo: s.phoneNo } : {}),
          role: "student",
          isAllowed: true,
          programme: s.programme || "",
          department: s.department || "",
          cpi: typeof s.cpi === "number" ? s.cpi : null,
        });
        created++;
      } else {
        if (s.name) user.name = s.name;
        if (s.phoneNo && /^\d{10}$/.test(s.phoneNo)) user.phoneNo = s.phoneNo;
        if (s.programme) user.programme = s.programme;
        if (s.department) user.department = s.department;
        if (typeof s.cpi === "number") user.cpi = s.cpi;
        user.isAllowed = true;
        await user.save();
        updated++;
      }

      const existingStudent = await Student.findOne({ userId: user._id });
      if (!existingStudent) {
        const rollValid = s.rollNumber && /^\d{9}$/.test(s.rollNumber);
        await Student.create({ userId: user._id, rollNumber: rollValid ? s.rollNumber : "" });
      } else if (existingStudent.placementYear !== null && existingStudent.placementYear !== undefined) {
        // Archived student re-appearing in sync — reactivate for new season
        existingStudent.placementYear = null;
        existingStudent.isPlaced = false;
        existingStudent.shortlistedCompanies = [];
        existingStudent.waitlistedCompanies = [];
        existingStudent.placedCompany = null;
        if (s.rollNumber && /^\d{9}$/.test(s.rollNumber)) existingStudent.rollNumber = s.rollNumber;
        await existingStudent.save();
      } else if (s.rollNumber && /^\d{9}$/.test(s.rollNumber) && !existingStudent.rollNumber) {
        existingStudent.rollNumber = s.rollNumber;
        await existingStudent.save();
      }
    }

    logger.info(`[sync] Students — total: ${data.data.length}, created: ${created}, updated: ${updated}`);
    return res.json({ status: "success", total: data.data.length, created, updated });
  } catch (err) {
    logger.error("syncStudentsFromPortal error:", err.message);
    return res.status(500).json({ message: "Sync failed", error: err.message });
  }
};

// POST /admin/sync/companies  — pull finalized-shortlist companies from placement portal, append-only
export const syncCompaniesFromPortal = async (req, res) => {
  try {
    const { data } = await axios.get(`${PLACEMENT_API}/sync/companies`, {
      headers: { "x-sync-signature": makeSyncHmacForGet() },
      timeout: 15000,
    });
    if (data.status !== "success") {
      return res.status(502).json({ message: "Placement portal returned error" });
    }

    let created = 0, skipped = 0;
    for (const entry of data.data) {
      const { placementPortalJobId, ddayName } = entry;
      if (!placementPortalJobId) continue;

      // Already synced — skip
      const alreadySynced = await Company.findOne({ placementPortalJobId });
      if (alreadySynced) { skipped++; continue; }

      // Handle name collision
      let name = ddayName;
      const nameTaken = await Company.findOne({ name });
      if (nameTaken) name = `${ddayName} (${String(placementPortalJobId).slice(-4)})`;

      await Company.create({ name, placementPortalJobId });
      created++;
    }

    logger.info(`[sync] Companies — total: ${data.data.length}, created: ${created}, skipped: ${skipped}`);
    return res.json({ status: "success", total: data.data.length, created, skipped });
  } catch (err) {
    logger.error("syncCompaniesFromPortal error:", err.message);
    return res.status(500).json({ message: "Sync failed", error: err.message });
  }
};

// POST /admin/sync/companies/:companyId/shortlist  — pull interview shortlist for one company, append+dedup
export const syncShortlistFromPortal = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });
    if (!company.placementPortalJobId) {
      return res.status(400).json({ message: "Company is not linked to a placement portal job" });
    }

    const { data } = await axios.get(
      `${PLACEMENT_API}/sync/shortlist/${company.placementPortalJobId}`,
      { headers: { "x-sync-signature": makeSyncHmacForGet() }, timeout: 15000 }
    );
    if (data.status !== "success") {
      return res.status(502).json({ message: "Placement portal returned error" });
    }

    let added = 0, skipped = 0;
    for (const s of data.data) {
      // Respect OA policy — only sync students who were OA-present (or OA not required)
      if (!s.oaPresent) { skipped++; continue; }

      const email = s.email?.toLowerCase();
      if (!email) continue;

      // Upsert user
      let user = await User.findOne({ emailId: email });
      if (!user) {
        const phoneValid = s.phoneNo && /^\d{10}$/.test(s.phoneNo);
        user = await User.create({
          name: s.name || email,
          emailId: email,
          ...(phoneValid ? { phoneNo: s.phoneNo } : {}),
          role: "student",
          isAllowed: true,
        });
      }

      // Ensure Student sidecar
      let studentDoc = await Student.findOne({ userId: user._id });
      if (!studentDoc) {
        const rollValid = s.rollNumber && /^\d{9}$/.test(s.rollNumber);
        studentDoc = await Student.create({ userId: user._id, rollNumber: rollValid ? s.rollNumber : "" });
      } else if (studentDoc.placementYear !== null && studentDoc.placementYear !== undefined) {
        // Archived student being shortlisted in a new season — reactivate
        studentDoc.placementYear = null;
        studentDoc.isPlaced = false;
        studentDoc.shortlistedCompanies = [];
        studentDoc.waitlistedCompanies = [];
        studentDoc.placedCompany = null;
        if (s.rollNumber && /^\d{9}$/.test(s.rollNumber)) studentDoc.rollNumber = s.rollNumber;
        await studentDoc.save();
      }

      // Append-only — skip if already shortlisted for this company
      const exists = await Shortlist.findOne({ studentId: user._id, companyId: company._id });
      if (exists) { skipped++; continue; }

      await Shortlist.create({
        companyId: company._id,
        companyName: company.name,
        studentId: user._id,
        studentEmail: email,
        status: Status.SHORTLISTED,
      });

      if (!studentDoc.shortlistedCompanies.includes(company._id)) {
        studentDoc.shortlistedCompanies.push(company._id);
        await studentDoc.save();
      }

      if (!company.shortlistedStudents.includes(user._id)) {
        company.shortlistedStudents.push(user._id);
      }
      added++;
    }

    if (added > 0) await company.save();

    logger.info(`[sync] Shortlist ${companyId} — total: ${data.data.length}, added: ${added}, skipped: ${skipped}`);
    return res.json({ status: "success", total: data.data.length, added, skipped });
  } catch (err) {
    logger.error("syncShortlistFromPortal error:", err.message);
    return res.status(500).json({ message: "Sync failed", error: err.message });
  }
};
