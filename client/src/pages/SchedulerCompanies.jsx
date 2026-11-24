// src/pages/SchedulerCompanies.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function SchedulerCompanies() {
  const navigate = useNavigate();
  const [user, setUser]           = useState(() => getCachedUser());
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

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
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? companies.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.venue || "").toLowerCase().includes(q)
      )
    : companies;

  if (!user || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 28, height: 28, border: "2px solid #E9E9EB", borderTopColor: "#14213D", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E2532", margin: 0 }}>Interview Scheduler</h1>
        <p style={{ fontSize: 13, color: "#8D9096", marginTop: 3 }}>
          Drag students within a company to set interview order. Order persists across portal syncs.
        </p>
      </div>

      {/* Card */}
      <div className="pp-card">

        {/* Toolbar */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #E9E9EB",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1E2532" }}>
              Companies
            </span>
            <span style={{ fontSize: 13, color: "#8D9096" }}>
              {filtered.length}{filtered.length !== companies.length ? ` / ${companies.length}` : ""}
            </span>
            <span style={{ fontSize: 12, color: "#1A6B2A" }}>
              {filtered.filter(c => !c.isProcessCompleted).length} active
            </span>
            <span style={{ fontSize: 12, color: "#8D9096" }}>
              {filtered.filter(c => c.isProcessCompleted).length} completed
            </span>
          </div>

          {/* Search */}
          <div style={{ position: "relative", width: 260 }}>
            <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#8D9096", pointerEvents: "none" }}
              width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company or venue…"
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

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#8D9096", fontSize: 14 }}>No companies found.</div>
        ) : (
          <table className="pp-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>#</th>
                <th>Company</th>
                <th>Venue</th>
                <th style={{ textAlign: "center" }}>Total</th>
                <th style={{ textAlign: "center" }}>Shortlisted</th>
                <th style={{ textAlign: "center" }}>Waitlisted</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, idx) => (
                <tr
                  key={company._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/scheduler/companies/${company._id}`)}
                >
                  <td style={{ textAlign: "center", color: "#8D9096", fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: "#1E2532" }}>{company.name}</td>
                  <td style={{ color: "#8D9096", fontSize: 13 }}>{company.venue || "—"}</td>
                  <td style={{ textAlign: "center", color: "#353B47" }}>{company.total}</td>
                  <td style={{ textAlign: "center", color: "#14213D", fontWeight: 600 }}>{company.shortlisted}</td>
                  <td style={{ textAlign: "center", color: "#7B5700" }}>{company.waitlisted}</td>
                  <td style={{ textAlign: "center" }}>
                    {company.isProcessCompleted ? (
                      <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#F4F2F1", color: "#8D9096", border: "1px solid #E9E9EB" }}>
                        Completed
                      </span>
                    ) : (
                      <span style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB" }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ color: "#DBDDE0", textAlign: "center" }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
