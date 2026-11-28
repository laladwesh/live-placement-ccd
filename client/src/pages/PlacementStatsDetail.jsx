import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

const STAGE_LABELS = {
  applied:        "Applied",
  oa_appeared:    "OA Appeared",
  oa_shortlisted: "OA Shortlisted",
  interview_call: "Interview Call",
  offered:        "Offered",
  placed:         "Placed",
};

const STAGE_COLORS = {
  applied:        "bg-slate-100 text-slate-700",
  oa_appeared:    "bg-blue-100 text-blue-700",
  oa_shortlisted: "bg-indigo-100 text-indigo-700",
  interview_call: "bg-amber-100 text-amber-700",
  offered:        "bg-emerald-100 text-emerald-700",
  placed:         "bg-emerald-200 text-emerald-800",
};

function Check({ value }) {
  return value ? (
    <span className="text-emerald-600 font-bold text-base">✓</span>
  ) : (
    <span className="text-slate-300 font-bold text-base">✗</span>
  );
}

function StageBadge({ stage }) {
  const cls = STAGE_COLORS[stage] || "bg-slate-100 text-slate-500";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</div>
      <div className="text-slate-800 font-medium break-all">{value || "—"}</div>
    </div>
  );
}

function FunnelTile({ label, value, color }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
      <div className={`text-2xl font-extrabold ${color}`}>{value ?? "—"}</div>
      <div className="text-xs text-slate-500 mt-1 font-medium">{label}</div>
    </div>
  );
}

const FILTER_OPTIONS = [
  { key: "applied",        label: "Applied",         cls: "bg-slate-100 text-slate-700 border-slate-300",       activeCls: "bg-slate-700 text-white border-slate-700"       },
  { key: "oa_appeared",    label: "OA Appeared",     cls: "bg-blue-50 text-blue-700 border-blue-200",           activeCls: "bg-blue-600 text-white border-blue-600"         },
  { key: "oa_shortlisted", label: "OA Shortlisted",  cls: "bg-indigo-50 text-indigo-700 border-indigo-200",     activeCls: "bg-indigo-600 text-white border-indigo-600"     },
  { key: "interview_call", label: "Interview Call",  cls: "bg-amber-50 text-amber-700 border-amber-200",        activeCls: "bg-amber-500 text-white border-amber-500"       },
  { key: "offered",        label: "Offered",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200",  activeCls: "bg-emerald-600 text-white border-emerald-600"   },
  { key: "placed",         label: "Placed",          cls: "bg-emerald-50 text-emerald-800 border-emerald-300",  activeCls: "bg-emerald-700 text-white border-emerald-700"   },
];

function stageMatch(entry, key) {
  if (key === "placed") return !!entry.is_placed_here;
  return !!entry.stages?.[key];
}

export default function PlacementStatsDetail() {
  const { rollNumber } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilters, setActiveFilters] = useState(new Set());

  const toggleFilter = (key) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/placement-stats/${encodeURIComponent(rollNumber)}`);
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load placement details";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.role !== "admin" && user.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }
      fetchDetail();
      return;
    }
    api.get("/users/me").then(res => {
      const me = res.data.user;
      setCachedUser(me);
      setUser(me);
      if (me.role !== "admin" && me.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }
      fetchDetail();
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollNumber]);

  return (
    <main className="px-6 py-6 max-w-6xl mx-auto">
      <button
        onClick={() => navigate("/admin/students")}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        ← Back to Students
      </button>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading placement details…</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-rose-600 font-semibold mb-2">Could not load details</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <button
            onClick={fetchDetail}
            className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* ── Student header card ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {data.student.profile_pic ? (
                  <img
                    src={data.student.profile_pic}
                    alt={data.student.name}
                    className="w-16 h-16 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    // Falls back to the initial-letter avatar if the URL 404s/doesn't load —
                    // the local-DB fallback path has no photo source at all, so this is the
                    // normal state whenever upstream (main portal) data isn't being used.
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  />
                ) : null}
                <div
                  className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 font-bold text-xl items-center justify-center flex-shrink-0"
                  style={{ display: data.student.profile_pic ? "none" : "flex" }}
                >
                  {(data.student.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">{data.student.name}</h1>
                  <p className="text-slate-500 mt-0.5 font-mono text-sm">{data.student.rollNumber}</p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${data.student.isPlaced ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {data.student.isPlaced ? "Placed" : "Not Placed Yet"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Department" value={data.student.department} />
              <InfoItem label="Programme" value={data.student.programme} />
              <InfoItem label="CPI" value={data.student.cpi != null ? Number(data.student.cpi).toFixed(2) : "—"} />
              <InfoItem label="IITG Email" value={data.student.iitgEmail} />
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Mobile" value={data.student.mobile} />
              <InfoItem label="Discipline" value={data.student.discipline} />
            </div>
          </div>

          {/* ── Final offer card ── */}
          {data.final_offer && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-3">
                Final Offer
                {data.final_offer.is_off_campus && (
                  <span className="ml-2 text-xs font-semibold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">Off-Campus</span>
                )}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <InfoItem label="Company" value={data.final_offer.company} />
                <InfoItem label="Role / Slot" value={data.final_offer.role || data.final_offer.slot} />
                <InfoItem label="Approved At" value={data.final_offer.approved_at ? new Date(data.final_offer.approved_at).toLocaleString() : "—"} />
              </div>
            </div>
          )}

          {/* ── Funnel totals ── */}
          {data.totals && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Placement Funnel</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <FunnelTile label="Applications"    value={data.totals.applications}    color="text-slate-900" />
                <FunnelTile label="OA Shortlisted"  value={data.totals.oa_shortlisted}  color="text-blue-700" />
                <FunnelTile label="OA Appeared"     value={data.totals.oa_appeared}     color="text-indigo-700" />
                <FunnelTile label="Interview Calls" value={data.totals.interview_calls} color="text-amber-700" />
                <FunnelTile label="Offers"          value={data.totals.offers}          color="text-orange-600" />
                <FunnelTile label="Placed"          value={data.totals.placed}          color="text-emerald-700" />
              </div>
            </div>
          )}

          {/* ── Trail table ── */}
          {data.trail && data.trail.length > 0 && (() => {
            const filteredTrail = activeFilters.size === 0
              ? data.trail
              : data.trail.filter(e => [...activeFilters].some(k => stageMatch(e, k)));
            return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Application Trail —{" "}
                  <span className="text-slate-700">
                    {filteredTrail.length}
                    {activeFilters.size > 0 && <span className="text-slate-400"> / {data.trail.length}</span>}
                  </span>{" "}
                  {filteredTrail.length === 1 ? "company" : "companies"}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_OPTIONS.map(({ key, label }) => {
                    const isActive = activeFilters.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleFilter(key)}
                        style={{
                          height: 26, padding: "0 10px", fontSize: 12, fontWeight: 600,
                          borderRadius: 2, cursor: "pointer", fontFamily: "Inter, -apple-system, sans-serif",
                          border: isActive ? "1px solid #14213D" : "1px solid #DBDDE0",
                          background: isActive ? "#14213D" : "#fff",
                          color: isActive ? "#fff" : "#353B47",
                          transition: "all 0.12s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {activeFilters.size > 0 && (
                    <button
                      onClick={() => setActiveFilters(new Set())}
                      style={{ height: 26, padding: "0 10px", fontSize: 12, fontWeight: 600, borderRadius: 2, cursor: "pointer", fontFamily: "Inter, -apple-system, sans-serif", border: "1px solid #F4C5B6", background: "#FEF0ED", color: "#C0300A" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Designation</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Applied</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">OA Appeared</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">OA Shortlisted</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Interview Call</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Offered</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Current Stage</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-indigo-500">DDay Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTrail.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-10 text-center text-slate-400 text-sm">
                          No companies match the selected filters.
                        </td>
                      </tr>
                    ) : filteredTrail.map((entry, idx) => (
                      <tr
                        key={entry.job_id || idx}
                        className={`hover:bg-slate-50/80 transition-colors ${entry.is_placed_here ? "bg-emerald-50/40" : ""}`}
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                          {entry.company}
                          {entry.is_placed_here && (
                            <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">PLACED</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{entry.designation || "—"}</td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages?.applied} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages?.oa_appeared} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages?.oa_shortlisted} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages?.interview_call} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages?.offered} /></td>
                        <td className="px-5 py-3.5"><StageBadge stage={entry.current_stage} /></td>
                        <td className="px-5 py-3.5">
                          {entry.dday_status === "shortlisted" && (
                            <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#EBF2FC", color: "#14213D", border: "1px solid #BDD3F0" }}>
                              Shortlisted
                            </span>
                          )}
                          {entry.dday_status === "waitlisted" && (
                            <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A" }}>
                              Waitlisted
                            </span>
                          )}
                          {!entry.dday_status && (
                            <span style={{ color: "#C8CAD0", fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}

          {data.trail && data.trail.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-500">
              No application trail for this student yet.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
