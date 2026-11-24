// src/pages/SchedulerCompanyView.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

const STAGE_COLORS = {
  SHORTLISTED: "bg-blue-100 text-blue-800",
  WAITLISTED:  "bg-yellow-100 text-yellow-800",
  R1: "bg-purple-100 text-purple-800",
  R2: "bg-purple-100 text-purple-800",
  R3: "bg-purple-100 text-purple-800",
  R4: "bg-purple-100 text-purple-800",
  OFFERED:  "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => navigate("/scheduler")}
        className="flex items-center text-slate-500 hover:text-slate-800 text-sm mb-5 transition-colors gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Companies
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-4 mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">{company?.name}</h1>
          {company?.venue && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {company.venue}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-sm">
          {saving ? (
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin inline-block" />
              Saving…
            </span>
          ) : savedOnce ? (
            <span className="text-emerald-600 flex items-center gap-1 font-medium text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          ) : null}
          <span className="text-slate-500 text-xs font-medium">{entries.length} students</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, email or roll number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter info bar */}
      {isFiltered && (
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{filtered.length}</span> of {entries.length} students —
            numbers show position in full list · drag still works
          </p>
        </div>
      )}

      {/* Hint when not filtered */}
      {!isFiltered && entries.length > 0 && !dragging && (
        <p className="text-xs text-slate-400 mb-3 px-1">
          Drag <span className="text-slate-500 font-medium">⠿</span> to reorder · saved automatically
        </p>
      )}

      {/* List */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-16 text-slate-400 text-sm">
          No students shortlisted for this company yet.
        </div>
      ) : (
        <div
          ref={listContainerRef}
          onDragOver={onContainerDragOver}
          onDrop={onDrop}
        >
          {filtered.map((entry, displayIdx) => {
            const isDraggingThis = dragIndex === displayIdx;
            const realPos = fullPositionMap.get(entry._id) ?? displayIdx + 1;
            const displayStage = entry.stage || entry.status?.toUpperCase() || "—";

            return (
              <React.Fragment key={entry._id}>
                {/* Drop-line BEFORE this row */}
                <div
                  className={[
                    "h-0.5 rounded-full mx-1 transition-all duration-100",
                    dropBefore === displayIdx && dragging && dragIndex !== displayIdx && dragIndex !== displayIdx - 1
                      ? "bg-blue-500 my-0.5"
                      : "bg-transparent my-0",
                  ].join(" ")}
                />

                {/* Row */}
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, displayIdx)}
                  onDragOver={(e) => onDragOver(e, displayIdx)}
                  onDragEnd={onDragEnd}
                  className={[
                    "group flex items-center gap-3 bg-white rounded-xl border px-3 py-3 select-none transition-all duration-100",
                    isDraggingThis
                      ? "opacity-30 scale-[0.98] border-blue-200 shadow-none"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
                    entry.isStudentPlaced ? "opacity-60" : "",
                  ].join(" ")}
                  style={{ cursor: "grab" }}
                >
                  {/* Drag handle */}
                  <div className="flex-shrink-0 text-slate-200 group-hover:text-slate-400 transition-colors pl-0.5" style={{ cursor: "grab" }}>
                    <GripIcon />
                  </div>

                  {/* Position number */}
                  <div
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                      isFiltered
                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                    title={isFiltered ? `Position ${realPos} in full list` : undefined}
                  >
                    {realPos}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {entry.student?.name?.charAt(0).toUpperCase() || "?"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                      {entry.student?.name || "—"}
                      {entry.student?.rollNumber && (
                        <span className="text-xs font-normal text-slate-400">{entry.student.rollNumber}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{entry.student?.email || "—"}</div>
                  </div>

                  {/* Phone */}
                  {entry.student?.phone && (
                    <div className="text-xs text-slate-400 hidden md:block flex-shrink-0">
                      {entry.student.phone}
                    </div>
                  )}

                  {/* Stage badge */}
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLORS[displayStage] || "bg-gray-100 text-gray-600"}`}>
                    {displayStage}
                  </span>

                  {/* Placed indicator */}
                  {entry.isStudentPlaced && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex-shrink-0 hidden sm:inline">
                      Placed{entry.studentPlacedCompany ? ` @ ${entry.studentPlacedCompany}` : ""}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* Drop-line AFTER last row */}
          <div
            className={[
              "h-0.5 rounded-full mx-1 transition-all duration-100",
              dropBefore === filtered.length && dragging && dragIndex !== filtered.length - 1
                ? "bg-blue-500 mt-0.5"
                : "bg-transparent",
            ].join(" ")}
          />
        </div>
      )}
    </div>
  );
}
