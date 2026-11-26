/**
 * App Integration controllers — read-only, no mutations, plain .lean() queries.
 * All routes are guarded by appAuth (shared-secret) and are intentionally
 * outside the existing JWT/session auth wall.
 */

import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import Shortlist from "../models/shortlist.model.js";
import StudentPresence from "../models/studentPresence.model.js";
import { logger } from "../utils/logger.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function shapePOC(poc, company) {
  return {
    name:        poc.name,
    email:       poc.emailId,
    phone:       poc.phoneNo || null,
    companyId:   company._id,
    companyName: company.name,
  };
}

function shapeShortlist(sl) {
  return {
    companyId:           sl.companyId?._id  ?? sl.companyId,
    companyName:         sl.companyId?.name ?? sl.companyName ?? null,
    status:              sl.status,
    stage:               sl.stage || null,
    isOffered:           sl.isOffered,
    isStudentPlaced:     sl.isStudentPlaced,
    studentPlacedCompany: sl.studentPlacedCompany || null,
  };
}

function shapePresence(p) {
  if (!p || p.status !== "busy") return { status: "free" };
  return {
    status:    "busy",
    companyId: p.companyId?._id ?? p.companyId ?? null,
    companyName: p.companyId?.name ?? null,
    round:     p.round     || null,
    enteredAt: p.enteredAt || null,
  };
}

function shapeStudent(studentDoc, userDoc, shortlists, presence) {
  return {
    name:        userDoc.name,
    email:       userDoc.emailId,
    rollNumber:  studentDoc.rollNumber || null,
    isPlaced:    studentDoc.isPlaced,
    placedCompany: studentDoc.placedCompany?.name ?? null,
    presence:    shapePresence(presence),
    shortlists:  shortlists.map(shapeShortlist),
  };
}

// ── GET /app-integration/pocs ─────────────────────────────────────────────────
// All POCs for current-season companies, with the company they belong to.
export const listPOCs = async (req, res) => {
  try {
    const companies = await Company.find({ placementYear: null })
      .select("name POCs")
      .populate("POCs", "name emailId phoneNo")
      .lean();

    const pocs = companies.flatMap(c =>
      (c.POCs || []).map(p => shapePOC(p, c))
    );

    return res.json({ count: pocs.length, pocs });
  } catch (err) {
    logger.error("[appIntegration] listPOCs error:", err);
    return res.status(500).json({ status: "error", msg: "Server error" });
  }
};

// ── GET /app-integration/pocs/:companyId ──────────────────────────────────────
// POCs for a single current-season company.
export const listPOCsByCompany = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.companyId,
      placementYear: null,
    })
      .select("name POCs")
      .populate("POCs", "name emailId phoneNo")
      .lean();

    if (!company) {
      return res.status(404).json({ status: "error", msg: "Company not found" });
    }

    const pocs = (company.POCs || []).map(p => shapePOC(p, company));
    return res.json({ companyId: company._id, companyName: company.name, count: pocs.length, pocs });
  } catch (err) {
    logger.error("[appIntegration] listPOCsByCompany error:", err);
    return res.status(500).json({ status: "error", msg: "Server error" });
  }
};

// ── GET /app-integration/students ────────────────────────────────────────────
// All current-season students with presence + shortlist + placement status.
// Supports optional ?limit=<n>&page=<n> (default: return all, max 1000 per page).
export const listStudents = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 0, 0), 1000);
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);

    const baseQuery = Student.find({ placementYear: null })
      .select("userId rollNumber isPlaced placedCompany")
      .populate("userId",       "name emailId")
      .populate("placedCompany", "name")
      .lean();

    if (limit) baseQuery.skip((page - 1) * limit).limit(limit);

    const students = await baseQuery;
    const total    = limit
      ? await Student.countDocuments({ placementYear: null })
      : students.length;

    const userIds = students.map(s => s.userId?._id).filter(Boolean);

    const [shortlists, presences] = await Promise.all([
      Shortlist.find({ studentId: { $in: userIds } })
        .select("studentId companyId companyName status stage isOffered isStudentPlaced studentPlacedCompany")
        .populate("companyId", "name")
        .lean(),
      StudentPresence.find({ studentId: { $in: userIds }, status: "busy" })
        .select("studentId companyId status round enteredAt")
        .populate("companyId", "name")
        .lean(),
    ]);

    // Index by user _id string for O(1) lookup
    const shortlistMap = new Map();
    for (const sl of shortlists) {
      const uid = sl.studentId.toString();
      if (!shortlistMap.has(uid)) shortlistMap.set(uid, []);
      shortlistMap.get(uid).push(sl);
    }
    const presenceMap = new Map(
      presences.map(p => [p.studentId.toString(), p])
    );

    const result = students.map(s => {
      const uid = s.userId?._id?.toString();
      return shapeStudent(
        s,
        s.userId || {},
        shortlistMap.get(uid) || [],
        presenceMap.get(uid)  || null,
      );
    });

    return res.json({
      count: result.length,
      total,
      ...(limit ? { page, pages: Math.ceil(total / limit) } : {}),
      students: result,
    });
  } catch (err) {
    logger.error("[appIntegration] listStudents error:", err);
    return res.status(500).json({ status: "error", msg: "Server error" });
  }
};

// ── GET /app-integration/students/:rollNumberOrEmail ─────────────────────────
// Single student lookup by roll number OR email (tries roll number first).
export const getStudent = async (req, res) => {
  try {
    const { rollNumberOrEmail } = req.params;
    const isEmail = rollNumberOrEmail.includes("@");

    let studentDoc = null;
    let userDoc    = null;

    if (isEmail) {
      userDoc    = await User.findOne({ emailId: rollNumberOrEmail.toLowerCase() }).lean();
      if (userDoc) {
        studentDoc = await Student.findOne({ userId: userDoc._id, placementYear: null })
          .populate("placedCompany", "name")
          .lean();
      }
    } else {
      studentDoc = await Student.findOne({ rollNumber: rollNumberOrEmail, placementYear: null })
        .populate("placedCompany", "name")
        .lean();
      if (studentDoc) {
        userDoc = await User.findById(studentDoc.userId).lean();
      }
    }

    if (!studentDoc || !userDoc) {
      return res.status(404).json({ status: "error", msg: "Student not found" });
    }

    const uid = userDoc._id;
    const [shortlists, presence] = await Promise.all([
      Shortlist.find({ studentId: uid })
        .select("companyId companyName status stage isOffered isStudentPlaced studentPlacedCompany")
        .populate("companyId", "name")
        .lean(),
      StudentPresence.findOne({ studentId: uid })
        .populate("companyId", "name")
        .lean(),
    ]);

    return res.json({
      student: shapeStudent(studentDoc, userDoc, shortlists, presence),
    });
  } catch (err) {
    logger.error("[appIntegration] getStudent error:", err);
    return res.status(500).json({ status: "error", msg: "Server error" });
  }
};
