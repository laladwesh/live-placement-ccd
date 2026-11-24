// src/pages/SchedulerCompanies.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function SchedulerCompanies() {
  const navigate = useNavigate();
  const [user, setUser]         = useState(() => getCachedUser());
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    if (user) { fetchCompanies(); return; }
    api.get("/users/me")
      .then(res => { setCachedUser(res.data.user); setUser(res.data.user); })
      .catch(() => { clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/scheduler/companies");
      setCompanies(res.data.companies || []);
    } catch (err) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.venue || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Interview Scheduler</h1>
        <p className="text-sm text-slate-500 mt-1">
          Drag students within a company to set your interview call order. Order is saved instantly and survives portal syncs.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search companies or venue…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-5 text-sm text-slate-600">
        <span><strong className="text-slate-900">{filtered.length}</strong> companies</span>
        <span><strong className="text-green-700">{filtered.filter(c => !c.isProcessCompleted).length}</strong> active</span>
        <span><strong className="text-slate-400">{filtered.filter(c => c.isProcessCompleted).length}</strong> completed</span>
      </div>

      {/* Company list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No companies found.</div>
        ) : filtered.map(company => (
          <button
            key={company._id}
            onClick={() => navigate(`/scheduler/companies/${company._id}`)}
            className="w-full text-left bg-white rounded-lg border border-slate-200 px-5 py-4 flex items-center justify-between hover:border-blue-400 hover:shadow-sm transition-all group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900 truncate">{company.name}</span>
                {company.isProcessCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium flex-shrink-0">
                    Completed
                  </span>
                )}
              </div>
              {company.venue && (
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {company.venue}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 ml-4">
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{company.total}</div>
                <div className="text-xs text-slate-400">total</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-blue-600">{company.shortlisted}</div>
                <div className="text-xs text-slate-400">shortlisted</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-yellow-600">{company.waitlisted}</div>
                <div className="text-xs text-slate-400">waitlisted</div>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
