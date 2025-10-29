// src/pages/POCDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";

export default function POCDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCompanies();
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data.user);
    } catch (err) {
      console.error("whoami error", err);
      localStorage.removeItem("jwt_token");
      window.location.href = "/login";
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/poc/companies");
      setCompanies(res.data.companies || []);
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar user={null} />
        <div className="max-w-7xl mx-auto p-6">Loading...</div>
      </div>
    );
  }

  // Check if user is POC or admin
  if (user.role !== "poc" && user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Access Denied: POC privileges required
          </div>
        </div>
      </div>
    );
  }

  // Filter companies by search term (client-side)
  const filteredCompanies = companies.filter(c => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.venue || "").toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">POC Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage interviews for your assigned companies</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="max-w-2xl">
            <input
              type="text"
              placeholder="Search companies by name or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Companies List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">Loading your companies...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-slate-600 mt-4">
              No companies assigned to you yet. Contact admin for company assignments.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map(company => (
              <div
                key={company._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => navigate(`/poc/company/${company._id}`)}
              >
                <div className="p-6">
                  {/* Company Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{company.name}</h3>
                    {company.venue && (
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {company.venue}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {company.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{company.description}</p>
                  )}

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Max Rounds</span>
                      <span className="font-medium text-slate-900">{company.maxRounds}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Manage Interviews
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
