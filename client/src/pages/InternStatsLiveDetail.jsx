import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

const STAGE_LABELS = {
  registered: "Registered",
  oa_appeared: "OA Appeared",
  oa_shortlisted: "OA Shortlisted",
  interview_call: "Interview Call",
  selected: "Selected",
  none: "None",
};

const STAGE_COLORS = {
  registered: "bg-slate-100 text-slate-700",
  oa_appeared: "bg-blue-100 text-blue-700",
  oa_shortlisted: "bg-indigo-100 text-indigo-700",
  interview_call: "bg-amber-100 text-amber-700",
  selected: "bg-emerald-100 text-emerald-700",
  none: "bg-slate-100 text-slate-400",
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

export default function InternStatsLiveDetail() {
  const { rollNumber } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/intern-stats/${encodeURIComponent(rollNumber)}`);
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load student details";
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
        onClick={() => navigate("/intern-stats-live")}
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        ← Back to Intern Stats Live
      </button>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading student details…</p>
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
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">{data.student.name}</h1>
                <p className="text-slate-500 mt-0.5 font-mono text-sm">{data.student.rollNumber}</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${data.student.isGotIntern ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {data.student.isGotIntern ? "Got Intern" : "No Intern Yet"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Department" value={data.student.department} />
              <InfoItem label="CPI" value={data.student.cpi != null ? Number(data.student.cpi).toFixed(2) : "—"} />
              <InfoItem label="IITG Email" value={data.student.iitgEmail} />
              <InfoItem label="Mobile" value={data.student.mobile} />
            </div>
          </div>

          {/* ── Final offer card (conditional) ── */}
          {data.final_offer && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-3">Final Offer</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <InfoItem label="Company" value={data.final_offer.company} />
                <InfoItem label="Slot" value={data.final_offer.slot} />
                <InfoItem label="Approved At" value={new Date(data.final_offer.approved_at).toLocaleString()} />
              </div>
            </div>
          )}

          {/* ── Funnel totals ── */}
          {data.totals && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Season Funnel</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <FunnelTile label="Applications" value={data.totals.applications} color="text-slate-900" />
                <FunnelTile label="OA Appeared" value={data.totals.oa_appeared} color="text-blue-700" />
                <FunnelTile label="OA Shortlisted" value={data.totals.oa_shortlisted} color="text-indigo-700" />
                <FunnelTile label="Interview Calls" value={data.totals.interview_calls} color="text-amber-700" />
                <FunnelTile label="Final Selections" value={data.totals.final_selections} color="text-emerald-700" />
              </div>
            </div>
          )}

          {/* ── Trail table ── */}
          {data.trail && data.trail.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Shortlist Trail — {data.trail.length} {data.trail.length === 1 ? "company" : "companies"}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Designation</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Registered</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">OA Appeared</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">OA Shortlisted</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Interview Call</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Selected</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Current Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.trail.map((entry) => (
                      <tr key={entry.job_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{entry.company}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{entry.job_designation}</td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages.registered} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages.oa_appeared} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages.oa_shortlisted} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages.interview_call} /></td>
                        <td className="px-5 py-3.5 text-center"><Check value={entry.stages.selected} /></td>
                        <td className="px-5 py-3.5"><StageBadge stage={entry.current_stage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.trail && data.trail.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center text-slate-500">
              No trail entries for this student yet.
            </div>
          )}
        </div>
      )}
    </main>
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
