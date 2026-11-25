import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

const REFRESH_INTERVAL = 20000; // 20 seconds

const STAGE_ORDER = ["SHORTLISTED", "WAITLISTED", "R1", "R2", "R3", "R4", "OFFERED", "REJECTED"];
const STAGE_COLORS = {
  SHORTLISTED: { bg: "#EBF0FF", text: "#2563EB", border: "#BFCFFF" },
  WAITLISTED:  { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  R1:          { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
  R2:          { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
  R3:          { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
  R4:          { bg: "#F3E8FF", text: "#7C3AED", border: "#DDD6FE" },
  OFFERED:     { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  REJECTED:    { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

function Tile({ label, value, sub, color = "#14213D", bg = "#F8F9FB" }) {
  return (
    <div style={{ background: bg, border: "1px solid #E4E1E0", borderRadius: 6, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: "#8D9096", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Badge({ stage }) {
  const c = STAGE_COLORS[stage] ?? { bg: "#F4F2F1", text: "#353B47", border: "#E9E9EB" };
  return (
    <span style={{ display: "inline-block", padding: "1px 7px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {stage}
    </span>
  );
}

export default function AdminDDayStats() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [companySort, setCompanySort] = useState({ key: "inInterview", dir: -1 });
  const [companySearch, setCompanySearch] = useState("");
  const [overlapSearch, setOverlapSearch] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(r => {
      setCachedUser(r.data.user); setUser(r.data.user);
    }).catch(() => {
      clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login");
    });
  }, []);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await api.get("/admin/dday-stats");
      setData(r.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch D-Day stats:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchStats(false);
    intervalRef.current = setInterval(() => fetchStats(true), REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [user, fetchStats]);

  if (!user || (loading && !data)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, border: "3px solid #14213D", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize: 13, color: "#8D9096" }}>Loading D-Day stats...</span>
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 24, color: "#C0300A" }}>Failed to load stats.</div>;

  const { overview, stageFunnel, perCompany, studentDistribution, companyOverlap, hotStudents, liveInterviews, idleCompanies, slotStats = [], slotConflicts = [] } = data;

  // ── Company table ──
  const sortedCompanies = [...perCompany]
    .filter(c => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()))
    .sort((a, b) => {
      const av = a[companySort.key] ?? 0;
      const bv = b[companySort.key] ?? 0;
      if (typeof av === "string") return companySort.dir * av.localeCompare(bv);
      return companySort.dir * (bv - av);
    });

  const toggleSort = (key) => setCompanySort(prev =>
    prev.key === key ? { key, dir: prev.dir * -1 } : { key, dir: -1 }
  );

  const sortIcon = (key) => {
    if (companySort.key !== key) return <span style={{ color: "#C8CAD0" }}>  </span>;
    return <span style={{ color: "#14213D" }}>{companySort.dir === -1 ? " v" : " ^"}</span>;
  };

  // ── Overlap search ──
  const filteredOverlap = companyOverlap.filter(o =>
    !overlapSearch ||
    o.company1Name.toLowerCase().includes(overlapSearch.toLowerCase()) ||
    o.company2Name.toLowerCase().includes(overlapSearch.toLowerCase())
  );

  // ── Stage funnel max ──
  const funnelMax = Math.max(...stageFunnel.map(s => s.count), 1);

  const timeAgo = lastRefresh
    ? `${Math.round((Date.now() - lastRefresh) / 1000)}s ago`
    : "—";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#14213D", margin: 0 }}>D-Day Analytics</h1>
          <div style={{ fontSize: 12, color: "#8D9096", marginTop: 2 }}>
            Live snapshot — auto-refreshes every 20s
            {refreshing && <span style={{ marginLeft: 8, color: "#14213D" }}>Refreshing...</span>}
            {!refreshing && lastRefresh && <span style={{ marginLeft: 8 }}>Updated {timeAgo}</span>}
          </div>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#14213D", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", opacity: refreshing ? 0.6 : 1 }}
        >
          Refresh now
        </button>
      </div>

      {/* ── Overview tiles ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 24 }}>
        <Tile label="Total Students" value={overview.totalStudents} />
        <Tile label="In Interview" value={overview.studentsInInterview} color="#7C3AED" bg="#F5F0FF" sub="right now" />
        <Tile label="Free" value={overview.studentsFree} color="#2563EB" bg="#EBF0FF" />
        <Tile label="Placed" value={overview.studentsPlaced} color="#065F46" bg="#ECFDF5" sub="admin confirmed" />
        <Tile label="Active Cos" value={overview.activeCompanies} sub={`${overview.completedCompanies} done`} />
        <Tile label="Offers Pending" value={overview.pendingOffers} color="#B45309" bg="#FFFBEB" sub="awaiting admin" />
        <Tile label="Offers Approved" value={overview.approvedOffers} color="#065F46" bg="#ECFDF5" />
        <Tile label="Accepted" value={overview.acceptedOffers} color="#065F46" bg="#DCFCE7" sub="by student" />
        {overview.declinedOffers > 0 && (
          <Tile label="Declined" value={overview.declinedOffers} color="#B91C1C" bg="#FEF2F2" sub="by student" />
        )}
      </div>

      {/* ── Live interviews + Idle companies ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Live interviews */}
        <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16 }}>
          <SectionHeader>Live interviews right now — {overview.studentsInInterview} students</SectionHeader>
          {liveInterviews.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8D9096", padding: "12px 0" }}>No interviews in progress.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {liveInterviews.map(co => (
                <div key={co.companyId} style={{ padding: "10px 12px", background: "#F8F9FB", border: "1px solid #E4E1E0", borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#14213D" }}>{co.companyName}</span>
                    <span style={{ fontSize: 11, color: "#8D9096" }}>{co.venue || ""}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {co.students.map((s, i) => (
                      <span key={i} style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>
                        {s.name} · {s.round}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stage funnel */}
        <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16 }}>
          <SectionHeader>Stage distribution (all shortlists)</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {STAGE_ORDER.map(stage => {
              const entry = stageFunnel.find(s => s.stage === stage);
              const count = entry?.count ?? 0;
              const pct = Math.round((count / funnelMax) * 100);
              const c = STAGE_COLORS[stage] ?? { bg: "#E9E9EB", text: "#353B47", border: "#E9E9EB" };
              return (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 600, color: c.text, flexShrink: 0 }}>{stage}</div>
                  <div style={{ flex: 1, background: "#F4F2F1", borderRadius: 2, height: 12, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: c.text, borderRadius: 2, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: "#353B47", textAlign: "right", flexShrink: 0 }}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Student distribution */}
          {studentDistribution.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Students by no. of companies shortlisted at
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {studentDistribution.map(d => (
                  <div key={d.companiesCount} style={{ padding: "4px 10px", background: "#F8F9FB", border: "1px solid #E4E1E0", borderRadius: 4, fontSize: 12, textAlign: "center" }}>
                    <span style={{ fontWeight: 700, color: "#14213D" }}>{d.studentCount}</span>
                    <span style={{ color: "#8D9096", marginLeft: 4 }}>@ {d.companiesCount} co{d.companiesCount !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Company pipeline table ─────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <SectionHeader>Company pipeline — {perCompany.length} companies</SectionHeader>
          <input
            value={companySearch}
            onChange={e => setCompanySearch(e.target.value)}
            placeholder="Search company..."
            style={{ marginLeft: "auto", padding: "5px 10px", fontSize: 12, border: "1px solid #E4E1E0", borderRadius: 4, outline: "none", width: 200, background: "#F8F9FB" }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E4E1E0" }}>
                {[
                  { key: "name", label: "Company" },
                  { key: "slot", label: "Slot" },
                  { key: "inInterview", label: "Live" },
                  { key: "total", label: "Total" },
                  { key: "shortlisted", label: "SL" },
                  { key: "waitlisted", label: "WL" },
                  { key: "R1", label: "R1" },
                  { key: "R2", label: "R2" },
                  { key: "R3", label: "R3" },
                  { key: "R4", label: "R4" },
                  { key: "offered", label: "Offered" },
                  { key: "rejected", label: "Rejected" },
                  { key: "placed", label: "Placed" },
                  { key: "isCompleted", label: "Status" },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    style={{ padding: "7px 10px", textAlign: col.key === "name" ? "left" : "center", fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.4, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
                  >
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map((c, idx) => (
                <tr key={c.companyId} style={{ borderBottom: "1px solid #F4F2F1", background: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 600, color: "#14213D", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                    {c.venue ? <span style={{ fontSize: 10, color: "#8D9096", marginLeft: 5 }}>{c.venue}</span> : null}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {c.slot ? (
                      <span style={{ padding: "1px 7px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#F0F4FF", color: "#3B5BDB", border: "1px solid #BAC8FF" }}>{c.slot}</span>
                    ) : <span style={{ color: "#C8CAD0" }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {c.inInterview > 0 ? (
                      <span style={{ padding: "1px 7px", fontSize: 11, fontWeight: 700, borderRadius: 20, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>{c.inInterview}</span>
                    ) : <span style={{ color: "#C8CAD0" }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600 }}>{c.total}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#2563EB" }}>{c.shortlisted || <span style={{ color: "#C8CAD0" }}>0</span>}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#B45309" }}>{c.waitlisted || <span style={{ color: "#C8CAD0" }}>0</span>}</td>
                  {["R1","R2","R3","R4"].map(r => (
                    <td key={r} style={{ padding: "7px 10px", textAlign: "center", color: c[r] > 0 ? "#7C3AED" : "#C8CAD0", fontWeight: c[r] > 0 ? 700 : 400 }}>
                      {c[r] || "—"}
                    </td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {c.offered > 0 ? <span style={{ color: "#065F46", fontWeight: 700 }}>{c.offered}</span> : <span style={{ color: "#C8CAD0" }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: c.rejected > 0 ? "#B91C1C" : "#C8CAD0" }}>
                    {c.rejected || "—"}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {c.placed > 0 ? <span style={{ color: "#065F46", fontWeight: 800 }}>{c.placed}</span> : <span style={{ color: "#C8CAD0" }}>—</span>}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {c.isCompleted
                      ? <span style={{ padding: "1px 7px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0" }}>Done</span>
                      : <span style={{ padding: "1px 7px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#EBF0FF", color: "#2563EB", border: "1px solid #BFCFFF" }}>Active</span>}
                  </td>
                </tr>
              ))}
              {sortedCompanies.length === 0 && (
                <tr><td colSpan={14} style={{ padding: "16px", textAlign: "center", color: "#8D9096" }}>No companies match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slot-wise summary ────────────────────────────────────────────── */}
      {slotStats.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16, marginBottom: 24 }}>
          <SectionHeader>Slot-wise breakdown</SectionHeader>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E4E1E0" }}>
                  {["Slot", "Companies", "Students", "Live", "R1", "R2", "R3", "R4", "Offered", "Placed", "Done"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: h === "Slot" || h === "Companies" ? "left" : "center", fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotStats.map((s, idx) => (
                  <tr key={s.slot} style={{ borderBottom: "1px solid #F4F2F1", background: idx % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ padding: "2px 10px", fontSize: 11, fontWeight: 800, borderRadius: 20, background: "#F0F4FF", color: "#3B5BDB", border: "1px solid #BAC8FF" }}>{s.slot}</span>
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 11, color: "#353B47", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.companies.join(", ")}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600 }}>{s.uniqueStudents}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center" }}>
                      {s.inInterview > 0 ? (
                        <span style={{ padding: "1px 7px", fontSize: 11, fontWeight: 700, borderRadius: 20, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>{s.inInterview}</span>
                      ) : <span style={{ color: "#C8CAD0" }}>—</span>}
                    </td>
                    {["R1","R2","R3","R4"].map(r => (
                      <td key={r} style={{ padding: "7px 10px", textAlign: "center", color: s[r] > 0 ? "#7C3AED" : "#C8CAD0", fontWeight: s[r] > 0 ? 700 : 400 }}>{s[r] || "—"}</td>
                    ))}
                    <td style={{ padding: "7px 10px", textAlign: "center", color: s.offered > 0 ? "#065F46" : "#C8CAD0", fontWeight: s.offered > 0 ? 700 : 400 }}>{s.offered || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center", color: s.placed > 0 ? "#065F46" : "#C8CAD0", fontWeight: s.placed > 0 ? 800 : 400 }}>{s.placed || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: "#353B47" }}>{s.completedCount}/{s.totalCompanies}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Slot conflicts ────────────────────────────────────────────────── */}
      {slotConflicts.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: 16, marginBottom: 24 }}>
          <SectionHeader>Slot conflicts — students shortlisted in multiple slots</SectionHeader>
          <div style={{ fontSize: 12, color: "#B91C1C", marginBottom: 10 }}>
            These students may need to choose between companies in different slots. Heads up for the admin.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {slotConflicts.map((s, i) => (
              <div key={i} style={{ padding: "6px 12px", background: "#fff", border: "1px solid #FECACA", borderRadius: 4, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "#14213D" }}>{s.name}</span>
                {s.inInterview && <span style={{ marginLeft: 5, padding: "1px 5px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>Live</span>}
                <span style={{ marginLeft: 8, color: "#B91C1C" }}>{s.slots.join(" + ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Company overlap + Hot students ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Company overlap */}
        <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16 }}>
          <SectionHeader>Company overlap — most contested student pools</SectionHeader>
          <input
            value={overlapSearch}
            onChange={e => setOverlapSearch(e.target.value)}
            placeholder="Filter by company name..."
            style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #E4E1E0", borderRadius: 4, outline: "none", marginBottom: 10, background: "#F8F9FB", boxSizing: "border-box" }}
          />
          <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {filteredOverlap.length === 0 && (
              <div style={{ fontSize: 13, color: "#8D9096" }}>No overlaps found.</div>
            )}
            {filteredOverlap.map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: i % 2 === 0 ? "#F8F9FB" : "#fff", borderRadius: 3, border: "1px solid #F0EEEd" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#F3E8FF", color: "#7C3AED", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {o.count}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E2532", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ color: "#14213D" }}>{o.company1Name}</span>
                    <span style={{ color: "#8D9096", fontSize: 10 }}>vs</span>
                    <span style={{ color: "#14213D" }}>{o.company2Name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#8D9096", marginTop: 2 }}>
                    {o.students.slice(0, 4).join(", ")}{o.count > 4 ? ` +${o.count - 4} more` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hot students */}
        <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16 }}>
          <SectionHeader>Most contested students</SectionHeader>
          <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {hotStudents.length === 0 && (
              <div style={{ fontSize: 13, color: "#8D9096" }}>No data.</div>
            )}
            {hotStudents.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: i % 2 === 0 ? "#F8F9FB" : "#fff", borderRadius: 3, border: "1px solid #F0EEED" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E8EDF5", color: "#14213D", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {s.count}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#14213D" }}>{s.name}</span>
                    {s.inInterview && <span style={{ padding: "1px 6px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>In interview</span>}
                    {s.placed && <span style={{ padding: "1px 6px", fontSize: 10, fontWeight: 700, borderRadius: 20, background: "#DCFCE7", color: "#065F46", border: "1px solid #A7F3D0" }}>Placed</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#8D9096", marginTop: 2 }}>
                    {s.companies.join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Idle companies ─────────────────────────────────────────────────── */}
      {idleCompanies.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: 16, marginBottom: 24 }}>
          <SectionHeader>Idle companies — active but no student called to any round yet</SectionHeader>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {idleCompanies.map(c => (
              <div key={c.companyId} style={{ padding: "5px 12px", background: "#fff", border: "1px solid #FDE68A", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#92400E" }}>
                {c.name} <span style={{ fontWeight: 400, color: "#B45309" }}>({c.total})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Offer pipeline ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 6, padding: 16, marginBottom: 24 }}>
        <SectionHeader>Offer pipeline</SectionHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
          {[
            { label: "POC Created", value: overview.totalOffers, color: "#2563EB", bg: "#EBF0FF" },
            { label: "Admin Approved", value: overview.approvedOffers + overview.acceptedOffers + overview.declinedOffers, color: "#065F46", bg: "#ECFDF5" },
            { label: "Student Accepted", value: overview.acceptedOffers, color: "#065F46", bg: "#DCFCE7" },
            { label: "Pending Admin", value: overview.pendingOffers, color: "#B45309", bg: "#FFFBEB" },
            { label: "Declined", value: overview.declinedOffers, color: "#B91C1C", bg: "#FEF2F2" },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{ padding: "12px 20px", background: step.bg, borderRadius: 4, textAlign: "center", minWidth: 110 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: step.color }}>{step.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: step.color, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>{step.label}</div>
              </div>
              {i < 4 && <div style={{ fontSize: 18, color: "#C8CAD0", padding: "0 6px" }}>{">"}</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#C8CAD0", textAlign: "center", paddingBottom: 20 }}>
        Data current as of {lastRefresh?.toLocaleTimeString("en-IN") ?? "—"} · Current season companies only
      </div>
    </div>
  );
}
