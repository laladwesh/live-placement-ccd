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

export default function SchedulerCompanyView() {
  const { companyId } = useParams();
  const navigate      = useNavigate();
  const [user, setUser]       = useState(() => getCachedUser());
  const [company, setCompany] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState("");

  // Drag state — stored in refs to avoid re-renders mid-drag
  const dragIndexRef  = useRef(null);
  const overIndexRef  = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);   // for visual highlight only
  const [overIndex, setOverIndex] = useState(null);

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

  // ── Save order to backend ──────────────────────────────────────
  const saveOrder = useCallback(async (newEntries) => {
    setSaving(true);
    try {
      await api.patch(`/scheduler/companies/${companyId}/reorder`, {
        order: newEntries.map(e => e._id),
      });
    } catch (err) {
      toast.error("Failed to save order — try again");
      // Refetch to restore server state
      fetchData();
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ── HTML5 drag handlers ────────────────────────────────────────
  const onDragStart = (e, index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Needed for Firefox
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onDragEnter = (index) => {
    if (dragIndexRef.current === index) return;
    overIndexRef.current = index;
    setOverIndex(index);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e, dropIndex) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) return;

    setEntries(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      // Persist asynchronously — don't wait
      saveOrder(next);
      return next;
    });
  };

  const onDragEnd = () => {
    dragIndexRef.current = null;
    overIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  // ── Filter ────────────────────────────────────────────────────
  const filtered = entries.filter(e =>
    !search ||
    e.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.student?.email?.toLowerCase().includes(search.toLowerCase()) ||
    (e.student?.rollNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  // When searching we show filtered but drag only makes sense on the full list
  const isFiltered = search.trim().length > 0;

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <button
        onClick={() => navigate("/scheduler")}
        className="flex items-center text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Companies
      </button>

      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{company?.name}</h1>
            {company?.venue && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {company.venue}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            {saving && (
              <span className="text-slate-400 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Saving…
              </span>
            )}
            {!saving && entries.length > 0 && (
              <span className="text-green-600 text-xs font-medium">Order saved</span>
            )}
            <span className="text-slate-500">{entries.length} students</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, email or roll number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isFiltered && (
        <p className="text-xs text-slate-400 mb-3">
          Showing {filtered.length} of {entries.length} — drag-to-reorder is disabled while searching
        </p>
      )}

      {/* Student list */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 text-center py-16 text-slate-400 text-sm">
          No students shortlisted for this company.
        </div>
      ) : (
        <div className="space-y-1">
          {(isFiltered ? filtered : entries).map((entry, index) => {
            const isDragging = dragIndex === index;
            const isOver     = overIndex === index && dragIndex !== null && dragIndex !== index;
            const displayStage = entry.stage || entry.status?.toUpperCase() || "—";

            return (
              <div
                key={entry._id}
                draggable={!isFiltered}
                onDragStart={!isFiltered ? (e) => onDragStart(e, index) : undefined}
                onDragEnter={!isFiltered ? () => onDragEnter(index) : undefined}
                onDragOver={!isFiltered ? onDragOver : undefined}
                onDrop={!isFiltered ? (e) => onDrop(e, index) : undefined}
                onDragEnd={!isFiltered ? onDragEnd : undefined}
                className={[
                  "bg-white rounded-lg border flex items-center gap-3 px-4 py-3 select-none transition-all",
                  isDragging ? "opacity-40 border-blue-300 shadow-inner" : "border-slate-200",
                  isOver     ? "border-blue-500 shadow-md" : "",
                  !isFiltered ? "cursor-grab active:cursor-grabbing" : "",
                  entry.isStudentPlaced ? "bg-slate-50" : "",
                ].join(" ")}
              >
                {/* Drag handle */}
                {!isFiltered && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0 text-slate-300">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      <span className="w-1 h-1 rounded-full bg-current" />
                    </div>
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      <span className="w-1 h-1 rounded-full bg-current" />
                    </div>
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-current" />
                      <span className="w-1 h-1 rounded-full bg-current" />
                    </div>
                  </div>
                )}

                {/* Position number */}
                <div className="w-6 text-center text-xs font-mono text-slate-400 flex-shrink-0">
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center flex-shrink-0">
                  {entry.student?.name?.charAt(0).toUpperCase() || "?"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate text-sm">
                    {entry.student?.name || "—"}
                    {entry.student?.rollNumber && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {entry.student.rollNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{entry.student?.email || "—"}</div>
                </div>

                {/* Phone */}
                {entry.student?.phone && (
                  <div className="text-xs text-slate-500 hidden sm:block flex-shrink-0">
                    {entry.student.phone}
                  </div>
                )}

                {/* Stage badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STAGE_COLORS[displayStage] || "bg-gray-100 text-gray-700"}`}>
                  {displayStage}
                </span>

                {/* Placed indicator */}
                {entry.isStudentPlaced && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium flex-shrink-0">
                    Placed
                    {entry.studentPlacedCompany ? ` @ ${entry.studentPlacedCompany}` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isFiltered && entries.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-4">
          Drag rows to reorder · changes are saved automatically
        </p>
      )}
    </div>
  );
}
