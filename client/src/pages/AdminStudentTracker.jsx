// src/pages/AdminStudentTracker.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";
import { useSocket } from "../context/SocketContext";

function timeSince(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

function ForceConfirm({ student, onConfirm, onCancel, forcing }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="pp-card" style={{ width: 380, padding: 24, fontFamily: "Inter, -apple-system, sans-serif" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#1E2532", margin: "0 0 8px" }}>Force Release</p>
        <p style={{ fontSize: 13, color: "#353B47", margin: "0 0 20px", lineHeight: 1.5 }}>
          Force-free <strong>{student.studentId?.name || student.rollNumber || "this student"}</strong> from{" "}
          <strong>{student.companyName}</strong>?<br />
          <span style={{ color: "#8D9096", fontSize: 12 }}>
            The POC at that company will not be notified — their dashboard will update automatically via socket.
          </span>
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="pp-btn2" onClick={onCancel} disabled={forcing}>Cancel</button>
          <button
            className="pp-btn"
            onClick={onConfirm}
            disabled={forcing}
            style={{ background: "#C0300A", borderColor: "#C0300A" }}
          >
            {forcing ? "Releasing…" : "Force Free"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentTracker() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(() => getCachedUser());

  // presenceList: flat array of StudentPresence docs (enriched with student name/roll)
  const [presenceList, setPresenceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBusy, setFilterBusy] = useState(true); // default: show only busy

  const [confirmTarget, setConfirmTarget] = useState(null); // presence doc to force-free
  const [forcing, setForcing] = useState(false);

  // Tick state for "X ago" refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user); setUser(res.data.user);
    }).catch(() => { clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]); // eslint-disable-line

  const fetchPresence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/presence");
      setPresenceList(res.data.presence || []);
    } catch (err) {
      console.error("Error fetching presence:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPresence(); }, [fetchPresence]);

  // Socket — join presence:admin room, merge live deltas, resync on reconnect
  useEffect(() => {
    if (!socket) return;

    socket.emit("join:presence-admin");

    socket.on("connect", () => {
      socket.emit("join:presence-admin");
      fetchPresence(); // Resync on reconnect — never miss events that arrived while disconnected
    });

    socket.on("student:presence", (data) => {
      if (!data?.studentId || !data?.presence) return;
      setPresenceList(prev => {
        const idx = prev.findIndex(p => p.studentId?._id?.toString() === data.studentId || p.studentId?.toString() === data.studentId);
        if (idx === -1) {
          // New record — append and trigger a full refresh to get enriched data
          fetchPresence();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          ...data.presence,
          studentId: updated[idx].studentId, // keep populated student object
          companyId: updated[idx].companyId,  // keep populated company object
        };
        return updated;
      });
    });

    return () => {
      socket.off("connect");
      socket.off("student:presence");
    };
  }, [socket, fetchPresence]);

  const handleForceFree = async () => {
    if (!confirmTarget) return;
    const studentUserId = confirmTarget.studentId?._id?.toString() || confirmTarget.studentId?.toString();
    setForcing(true);
    try {
      await api.post(`/admin/presence/${studentUserId}/force-free`);
      // Socket will push the update back; also update local list optimistically
      setPresenceList(prev => prev.map(p =>
        (p.studentId?._id?.toString() === studentUserId || p.studentId?.toString() === studentUserId)
          ? { ...p, status: "free", companyId: null, companyName: null, venue: null, round: null, enteredAt: null }
          : p
      ));
      setConfirmTarget(null);
    } catch (err) {
      console.error("Force free error:", err);
    } finally {
      setForcing(false);
    }
  };

  // ── Derived display list ──────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const visible = presenceList.filter(p => {
    if (filterBusy && p.status !== "busy") return false;
    if (!q) return true;
    const name = (p.studentId?.name || "").toLowerCase();
    const roll = (p.rollNumber || "").toLowerCase();
    const company = (p.companyName || "").toLowerCase();
    return name.includes(q) || roll.includes(q) || company.includes(q);
  });

  const busyCount = presenceList.filter(p => p.status === "busy").length;

  return (
    <div style={{ padding: "24px 28px", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E2532", margin: 0 }}>Student Tracker</h1>
          <p style={{ fontSize: 13, color: "#8D9096", marginTop: 3 }}>
            Live view of student interview presence across all companies
          </p>
        </div>
        <button className="pp-btn2" onClick={fetchPresence} disabled={loading} style={{ gap: 6, fontSize: 13 }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Summary chips ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ padding: "6px 14px", borderRadius: 2, background: "#FFF8E6", border: "1px solid #F5D87A", fontSize: 13, fontWeight: 700, color: "#7B5700" }}>
          {busyCount} In Interview
        </div>
        <div style={{ padding: "6px 14px", borderRadius: 2, background: "#EFF6F0", border: "1px solid #B3D9BB", fontSize: 13, fontWeight: 700, color: "#1A6B2A" }}>
          {presenceList.filter(p => p.status === "free").length} Free
        </div>
        <div style={{ padding: "6px 14px", borderRadius: 2, background: "#F4F2F1", border: "1px solid #E9E9EB", fontSize: 13, fontWeight: 600, color: "#8D9096" }}>
          {presenceList.length} tracked
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="pp-card">
        {/* Toolbar */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #E9E9EB",
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between",
        }}>
          {/* Search */}
          <div style={{ position: "relative", width: 280, flexShrink: 0 }}>
            <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#8D9096", pointerEvents: "none" }}
              width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, roll, company…"
              style={{
                width: "100%", height: 30, paddingLeft: 28, paddingRight: search ? 28 : 10,
                fontSize: 13, border: "1px solid #DBDDE0", borderRadius: 2, outline: "none",
                fontFamily: "Inter, -apple-system, sans-serif", color: "#353B47", background: "#fff", boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#14213D")}
              onBlur={e  => (e.target.style.borderColor = "#DBDDE0")}
            />
            {search && (
              <button onClick={() => setSearch("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8D9096", padding: 0 }}>
                ✕
              </button>
            )}
          </div>

          {/* Busy-only toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <label style={{ color: "#353B47", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={filterBusy}
                onChange={e => setFilterBusy(e.target.checked)}
                style={{ accentColor: "#14213D", width: 14, height: 14 }}
              />
              Show busy only
            </label>
            <span style={{ color: "#8D9096", fontSize: 12 }}>
              {visible.length} shown
            </span>
          </div>
        </div>

        {/* Table */}
        {loading && presenceList.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>
            {filterBusy ? "No students currently in an interview." : "No presence records yet."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pp-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Roll</th>
                  <th>Status</th>
                  <th>Company</th>
                  <th>Venue</th>
                  <th>Round</th>
                  <th>Since</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p, idx) => {
                  const isBusy = p.status === "busy";
                  return (
                    <tr key={p._id || idx}>
                      <td style={{ textAlign: "center", color: "#8D9096", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: "#1E2532" }}>
                        {p.studentId?.name || <span style={{ color: "#C8CAD0", fontStyle: "italic", fontSize: 12 }}>unknown</span>}
                      </td>
                      <td style={{ fontFamily: "monospace", color: "#494D57", fontSize: 12 }}>
                        {p.rollNumber || "—"}
                      </td>
                      <td>
                        {isBusy ? (
                          <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A" }}>
                            In Interview
                          </span>
                        ) : (
                          <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB" }}>
                            Free
                          </span>
                        )}
                      </td>
                      <td style={{ color: "#353B47", fontWeight: isBusy ? 600 : 400 }}>
                        {p.companyName || <span style={{ color: "#C8CAD0" }}>—</span>}
                      </td>
                      <td style={{ color: "#8D9096", fontSize: 12 }}>
                        {p.venue || <span style={{ color: "#C8CAD0" }}>—</span>}
                      </td>
                      <td>
                        {p.round ? (
                          <span style={{ padding: "1px 7px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#EEE9F8", color: "#6B3FA0", border: "1px solid #D4C5F0" }}>
                            {p.round}
                          </span>
                        ) : <span style={{ color: "#C8CAD0" }}>—</span>}
                      </td>
                      <td style={{ color: "#8D9096", fontSize: 12, whiteSpace: "nowrap" }}>
                        {isBusy ? timeSince(p.enteredAt) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isBusy && (
                          <button
                            onClick={() => setConfirmTarget(p)}
                            style={{
                              height: 26, padding: "0 10px", fontSize: 12, fontWeight: 600,
                              borderRadius: 2, border: "1px solid #F4C5B6", background: "#FEF0ED",
                              color: "#C0300A", cursor: "pointer",
                            }}
                          >
                            Force Free
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Force-free confirmation modal ── */}
      {confirmTarget && (
        <ForceConfirm
          student={confirmTarget}
          onConfirm={handleForceFree}
          onCancel={() => setConfirmTarget(null)}
          forcing={forcing}
        />
      )}
    </div>
  );
}
