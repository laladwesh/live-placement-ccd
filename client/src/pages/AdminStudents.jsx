// src/pages/AdminStudents.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function AdminStudents() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user);
      setUser(res.data.user);
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSyncFromPortal = async () => {
    setSyncing(true);
    setSyncResult(null);
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

  return (
    <div className="bg-slate-50 p-6">
      <div className="px-6">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Student Management</h1>
            <p className="text-slate-600 mt-1">Students synced from the placement portal</p>
          </div>
          <button
            onClick={handleSyncFromPortal}
            disabled={syncing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Syncing…" : "Sync from Placement Portal"}
          </button>
        </div>

        {/* Sync result banner */}
        {syncResult && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${syncResult.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>
            {syncResult.error ? (
              syncResult.error
            ) : (
              <>
                {`Sync done — ${syncResult.total} students: ${syncResult.created} created, ${syncResult.updated} updated`}
                {syncResult.offCampus && (
                  syncResult.offCampus.error
                    ? ` | Off-campus placements: sync failed (${syncResult.offCampus.error})`
                    : ` | Off-campus placements: ${syncResult.offCampus.created} added, ${syncResult.offCampus.updated} updated`
                )}
              </>
            )}
          </div>
        )}

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              All Students&nbsp;
              <span className="text-slate-400 font-normal text-base">
                ({search
                  ? `${students.filter(s =>
                      [s.userId?.name, s.userId?.emailId, s.rollNumber]
                        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
                    ).length} of ${students.length}`
                  : students.length})
              </span>
            </h2>
            <div className="relative w-full sm:w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or roll…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No students found. Sync from the placement portal to populate.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Roll Number</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Shortlisted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wider">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.filter(s =>
                    !search || [s.userId?.name, s.userId?.emailId, s.rollNumber]
                      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
                  ).map((student) => (
                    <tr
                      key={student._id}
                      className="hover:bg-blue-50 cursor-pointer"
                      onClick={() => student.rollNumber && navigate(`/placement-stats/${student.rollNumber}`)}
                      title={student.rollNumber ? `View placement stats for ${student.userId?.name || student.rollNumber}` : undefined}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {student.userId?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.userId?.emailId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.rollNumber || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.userId?.phoneNo || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.shortlistedCompanies?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.isPlaced ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Placed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">
                            Not Placed
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
    </div>
  );
}
