// src/pages/SchedulerCompanyView.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

const STAGE_STYLE = {
  SHORTLISTED: { background: "#EBF2FC", color: "#14213D", border: "1px solid #BDD3F0" },
  WAITLISTED:  { background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A" },
  R1: { background: "#F2EEF9", color: "#5B21B6", border: "1px solid #C4B5FD" },
  R2: { background: "#F2EEF9", color: "#5B21B6", border: "1px solid #C4B5FD" },
  R3: { background: "#F2EEF9", color: "#5B21B6", border: "1px solid #C4B5FD" },
  R4: { background: "#F2EEF9", color: "#5B21B6", border: "1px solid #C4B5FD" },
  OFFERED:  { background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB" },
  REJECTED: { background: "#FEF0ED", color: "#C0300A", border: "1px solid #F4C5B6" },
};

// GripVertical icon
const GripIcon = () => (
  <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="4" cy="4"  r="1.5" fill="currentColor"/>
    <circle cx="8" cy="4"  r="1.5" fill="currentColor"/>
    <circle cx="4" cy="10" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
    <circle cx="4" cy="16" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
  </svg>
);

// ── Merge-reorder helpers ────────────────────────────────────────────
// Reorder within full list (no filter active)
function reorderFull(entries, from, dropBefore) {
  if (from === dropBefore || from === dropBefore - 1) return entries;
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  const adjustedTo = from < dropBefore ? dropBefore - 1 : dropBefore;
  next.splice(adjustedTo, 0, moved);
  return next;
}

// Reorder within filtered subset, then merge positions back into full list.
// Non-filtered entries keep their relative positions; only filtered entries shift.
function reorderFiltered(entries, filtered, fromIdx, dropBefore) {
  if (fromIdx === dropBefore || fromIdx === dropBefore - 1) return entries;
  const newFiltered = [...filtered];
  const [moved] = newFiltered.splice(fromIdx, 1);
  const adjustedTo = fromIdx < dropBefore ? dropBefore - 1 : dropBefore;
  newFiltered.splice(adjustedTo, 0, moved);

  const filteredIds = new Set(filtered.map(e => e._id));
  let cur = 0;
  return entries.map(entry =>
    filteredIds.has(entry._id) ? newFiltered[cur++] : entry
  );
}

export default function SchedulerCompanyView() {
  const { companyId } = useParams();
  const navigate      = useNavigate();
  const [user, setUser]       = useState(() => getCachedUser());
  const [company, setCompany] = useState(null);
  const [entries, setEntries] = useState([]);     // full ordered list
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [search, setSearch]   = useState("");

  // Drag state
  const dragFromRef      = useRef(null);    // index in display list being dragged
  const [dragging, setDragging]         = useState(false);
  const [dragIndex, setDragIndex]       = useState(null);
  const [dropBefore, setDropBefore]     = useState(null); // insert BEFORE this display index

  // Auto-scroll during drag
  const listContainerRef  = useRef(null);
  const clientYRef        = useRef(0);
  const scrollRAFRef      = useRef(null);
  const isDraggingRef     = useRef(false);

  const findScrollContainer = () => {
    let el = listContainerRef.current?.parentElement;
    while (el) {
      const { overflowY } = window.getComputedStyle(el);
      if (overflowY === "auto" || overflowY === "scroll") return el;
      el = el.parentElement;
    }
    return document.documentElement;
  };

  const scrollTick = useCallback(() => {
    if (!isDraggingRef.current) return;
    const container = findScrollContainer();
    const rect = container.getBoundingClientRect
      ? container.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const y = clientYRef.current;
    const ZONE = 100;
    const distTop    = y - rect.top;
    const distBottom = rect.bottom - y;
    if (distTop < ZONE && distTop >= 0)      container.scrollTop -= Math.ceil((ZONE - distTop)    / 8);
    else if (distBottom < ZONE && distBottom >= 0) container.scrollTop += Math.ceil((ZONE - distBottom) / 8);
    scrollRAFRef.current = requestAnimationFrame(scrollTick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDocDragOver = useCallback((e) => {
    clientYRef.current = e.clientY;
  }, []);

  const startAutoScroll = useCallback(() => {
    isDraggingRef.current = true;
    document.addEventListener("dragover", handleDocDragOver);
    scrollRAFRef.current = requestAnimationFrame(scrollTick);
  }, [handleDocDragOver, scrollTick]);

  const stopAutoScroll = useCallback(() => {
    isDraggingRef.current = false;
    cancelAnimationFrame(scrollRAFRef.current);
    document.removeEventListener("dragover", handleDocDragOver);
  }, [handleDocDragOver]);

  // Cleanup on unmount
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  // ── Auth & fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (user) { fetchData(); return; }
    api.get("/users/me")
      .then(res => { setCachedUser(res.data.user); setUser(res.data.user); })
      .catch(() => { clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/scheduler/companies/${companyId}/shortlist`);
      setCompany(res.data.company);
      setEntries(res.data.entries || []);
    } catch (err) {
      if (err.response?.status === 404) { toast.error("Company not found"); navigate("/scheduler"); }
      else toast.error("Failed to load shortlist");
    } finally {
      setLoading(false);
    }
  };

  // ── Persist order ─────────────────────────────────────────────────
  const saveOrder = useCallback(async (newEntries) => {
    setSaving(true);
    try {
      await api.patch(`/scheduler/companies/${companyId}/reorder`, {
        order: newEntries.map(e => e._id),
      });
      setSavedOnce(true);
    } catch {
      toast.error("Failed to save order — refreshing");
      fetchData();
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ── Filter ────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q
    ? entries.filter(e =>
        e.student?.name?.toLowerCase().includes(q) ||
        e.student?.email?.toLowerCase().includes(q) ||
        (e.student?.rollNumber || "").toLowerCase().includes(q)
      )
    : entries;
  const isFiltered = q.length > 0;

  // Real position in the full list (1-indexed)
  const fullPositionMap = new Map(entries.map((e, i) => [e._id, i + 1]));

  // ── HTML5 drag handlers (work in both filtered and unfiltered) ────
  const onDragStart = (e, displayIdx) => {
    dragFromRef.current = displayIdx;
    clientYRef.current = e.clientY;
    setDragIndex(displayIdx);
    setDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(displayIdx));
    startAutoScroll();
  };

  const onDragOver = (e, displayIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setDropBefore(isTopHalf ? displayIdx : displayIdx + 1);
  };

  // Container drag-over: handles the case where cursor is between rows
  const onContainerDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e) => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from === null || dropBefore === null) { resetDrag(); return; }

    const newEntries = isFiltered
      ? reorderFiltered(entries, filtered, from, dropBefore)
      : reorderFull(entries, from, dropBefore);

    if (newEntries !== entries) {
      setEntries(newEntries);
      saveOrder(newEntries);
    }
    resetDrag();
  };

  const onDragEnd = () => resetDrag();

  const resetDrag = () => {
    stopAutoScroll();
    dragFromRef.current = null;
    setDragging(false);
    setDragIndex(null);
    setDropBefore(null);
  };

  // ── Render ────────────────────────────────────────────────────────
  if (!user || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #E9E9EB", borderTopColor: "#14213D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* Back link */}
      <button
        onClick={() => navigate("/scheduler")}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "#8D9096", fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: "inherit" }}
        onMouseOver={e => (e.currentTarget.style.color = "#353B47")}
        onMouseOut={e  => (e.currentTarget.style.color = "#8D9096")}
      >
        ‹ All Companies
      </button>

      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E2532", margin: 0 }}>{company?.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          {company?.venue && (
            <span style={{ fontSize: 13, color: "#8D9096" }}>📍 {company.venue}</span>
          )}
          <span style={{ fontSize: 13, color: "#8D9096" }}>{entries.length} students</span>
          {saving && <span style={{ fontSize: 12, color: "#8D9096" }}>Saving…</span>}
          {!saving && savedOnce && <span style={{ fontSize: 12, color: "#1A6B2A", fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Card */}
      <div className="pp-card">

        {/* Toolbar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E9E9EB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E2532" }}>Shortlist</span>
            {isFiltered && (
              <span style={{ fontSize: 12, color: "#8D9096" }}>
                {filtered.length} / {entries.length} · positions shown from full list · drag works
              </span>
            )}
            {!isFiltered && entries.length > 0 && !dragging && (
              <span style={{ fontSize: 12, color: "#8D9096" }}>drag ⠿ to reorder · auto-saved</span>
            )}
          </div>

          {/* Search */}
          <div style={{ position: "relative", width: 280 }}>
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
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8D9096", padding: 0, fontSize: 12 }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table header */}
        {entries.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "36px 36px 1fr 110px 100px 90px",
            padding: "8px 16px", background: "#EDEEF0", borderBottom: "2px solid #E9E9EB",
            fontSize: 11, fontWeight: 700, color: "#1E2532", textTransform: "uppercase", letterSpacing: "0.06em",
            userSelect: "none",
          }}>
            <div></div>
            <div style={{ textAlign: "center" }}>#</div>
            <div>Student</div>
            <div>Roll No.</div>
            <div>Stage</div>
            <div>Status</div>
          </div>
        )}

        {/* Rows */}
        {entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>
            No students shortlisted for this company yet.
          </div>
        ) : (
          <div ref={listContainerRef} onDragOver={onContainerDragOver} onDrop={onDrop}>
            {filtered.map((entry, displayIdx) => {
              const isDraggingThis = dragIndex === displayIdx;
              const realPos = fullPositionMap.get(entry._id) ?? displayIdx + 1;
              const displayStage = entry.stage || entry.status?.toUpperCase() || "—";
              const stageStyle = STAGE_STYLE[displayStage] || { background: "#F4F2F1", color: "#8D9096", border: "1px solid #E9E9EB" };
              const showDropLine = dropBefore === displayIdx && dragging && dragIndex !== displayIdx && dragIndex !== displayIdx - 1;

              return (
                <React.Fragment key={entry._id}>
                  {/* Drop indicator line BEFORE row */}
                  <div style={{ height: showDropLine ? 2 : 0, background: "#14213D", margin: showDropLine ? "1px 0" : 0, transition: "height 0.08s, margin 0.08s" }} />

                  {/* Row */}
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, displayIdx)}
                    onDragOver={(e) => onDragOver(e, displayIdx)}
                    onDragEnd={onDragEnd}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 36px 1fr 110px 100px 90px",
                      alignItems: "center",
                      padding: "0 16px",
                      height: 44,
                      borderBottom: "1px solid #E9E9EB",
                      background: isDraggingThis ? "#F4F2F1" : entry.isStudentPlaced ? "#FAFFF8" : "#fff",
                      opacity: isDraggingThis ? 0.4 : 1,
                      cursor: "grab",
                      userSelect: "none",
                      transition: "background 0.1s, opacity 0.1s",
                      fontSize: 13,
                    }}
                    onMouseOver={e => { if (!isDraggingThis) e.currentTarget.style.background = "#F5F8FD"; }}
                    onMouseOut={e  => { e.currentTarget.style.background = isDraggingThis ? "#F4F2F1" : entry.isStudentPlaced ? "#FAFFF8" : "#fff"; }}
                  >
                    {/* Grip */}
                    <div style={{ color: "#DBDDE0", display: "flex", alignItems: "center" }}
                      onMouseOver={e => (e.currentTarget.style.color = "#8D9096")}
                      onMouseOut={e  => (e.currentTarget.style.color = "#DBDDE0")}
                    >
                      <GripIcon />
                    </div>

                    {/* Position */}
                    <div style={{
                      textAlign: "center", fontSize: 12, fontWeight: 700,
                      color: isFiltered ? "#7B5700" : "#8D9096",
                    }}
                      title={isFiltered ? `Position ${realPos} in full list` : undefined}
                    >
                      {realPos}
                    </div>

                    {/* Name + email */}
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, color: "#1E2532", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.student?.name || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#8D9096", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.student?.email || "—"}
                      </div>
                    </div>

                    {/* Roll */}
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#494D57" }}>
                      {entry.student?.rollNumber || "—"}
                    </div>

                    {/* Stage badge */}
                    <div>
                      <span style={{ padding: "2px 7px", fontSize: 11, fontWeight: 600, borderRadius: 2, ...stageStyle }}>
                        {displayStage}
                      </span>
                    </div>

                    {/* Placed */}
                    <div>
                      {entry.isStudentPlaced && (
                        <span style={{ padding: "2px 7px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB" }}>
                          Placed
                        </span>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Drop indicator line AFTER last row */}
            {(() => {
              const show = dropBefore === filtered.length && dragging && dragIndex !== filtered.length - 1;
              return <div style={{ height: show ? 2 : 0, background: "#14213D", margin: show ? "1px 0" : 0, transition: "height 0.08s" }} />;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
