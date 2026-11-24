import Shortlist from "../models/shortlist.model.js";
import StudentPresence from "../models/studentPresence.model.js";
import User from "../models/user.model.js";
import Student from "../models/student.model.js";
import { logger } from "../utils/logger.js";
import { emitStudentPresenceUpdate } from "../config/socket.js";

/** All company IDs the student is shortlisted at — used for socket fan-out */
async function getStudentCompanyIds(studentUserId) {
  const shortlists = await Shortlist.find({ studentId: studentUserId }).select("companyId").lean();
  return shortlists.map(s => s.companyId.toString());
}

/**
 * POST /api/poc/shortlist/:shortlistId/presence/enter
 * Body: { round: "R1" | "R2" | "R3" | "R4" }
 *
 * Explicitly marks a student as physically inside the interview room.
 * Blocks (409) if already busy at another company — a student can't be in two rooms.
 */
export const enterPresence = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const { round } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const shortlist = await Shortlist.findById(shortlistId)
      .populate("companyId", "name venue POCs isProcessCompleted")
      .populate("studentId", "name");

    if (!shortlist) return res.status(404).json({ message: "Shortlist entry not found" });

    if (userRole !== "admin") {
      if (!shortlist.companyId.POCs.some(p => p.toString() === userId.toString())) {
        return res.status(403).json({ message: "You are not assigned to this company" });
      }
      if (shortlist.companyId.isProcessCompleted) {
        return res.status(403).json({ message: "Process is completed" });
      }
    }

    const studentUserId = shortlist.studentId._id;

    // Atomic conditional write — no separate read-then-write gap.
    //
    // The filter { studentId, status: { $ne: "busy" } } only matches when the
    // student is free (or has no presence doc yet).
    // - Free → matches → updates to busy → returns updated doc.
    // - No doc yet → no match → upsert inserts new busy doc → returns new doc.
    // - Already busy → no match → upsert tries to insert a second doc with the
    //   same studentId → unique index fires E11000.  We catch that and return
    //   the same 409 we would have returned from the old race-prone check.
    //   A findOne inside the catch gives us the current state for the message.
    let presence;
    try {
      presence = await StudentPresence.findOneAndUpdate(
        { studentId: studentUserId, status: { $ne: "busy" } },
        {
          $set: {
            status: "busy",
            companyId: shortlist.companyId._id,
            companyName: shortlist.companyId.name,
            venue: shortlist.companyId.venue || null,
            round: round || null,
            enteredAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (writeErr) {
      if (writeErr.code === 11000) {
        // Atomic loss: student is (or just became) busy — fetch to build message
        const current = await StudentPresence.findOne({ studentId: studentUserId }).lean();
        const thisCompanyId = shortlist.companyId._id.toString();
        if (current?.companyId?.toString() === thisCompanyId) {
          return res.status(409).json({
            message: `${shortlist.studentId.name} is already checked in here (${current.round || ""}). Use End Interview to release them first.`,
          });
        }
        const sinceTime = current?.enteredAt
          ? new Date(current.enteredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : "";
        return res.status(409).json({
          message: `${shortlist.studentId.name} is currently in an interview at ${current?.companyName} (${current?.round || ""})${sinceTime ? ` since ${sinceTime}` : ""}. Ask that POC to mark them free first.`,
          busyAt: { companyName: current?.companyName, round: current?.round, enteredAt: current?.enteredAt },
        });
      }
      throw writeErr; // other DB error — rethrow to outer catch
    }

    logger.info(`Presence enter: ${shortlist.studentId.name} @ ${shortlist.companyId.name} (${round})`);

    const companyIds = await getStudentCompanyIds(studentUserId);
    emitStudentPresenceUpdate(studentUserId.toString(), presence.toObject(), companyIds);

    return res.json({ message: "Interview started", presence });
  } catch (err) {
    logger.error("enterPresence error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/poc/shortlist/:shortlistId/presence/exit
 *
 * Explicitly marks a student as free after their interview at this company ends.
 * Only the company that checked them in can check them out (or admin).
 */
export const exitPresence = async (req, res) => {
  try {
    const { shortlistId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const shortlist = await Shortlist.findById(shortlistId)
      .populate("companyId", "name POCs isProcessCompleted")
      .populate("studentId", "name");

    if (!shortlist) return res.status(404).json({ message: "Shortlist entry not found" });

    if (userRole !== "admin") {
      if (!shortlist.companyId.POCs.some(p => p.toString() === userId.toString())) {
        return res.status(403).json({ message: "You are not assigned to this company" });
      }
    }

    const studentUserId = shortlist.studentId._id;
    const existing = await StudentPresence.findOne({ studentId: studentUserId }).lean();

    if (!existing || existing.status === "free") {
      return res.json({ message: "Student is already free" });
    }

    // Only the company that checked them in (or admin) can release them
    if (userRole !== "admin" && existing.companyId?.toString() !== shortlist.companyId._id.toString()) {
      return res.status(403).json({
        message: `${shortlist.studentId.name} is in an interview at ${existing.companyName}, not at your company. Only their current POC can release them.`,
      });
    }

    const presence = await StudentPresence.findOneAndUpdate(
      { studentId: studentUserId },
      { status: "free", companyId: null, companyName: null, venue: null, round: null, enteredAt: null },
      { new: true }
    );

    logger.info(`Presence exit: ${shortlist.studentId.name} freed from ${existing.companyName}`);

    const companyIds = await getStudentCompanyIds(studentUserId);
    emitStudentPresenceUpdate(studentUserId.toString(), presence.toObject(), companyIds);

    return res.json({ message: "Interview ended, student is free", presence });
  } catch (err) {
    logger.error("exitPresence error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/poc/companies/:companyId/presence
 * Returns current presence keyed by studentId for all students shortlisted at this company.
 * Used by POCCompanyStudents to load the initial snapshot.
 */
export const getPresenceForCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const shortlists = await Shortlist.find({ companyId }).select("studentId").lean();
    const studentIds = shortlists.map(s => s.studentId);

    const presences = await StudentPresence.find({ studentId: { $in: studentIds } }).lean();
    const map = {};
    presences.forEach(p => { map[p.studentId.toString()] = p; });

    return res.json({ presence: map });
  } catch (err) {
    logger.error("getPresenceForCompany error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/admin/presence
 * Returns ALL presence records with student name/roll/email, for the Admin Student Tracker.
 */
export const getAllPresence = async (req, res) => {
  try {
    const presences = await StudentPresence.find({})
      .populate("studentId", "name emailId")
      .populate("companyId", "name venue")
      .lean();

    // Enrich with roll numbers from Student docs
    const userIds = presences.map(p => p.studentId?._id).filter(Boolean);
    const students = await Student.find({ userId: { $in: userIds } }).select("userId rollNumber").lean();
    const rollMap = new Map(students.map(s => [s.userId.toString(), s.rollNumber]));

    const enriched = presences.map(p => ({
      ...p,
      rollNumber: p.studentId ? (rollMap.get(p.studentId._id.toString()) || null) : null,
    }));

    return res.json({ presence: enriched });
  } catch (err) {
    logger.error("getAllPresence error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/admin/presence/:studentId/force-free
 * Admin-only override — clears a stuck "busy" status regardless of which company set it.
 * :studentId is the User._id.
 */
export const forceFreePresence = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId).select("name").lean();
    if (!student) return res.status(404).json({ message: "Student not found" });

    const existing = await StudentPresence.findOne({ studentId }).lean();
    if (!existing || existing.status === "free") {
      return res.json({ message: "Student is already free" });
    }

    const prevCompany = existing.companyName;
    const presence = await StudentPresence.findOneAndUpdate(
      { studentId },
      { status: "free", companyId: null, companyName: null, venue: null, round: null, enteredAt: null },
      { new: true }
    );

    logger.info(`Admin ${req.user.emailId} force-freed ${student.name} from ${prevCompany}`);

    const companyIds = await getStudentCompanyIds(studentId);
    emitStudentPresenceUpdate(studentId.toString(), presence.toObject(), companyIds);

    return res.json({ message: `${student.name} has been force-freed from ${prevCompany}`, presence });
  } catch (err) {
    logger.error("forceFreePresence error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Auto-releases presence if the student is currently busy at this specific company.
 * Called from poc.controller.js on REJECTED / OFFERED to avoid stale "busy" state.
 * Silent no-op if the student is free or busy elsewhere.
 */
export async function autoReleasePresenceIfAtCompany(studentUserId, companyId) {
  try {
    const presence = await StudentPresence.findOne({ studentId: studentUserId }).lean();
    if (!presence || presence.status !== "busy") return;
    if (presence.companyId?.toString() !== companyId.toString()) return;

    const updated = await StudentPresence.findOneAndUpdate(
      { studentId: studentUserId },
      { status: "free", companyId: null, companyName: null, venue: null, round: null, enteredAt: null },
      { new: true }
    );

    const companyIds = await getStudentCompanyIds(studentUserId);
    emitStudentPresenceUpdate(studentUserId.toString(), updated.toObject(), companyIds);
    logger.info(`Auto-released presence for student ${studentUserId} from company ${companyId}`);
  } catch (err) {
    logger.error("autoReleasePresenceIfAtCompany error:", err);
  }
}
