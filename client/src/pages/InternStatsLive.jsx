import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function InternStatsLive() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ count: 0, placed_count: 0, unplaced_count: 0, generated_at: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [cpiMin, setCpiMin] = useState("");
  const [cpiMax, setCpiMax] = useState("");

  // "last fetched X seconds ago" ticker
  const [secondsAgo, setSecondsAgo] = useState(null);
  const tickRef = useRef(null);

  const startTicker = useCallback((generatedAt) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const base = new Date(generatedAt).getTime();
    const tick = () => setSecondsAgo(Math.floor((Date.now() - base) / 1000));
    tick();
    tickRef.current = setInterval(tick, 5000);
  }, []);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const fetchData = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/intern-stats" + (bustCache ? "?refresh=1" : ""));
      const { data = [], count = 0, placed_count = 0, unplaced_count = 0, generated_at = null } = res.data;
      setRows(data);
      setMeta({ count, placed_count, unplaced_count, generated_at });
      if (generated_at) startTicker(generated_at);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load live intern data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [startTicker]);

  useEffect(() => {
    if (user) {
      if (user.role !== "admin" && user.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }
      fetchData();
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
      fetchData();
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(() =>
    Array.from(new Set(rows.map(r => r.department).filter(Boolean))).sort(), [rows]);

  const companies = useMemo(() =>
    Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(row => {
      if (department && row.department !== department) return false;
      if (companyFilter && !(row.company || "").toLowerCase().includes(companyFilter.toLowerCase())) return false;
      if (cpiMin && (row.cpi == null || Number(row.cpi) < Number(cpiMin))) return false;
      if (cpiMax && (row.cpi == null || Number(row.cpi) > Number(cpiMax))) return false;
      if (!s) return true;
      return (
        (row.name || "").toLowerCase().includes(s) ||
        (row.iitgEmail || "").toLowerCase().includes(s) ||
        (row.rollNumber || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s) ||
        (row.company || "").toLowerCase().includes(s)
      );
    });
  }, [rows, search, department, companyFilter, cpiMin, cpiMax]);

  const resetFilters = () => {
    setSearch(""); setDepartment(""); setCompanyFilter(""); setCpiMin(""); setCpiMax("");
  };

  const freshnessBadge = () => {
    if (secondsAgo === null) return null;
    const label = secondsAgo < 60
      ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live data — last fetched {label}
      </span>
    );
  };

  return (
    <main className="px-6 py-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Intern Stats <span className="text-indigo-600">Live</span>
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            {loading ? "Loading..." : `Showing ${filteredRows.length} of ${rows.length} records`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {freshnessBadge()}
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students or companies…"
              className="w-72 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
            <div className="absolute left-3 top-3 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <FilterGroup label="Department" value={department} onChange={setDepartment} options={departments} />
          <FilterGroup label="Company" value={companyFilter} onChange={setCompanyFilter} options={companies} />
          <div className="flex flex-col">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">CPI Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={cpiMin}
                onChange={e => setCpiMin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                placeholder="Max"
                value={cpiMax}
                onChange={e => setCpiMax(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="flex items-end lg:col-span-2">
            <button
              onClick={resetFilters}
              className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary cards — from response meta, not filtered rows ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Total Students</div>
          <div className="text-2xl font-bold text-slate-900">{meta.count}</div>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-4">
          <div className="text-sm text-emerald-600">Got Intern</div>
          <div className="text-2xl font-bold text-emerald-700">{meta.placed_count}</div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <div className="text-sm text-amber-600">Not Placed</div>
          <div className="text-2xl font-bold text-amber-700">{meta.unplaced_count}</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium">Fetching live intern data…</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-rose-600 font-semibold mb-2">Could not load data</p>
            <p className="text-slate-500 text-sm">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Retry
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No records found for selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">#</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">IITG Email</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Roll</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">CPI</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Department</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Mobile</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Got Intern</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Slot / Spot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.rollNumber || idx}
                    onClick={() => navigate(`/intern-stats-live/${row.rollNumber}`)}
                    className="hover:bg-indigo-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.iitgEmail || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 font-mono">{row.rollNumber || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{row.name || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {typeof row.cpi === "number" ? row.cpi.toFixed(2) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.department || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.email || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.mobile || "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      {row.isGotIntern ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Yes</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.company || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.slotSpot || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
      >
        <option value="">All {label}s</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
