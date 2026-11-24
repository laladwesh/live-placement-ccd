// src/controllers/scheduler.controller.js
import Company from "../models/company.model.js";
import Shortlist from "../models/shortlist.model.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/scheduler/companies
 * Returns all companies with shortlist/waitlist counts.
 */
export const getSchedulerCompanies = async (req, res) => {
  try {
    const companies = await Company.find({})
      .select("name venue description isProcessCompleted shortlistedStudents waitlistedStudents")
      .lean();

    // Counts come from the actual Shortlist collection (source of truth)
    const companyIds = companies.map(c => c._id);
    const counts = await Shortlist.aggregate([
      { $match: { companyId: { $in: companyIds } } },
      {
        $group: {
          _id: "$companyId",
          total:       { $sum: 1 },
          shortlisted: { $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] } },
          waitlisted:  { $sum: { $cond: [{ $eq: ["$status", "waitlisted"]  }, 1, 0] } },
        }
      }
    ]);

    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c; });

    const result = companies.map(c => ({
      _id:               c._id,
      name:              c.name,
      venue:             c.venue || null,
      isProcessCompleted:c.isProcessCompleted || false,
      total:       countMap[c._id.toString()]?.total       || 0,
      shortlisted: countMap[c._id.toString()]?.shortlisted || 0,
      waitlisted:  countMap[c._id.toString()]?.waitlisted  || 0,
    }));

    // Sort: active companies first, then by name
    result.sort((a, b) => {
      if (a.isProcessCompleted !== b.isProcessCompleted)
        return a.isProcessCompleted ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return res.json({ companies: result });
  } catch (err) {
    logger.error("getSchedulerCompanies error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/scheduler/companies/:companyId/shortlist
 * Returns all shortlist entries for a company in custom sortOrder.
 * Null sortOrders sort after numbered ones (treated as Infinity).
 */
export const getSchedulerShortlist = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId).select("name venue isProcessCompleted").lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    const entries = await Shortlist.find({ companyId })
      .populate("studentId", "name emailId phoneNo")
      .lean();

    // Sort: null sortOrder goes to the bottom, then by createdAt
    entries.sort((a, b) => {
      const aOrd = a.sortOrder ?? Infinity;
      const bOrd = b.sortOrder ?? Infinity;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Attach rollNumber from Student model
    const Student = (await import("../models/student.model.js")).default;
    const userIds = entries.map(e => e.studentId?._id).filter(Boolean);
    const studentDocs = await Student.find({ userId: { $in: userIds } }).select("userId rollNumber").lean();
    const rollMap = {};
    studentDocs.forEach(s => { rollMap[s.userId.toString()] = s.rollNumber || null; });

    const shaped = entries.map(e => ({
      _id:           e._id,
      sortOrder:     e.sortOrder,
      status:        e.status,
      stage:         e.stage || null,
      isOffered:     e.isOffered,
      isStudentPlaced: e.isStudentPlaced,
      studentPlacedCompany: e.studentPlacedCompany || null,
      createdAt:     e.createdAt,
      student: e.studentId ? {
        _id:        e.studentId._id,
        name:       e.studentId.name,
        email:      e.studentId.emailId,
        phone:      e.studentId.phoneNo || null,
        rollNumber: rollMap[e.studentId._id.toString()] || null,
      } : null,
    }));

    return res.json({ company, entries: shaped });
  } catch (err) {
    logger.error("getSchedulerShortlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/scheduler/companies/:companyId/reorder
 * Body: { order: ['shortlistId1', 'shortlistId2', ...] }
 * Saves the new sortOrder for every entry in the company's shortlist.
 * Uses bulkWrite for a single round-trip; never touches fields other than sortOrder.
 */
export const reorderShortlist = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ message: "order must be a non-empty array of shortlist IDs" });
    }

    // Verify all IDs belong to this company (security: prevent cross-company tampering)
    const count = await Shortlist.countDocuments({
      _id: { $in: order },
      companyId,
    });
    if (count !== order.length) {
      return res.status(400).json({ message: "One or more IDs do not belong to this company" });
    }

    const ops = order.map((id, idx) => ({
      updateOne: {
        filter: { _id: id, companyId },
        update: { $set: { sortOrder: idx } },
      },
    }));

    await Shortlist.bulkWrite(ops, { ordered: false });

    logger.info(`Scheduler ${req.user.emailId} reordered ${order.length} entries for company ${companyId}`);
    return res.json({ message: "Order saved" });
  } catch (err) {
    logger.error("reorderShortlist error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
