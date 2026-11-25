import Company from "../models/company.model.js";
import Shortlist from "../models/shortlist.model.js";
import StudentPresence from "../models/studentPresence.model.js";
import Offer from "../models/offer.model.js";
import Student from "../models/student.model.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/admin/dday-stats
 * Comprehensive D-Day analytics for the admin. All data is computed server-side
 * so the frontend can render immediately with no secondary requests.
 */
export const getDdayStats = async (req, res) => {
  try {
    // ── 1. Base data ────────────────────────────────────────────────────────
    const companies = await Company.find({ placementYear: null })
      .select("name venue description isProcessCompleted maxRounds")
      .lean();
    const companyIds = companies.map(c => c._id);
    const companyMap = new Map(companies.map(c => [c._id.toString(), c]));

    // Shortlists first — they define who belongs to this season.
    // Every downstream query uses this student set so nothing from past seasons leaks in.
    const shortlists = await Shortlist.find({ companyId: { $in: companyIds } })
      .populate("studentId", "name emailId")
      .select("companyId studentId status stage isOffered isStudentPlaced")
      .lean();

    const currentStudentIdSet = new Set(
      shortlists.map(s => s.studentId?._id?.toString() ?? s.studentId?.toString()).filter(Boolean)
    );
    const currentStudentIds = Array.from(currentStudentIdSet);

    // All remaining queries are scoped to current-season companies AND students.
    const [presences, offers, placements] = await Promise.all([
      StudentPresence.find({ studentId: { $in: currentStudentIds }, status: "busy" })
        .populate("studentId", "name")
        .lean(),
      Offer.find({ companyId: { $in: companyIds }, studentId: { $in: currentStudentIds } })
        .select("companyId studentId approvalStatus offerStatus")
        .lean(),
      Student.find({ userId: { $in: currentStudentIds }, placementYear: null, isPlaced: true })
        .select("userId placedCompany")
        .populate("placedCompany", "name")
        .lean(),
    ]);

    // ── 2. Index building ────────────────────────────────────────────────────
    const currentCompanyIdSet = new Set(companyIds.map(id => id.toString()));

    // Presence: studentId -> presence doc
    // Query is already scoped to current-season students; additionally guard companyId
    // so a student busy at a non-current company (edge case) doesn't inflate live counts.
    const presenceMap = new Map();
    for (const p of presences) {
      if (p.companyId && currentCompanyIdSet.has(p.companyId.toString())) {
        presenceMap.set(p.studentId?._id?.toString() ?? p.studentId?.toString(), p);
      }
    }

    // Student -> [companyId strings] for overlap computation
    const studentCompanies = new Map(); // studentId -> { name, email, companyIds[] }
    for (const s of shortlists) {
      const sid = s.studentId?._id?.toString() ?? s.studentId?.toString();
      if (!sid) continue;
      if (!studentCompanies.has(sid)) {
        studentCompanies.set(sid, {
          name: s.studentId?.name ?? "—",
          email: s.studentId?.emailId ?? "",
          companyIds: [],
          companyNames: [],
        });
      }
      const cid = s.companyId?.toString();
      const comp = companyMap.get(cid);
      studentCompanies.get(sid).companyIds.push(cid);
      studentCompanies.get(sid).companyNames.push(comp?.name ?? "?");
    }

    // Per-company shortlist buckets
    const companyStats = new Map(); // companyId -> stats object
    for (const c of companies) {
      companyStats.set(c._id.toString(), {
        companyId: c._id,
        name: c.name,
        venue: c.venue ?? "",
        isCompleted: c.isProcessCompleted,
        maxRounds: c.maxRounds ?? 4,
        shortlisted: 0, waitlisted: 0,
        R1: 0, R2: 0, R3: 0, R4: 0,
        offered: 0, rejected: 0, placed: 0,
        inInterview: 0,
      });
    }

    for (const s of shortlists) {
      const cid = s.companyId?.toString();
      const st = companyStats.get(cid);
      if (!st) continue;
      if (s.status === "shortlisted") st.shortlisted++;
      else if (s.status === "waitlisted") st.waitlisted++;
      if (s.stage === "R1") st.R1++;
      else if (s.stage === "R2") st.R2++;
      else if (s.stage === "R3") st.R3++;
      else if (s.stage === "R4") st.R4++;
      if (s.stage === "REJECTED") st.rejected++;
      if (s.isOffered) st.offered++;
      if (s.isStudentPlaced) st.placed++;
    }

    for (const p of presences) {
      const cid = p.companyId?.toString();
      const st = cid ? companyStats.get(cid) : null;
      if (st) st.inInterview++;
    }

    // Offer index
    const offersByCompany = new Map();
    let pendingOffers = 0, approvedOffers = 0, acceptedOffers = 0, declinedOffers = 0;
    for (const o of offers) {
      const cid = o.companyId?.toString();
      if (!offersByCompany.has(cid)) offersByCompany.set(cid, { pending: 0, approved: 0, accepted: 0 });
      const ob = offersByCompany.get(cid);
      if (o.approvalStatus === "PENDING") { ob.pending++; pendingOffers++; }
      else if (o.approvalStatus === "APPROVED") {
        ob.approved++;
        approvedOffers++;
        if (o.offerStatus === "ACCEPTED") { acceptedOffers++; }
        else if (o.offerStatus === "DECLINED") { declinedOffers++; }
      }
    }

    // ── 3. Overview ─────────────────────────────────────────────────────────
    const uniqueStudentIds = new Set(shortlists.map(s => s.studentId?._id?.toString() ?? s.studentId?.toString()).filter(Boolean));
    const studentsInInterview = presenceMap.size;
    const studentsPlaced = placements.length;

    const overview = {
      totalStudents: uniqueStudentIds.size,
      studentsInInterview,
      studentsFree: uniqueStudentIds.size - studentsInInterview,
      studentsPlaced,
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => !c.isProcessCompleted).length,
      completedCompanies: companies.filter(c => c.isProcessCompleted).length,
      pendingOffers,
      approvedOffers,
      acceptedOffers,
      declinedOffers,
      totalOffers: offers.length,
    };

    // ── 4. Stage funnel (across all shortlists) ─────────────────────────────
    const stageCounts = { SHORTLISTED: 0, WAITLISTED: 0, R1: 0, R2: 0, R3: 0, R4: 0, OFFERED: 0, REJECTED: 0 };
    for (const s of shortlists) {
      if (s.isOffered) { stageCounts.OFFERED++; continue; }
      if (s.stage === "REJECTED") { stageCounts.REJECTED++; continue; }
      if (s.stage === "R1") stageCounts.R1++;
      else if (s.stage === "R2") stageCounts.R2++;
      else if (s.stage === "R3") stageCounts.R3++;
      else if (s.stage === "R4") stageCounts.R4++;
      else if (s.status === "waitlisted") stageCounts.WAITLISTED++;
      else stageCounts.SHORTLISTED++;
    }
    const stageFunnel = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }));

    // ── 5. Per-company table (sorted: active first, then by inInterview desc) ─
    const perCompany = Array.from(companyStats.values()).map(st => ({
      ...st,
      offers: offersByCompany.get(st.companyId.toString()) ?? { pending: 0, approved: 0, accepted: 0 },
      total: st.shortlisted + st.waitlisted,
    })).sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return (b.inInterview + b.R1 + b.R2 + b.R3 + b.R4) - (a.inInterview + a.R1 + a.R2 + a.R3 + a.R4);
    });

    // ── 6. Student distribution: how many companies each student is at ───────
    const countBuckets = new Map();
    for (const [, info] of studentCompanies) {
      const n = info.companyIds.length;
      countBuckets.set(n, (countBuckets.get(n) ?? 0) + 1);
    }
    const studentDistribution = Array.from(countBuckets.entries())
      .map(([companiesCount, studentCount]) => ({ companiesCount, studentCount }))
      .sort((a, b) => a.companiesCount - b.companiesCount);

    // ── 7. Company overlap: top-20 pairs by shared students ─────────────────
    const pairCount = new Map(); // "idA|idB" -> { count, names, students[] }
    for (const [sid, info] of studentCompanies) {
      const ids = info.companyIds;
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const [a, b] = [ids[i], ids[j]].sort();
          const key = `${a}|${b}`;
          if (!pairCount.has(key)) {
            pairCount.set(key, {
              company1Id: a, company2Id: b,
              company1Name: companyMap.get(a)?.name ?? "?",
              company2Name: companyMap.get(b)?.name ?? "?",
              count: 0, students: [],
            });
          }
          const entry = pairCount.get(key);
          entry.count++;
          if (entry.students.length < 5) entry.students.push(info.name);
        }
      }
    }
    const companyOverlap = Array.from(pairCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── 8. Hot students: most contested (shortlisted at most companies) ──────
    const hotStudents = Array.from(studentCompanies.entries())
      .map(([sid, info]) => ({
        studentId: sid,
        name: info.name,
        email: info.email,
        count: info.companyIds.length,
        companies: info.companyNames,
        inInterview: presenceMap.has(sid),
        placed: placements.some(p => p.userId?.toString() === sid),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── 9. Live interviews right now ─────────────────────────────────────────
    const liveByCompany = new Map();
    for (const p of presences) {
      const cid = p.companyId?.toString();
      if (!cid || !currentCompanyIdSet.has(cid)) continue;
      if (!liveByCompany.has(cid)) {
        liveByCompany.set(cid, {
          companyId: cid,
          companyName: companyMap.get(cid)?.name ?? "?",
          venue: companyMap.get(cid)?.venue ?? "",
          students: [],
        });
      }
      liveByCompany.get(cid).students.push({
        name: p.studentId?.name ?? "—",
        round: p.round ?? "?",
        enteredAt: p.enteredAt,
      });
    }
    const liveInterviews = Array.from(liveByCompany.values())
      .sort((a, b) => b.students.length - a.students.length);

    // ── 10. Idle companies: active but no one past shortlisted stage yet ─────
    const idleCompanies = perCompany
      .filter(c => !c.isCompleted && c.R1 === 0 && c.R2 === 0 && c.R3 === 0 && c.R4 === 0 && c.inInterview === 0 && c.offered === 0)
      .map(c => ({ companyId: c.companyId, name: c.name, total: c.total, slot: c.slot }));

    // ── 11. Slot-wise analysis (company.description = slot e.g. "1.1", "2", "3") ──
    const slotMap = new Map(); // slot -> { slot, companies[], students (unique set), inInterview, offered, placed, completed }
    for (const c of companies) {
      const slot = c.description?.trim() || "Unassigned";
      if (!slotMap.has(slot)) {
        slotMap.set(slot, {
          slot,
          companies: [],
          studentIds: new Set(),
          inInterview: 0,
          offered: 0,
          placed: 0,
          completedCount: 0,
          totalCompanies: 0,
          R1: 0, R2: 0, R3: 0, R4: 0,
        });
      }
      slotMap.get(slot).companies.push(c.name);
    }

    // Pull per-company stats into slot buckets
    for (const cs of perCompany) {
      const slot = companyMap.get(cs.companyId.toString())?.description?.trim() || "Unassigned";
      const sb = slotMap.get(slot);
      if (!sb) continue;
      sb.totalCompanies++;
      sb.inInterview += cs.inInterview;
      sb.offered += cs.offered;
      sb.placed += cs.placed;
      sb.R1 += cs.R1; sb.R2 += cs.R2; sb.R3 += cs.R3; sb.R4 += cs.R4;
      if (cs.isCompleted) sb.completedCount++;
    }

    // Pull unique students per slot from shortlists
    for (const s of shortlists) {
      const cid = s.companyId?.toString();
      const slot = companyMap.get(cid)?.description?.trim() || "Unassigned";
      const sb = slotMap.get(slot);
      if (!sb) continue;
      const sid = s.studentId?._id?.toString() ?? s.studentId?.toString();
      if (sid) sb.studentIds.add(sid);
    }

    // Students appearing in multiple slots (slot conflicts)
    const studentSlots = new Map(); // studentId -> Set<slot>
    for (const s of shortlists) {
      const sid = s.studentId?._id?.toString() ?? s.studentId?.toString();
      if (!sid) continue;
      const cid = s.companyId?.toString();
      const slot = companyMap.get(cid)?.description?.trim() || "Unassigned";
      if (!studentSlots.has(sid)) studentSlots.set(sid, { slots: new Set(), name: s.studentId?.name ?? "—" });
      studentSlots.get(sid).slots.add(slot);
    }

    const slotConflicts = Array.from(studentSlots.entries())
      .filter(([, v]) => v.slots.size > 1)
      .map(([sid, v]) => ({
        studentId: sid,
        name: v.name,
        slots: Array.from(v.slots).sort(),
        inInterview: presenceMap.has(sid),
      }))
      .sort((a, b) => b.slots.length - a.slots.length)
      .slice(0, 30);

    // Sort slots naturally: "1" < "1.1" < "1.2" < "2" < "Unassigned"
    const slotStats = Array.from(slotMap.values())
      .map(sb => ({
        slot: sb.slot,
        companies: sb.companies,
        totalCompanies: sb.totalCompanies,
        uniqueStudents: sb.studentIds.size,
        inInterview: sb.inInterview,
        offered: sb.offered,
        placed: sb.placed,
        completedCount: sb.completedCount,
        R1: sb.R1, R2: sb.R2, R3: sb.R3, R4: sb.R4,
      }))
      .sort((a, b) => {
        if (a.slot === "Unassigned") return 1;
        if (b.slot === "Unassigned") return -1;
        const [am, as_] = a.slot.split(".").map(Number);
        const [bm, bs] = b.slot.split(".").map(Number);
        return am !== bm ? am - bm : (as_ ?? 0) - (bs ?? 0);
      });

    // Add slot to perCompany for the frontend
    const perCompanyWithSlot = perCompany.map(c => ({
      ...c,
      slot: companyMap.get(c.companyId.toString())?.description?.trim() || "",
    }));

    return res.json({
      overview,
      stageFunnel,
      perCompany: perCompanyWithSlot,
      studentDistribution,
      companyOverlap,
      hotStudents,
      liveInterviews,
      idleCompanies,
      slotStats,
      slotConflicts,
      generatedAt: new Date(),
    });
  } catch (err) {
    logger.error("getDdayStats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
