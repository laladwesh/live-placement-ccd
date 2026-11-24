// src/pages/AdminStudents.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

// ── Segmented toggle — matches portal's squared button kit ──────────
function SegBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 28,
        padding: "0 12px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "Inter, -apple-system, sans-serif",
        borderRadius: 2,
        border: active ? "1px solid #14213D" : "1px solid #DBDDE0",
        background: active ? "#14213D" : "#ffffff",
        color: active ? "#ffffff" : "#353B47",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s, color 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function SortTh({ label, col, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th
      className="pp-table-th"
      onClick={() => onSort(col)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 11 }}>
        {active && sortDir === "desc" ? "↓" : "↑"}
      </span>
    </th>
  );
}

export default function AdminStudents() {
  const navigate = useNavigate();
  const [user, setUser]       = useState(() => getCachedUser());
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // filters & sort
  const [search, setSearch]               = useState("");
  const [placedFilter, setPlacedFilter]   = useState("all");
  const [shortlistFilter, setShortlistFilter] = useState("all");
  const [sortBy, setSortBy]   = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user); setUser(res.data.user);
    }).catch(() => {
      clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]); // eslint-disable-line

  useEffect(() => { fetchStudents(); }, []); // eslint-disable-line

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/students");
      setStudents(res.data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await api.post("/admin/sync/students");
      setSyncResult(res.data);
      fetchStudents();
    } catch (err) {
      setSyncResult({ error: err.response?.data?.message || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  // ── derive display list ──────────────────────────────────────────
  let visible = students;
  const q = search.trim().toLowerCase();
  if (q) {
    visible = visible.filter(s =>
      [s.userId?.name, s.userId?.emailId, s.rollNumber]
        .some(v => v?.toLowerCase().includes(q))
    );
  }
  if (placedFilter === "placed")     visible = visible.filter(s => s.isPlaced);
  if (placedFilter === "not_placed") visible = visible.filter(s => !s.isPlaced);
  if (shortlistFilter === "yes") visible = visible.filter(s => (s.shortlistedCompanies?.length || 0) > 0);
  if (shortlistFilter === "no")  visible = visible.filter(s => (s.shortlistedCompanies?.length || 0) === 0);

  visible = [...visible].sort((a, b) => {
    if (sortBy === "roll") {
      const va = a.rollNumber || "", vb = b.rollNumber || "";
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (sortBy === "shortlisted") {
      const va = a.shortlistedCompanies?.length || 0;
      const vb = b.shortlistedCompanies?.length || 0;
      return sortDir === "asc" ? va - vb : vb - va;
    }
    const va = a.userId?.name?.toLowerCase() || "";
    const vb = b.userId?.name?.toLowerCase() || "";
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const hasFilter = placedFilter !== "all" || shortlistFilter !== "all" || !!search;

  return (
    <div style={{ padding: "24px 28px", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E2532", margin: 0 }}>Student Management</h1>
          <p style={{ fontSize: 13, color: "#8D9096", marginTop: 3 }}>Students synced from the placement portal</p>
        </div>
        <button className="pp-btn" onClick={handleSync} disabled={syncing} style={{ gap: 6 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? "Syncing…" : "Sync from Placement Portal"}
        </button>
      </div>

      {/* ── Sync result ── */}
      {syncResult && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", fontSize: 13, borderRadius: 2,
          background: syncResult.error ? "#FEF0ED" : "#EFF6F0",
          border: `1px solid ${syncResult.error ? "#F4C5B6" : "#B3D9BB"}`,
          color: syncResult.error ? "#C0300A" : "#1A6B2A",
        }}>
          {syncResult.error ? syncResult.error : (
            <>Sync done — {syncResult.total} students: {syncResult.created} created, {syncResult.updated} updated
              {syncResult.offCampus && (syncResult.offCampus.error
                ? ` · Off-campus sync failed (${syncResult.offCampus.error})`
                : ` · Off-campus: ${syncResult.offCampus.created} added, ${syncResult.offCampus.updated} updated`
              )}
            </>
          )}
        </div>
      )}

      {/* ── Main card ── */}
      <div className="pp-card">

        {/* Card toolbar */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #E9E9EB",
          display: "flex", flexWrap: "wrap", alignItems: "center",
          gap: 12, justifyContent: "space-between",
        }}>
          {/* Title + count */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1E2532" }}>All Students</span>
            <span style={{ fontSize: 13, color: "#8D9096" }}>
              {visible.length}{visible.length !== students.length ? ` / ${students.length}` : ""}
            </span>
          </div>

          {/* Search */}
          <div style={{ position: "relative", width: 260, flexShrink: 0 }}>
            <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#8D9096", pointerEvents: "none" }}
              width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email or roll…"
              style={{
                width: "100%", height: 30, paddingLeft: 28, paddingRight: search ? 28 : 10,
                fontSize: 13, border: "1px solid #DBDDE0", borderRadius: 2, outline: "none",
                fontFamily: "Inter, -apple-system, sans-serif", color: "#353B47", background: "#fff",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#14213D")}
              onBlur={e  => (e.target.style.borderColor = "#DBDDE0")}
            />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8D9096", padding: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid #E9E9EB",
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
            <div style={{ display: "flex", gap: 4 }}>
              <SegBtn active={placedFilter === "all"}        onClick={() => setPlacedFilter("all")}>All</SegBtn>
              <SegBtn active={placedFilter === "placed"}     onClick={() => setPlacedFilter("placed")}>Placed</SegBtn>
              <SegBtn active={placedFilter === "not_placed"} onClick={() => setPlacedFilter("not_placed")}>Not Placed</SegBtn>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: "0.06em" }}>Shortlisted</span>
            <div style={{ display: "flex", gap: 4 }}>
              <SegBtn active={shortlistFilter === "all"} onClick={() => setShortlistFilter("all")}>All</SegBtn>
              <SegBtn active={shortlistFilter === "yes"} onClick={() => setShortlistFilter("yes")}>Has shortlists</SegBtn>
              <SegBtn active={shortlistFilter === "no"}  onClick={() => setShortlistFilter("no")}>None</SegBtn>
            </div>
          </div>

          {hasFilter && (
            <button
              onClick={() => { setPlacedFilter("all"); setShortlistFilter("all"); setSearch(""); }}
              style={{ fontSize: 12, fontWeight: 600, color: "#D83B01", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>Loading…</div>
        ) : students.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>
            No students found. Sync from the placement portal to populate.
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>
            No students match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pp-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center" }}>#</th>
                  <SortTh label="Name"        col="name"        sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Email</th>
                  <SortTh label="Roll Number" col="roll"        sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Phone</th>
                  <SortTh label="Shortlisted" col="shortlisted" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((student, idx) => (
                  <tr
                    key={student._id}
                    style={{ cursor: student.rollNumber ? "pointer" : "default" }}
                    onClick={() => student.rollNumber && navigate(`/placement-stats/${student.rollNumber}`)}
                    title={student.rollNumber ? `View placement stats for ${student.userId?.name || student.rollNumber}` : undefined}
                  >
                    <td style={{ textAlign: "center", color: "#8D9096", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: "#1E2532" }}>{student.userId?.name || "—"}</td>
                    <td style={{ color: "#8D9096" }}>{student.userId?.emailId || "—"}</td>
                    <td style={{ fontFamily: "monospace", color: "#494D57" }}>{student.rollNumber || "—"}</td>
                    <td style={{ color: student.userId?.phoneNo ? "#494D57" : "#C8CAD0", fontStyle: student.userId?.phoneNo ? "normal" : "italic" }}>
                      {student.userId?.phoneNo || "not registered"}
                    </td>
                    <td style={{ color: "#494D57" }}>{student.shortlistedCompanies?.length || 0}</td>
                    <td>
                      {student.isPlaced ? (
                        <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB" }}>
                          Placed
                        </span>
                      ) : (
                        <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#F4F2F1", color: "#8D9096", border: "1px solid #E9E9EB" }}>
                          Not placed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
