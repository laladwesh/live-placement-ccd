// src/pages/AdminCompanyDetails.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import CompanyCard from "../components/CompanyCard";
import AddCompanyModal from "../components/AddCompanyModal";
import EditCompanyModal from "../components/EditCompanyModal";
import { useSocket } from "../context/SocketContext";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";
import { useNavigate } from "react-router-dom";

export default function AdminCompanyDetails() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(() => getCachedUser());
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncingCompanies, setSyncingCompanies] = useState(false);
  const [companySyncResult, setCompanySyncResult] = useState(null);

  useEffect(() => {
    if (!user) {
      api.get("/users/me").then(res => {
        setCachedUser(res.data.user);
        setUser(res.data.user);
      }).catch(() => { clearCachedUser(); localStorage.removeItem("jwt_token"); navigate("/login"); });
    }
    fetchCompanies();
  }, []);

  // Socket.IO listeners - Silent background updates
  useEffect(() => {
    if (!socket) return;

    // Join admin room
    socket.emit("join:admin");

    // Silent refresh function - no loading screen
    const silentRefresh = async () => {
      try {
        const res = await api.get("/admin/companies");
        setCompanies(res.data.companies || []);
      } catch (err) {
        console.error("Silent refresh error:", err);
      }
    };

    // Listen for company updates
    socket.on("company:update", (data) => {
      // console.log("Company update received:", data.action, data.data);
      silentRefresh(); // Silent background refresh
    });

    // Cleanup
    return () => {
      socket.off("company:update");
    };
  }, [socket]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/companies");
      setCompanies(res.data.companies || []);
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyAdded = () => {
    setShowAddModal(false);
    fetchCompanies();
  };

  const handleCompanyUpdated = () => {
    fetchCompanies();
  };

  const handleCompanyDeleted = () => {
    fetchCompanies();
  };

  // Handler for when a company edit is initiated from CompanyCard
  const handleEditCompany = (company) => {
    setCompanyToEdit(company);
    setShowEditModal(true);
  };

  // Callback for when a company is successfully edited in the modal
  const handleCompanyEdited = () => {
    setShowEditModal(false);
    setCompanyToEdit(null); // Clear the company to edit
    fetchCompanies(); // Refresh the list of companies
  };
  const handleSyncCompaniesFromPortal = async () => {
    setSyncingCompanies(true);
    setCompanySyncResult(null);
    try {
      const res = await api.post("/admin/sync/companies");
      setCompanySyncResult(res.data);
      fetchCompanies();
    } catch (err) {
      setCompanySyncResult({ error: err.response?.data?.message || "Sync failed" });
    } finally {
      setSyncingCompanies(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const q = (searchTerm || "").trim().toLowerCase();

    if (q === "") return true;

    const name = (company.name || "").toLowerCase();
    const description = (company.description || "").toLowerCase();
    const venue = (company.venue || "").toLowerCase();

    const pocMatch = (company.POCs || []).some(poc => {
      const pname = (poc?.name || "").toLowerCase();
      const pemail = (poc?.emailId || poc?.email || "").toLowerCase();
      return pname.includes(q) || pemail.includes(q);
    });

    return (
      name.includes(q) ||
      description.includes(q) ||
      venue.includes(q) ||
      pocMatch
    );
  });

  if (!user) {
    return <div className="p-6 text-slate-600">Loading...</div>;
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          Access Denied: Admin privileges required
        </div>
      </div>
    );
  }

  return (
    <>
    <main className="px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Company Management</h1>
              {/* <p className="text-slate-600 mt-1">View, add, and manage all companies.</p> */}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncCompaniesFromPortal}
                disabled={syncingCompanies}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncingCompanies ? "Syncing…" : "Sync All Companies"}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Company
              </button>
            </div>
          </div>

          {/* Stats */}
          {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-slate-500">Total Companies</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{companies.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-slate-500">With POCs</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {companies.filter(c => c.pocs && c.pocs.length > 0).length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-slate-500">Pending Offers</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-slate-500">Confirmed Offers</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
            </div>
          </div> */}

          {companySyncResult && (
            <div className={`mb-3 px-4 py-2 rounded text-sm ${companySyncResult.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
              {companySyncResult.error
                ? companySyncResult.error
                : `Sync done — ${companySyncResult.total} companies found: ${companySyncResult.created} added, ${companySyncResult.skipped} already present`}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search companies, description, venue, or POC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-5 h-5 absolute left-3 top-2.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Companies Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">Loading companies...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-slate-600 mt-4">
              {searchTerm ? "No companies match your search" : "No companies yet. Add your first company!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map(company => (
              <CompanyCard
                key={company._id}
                company={company}
                user={user}
                onUpdate={handleCompanyUpdated}
                onDelete={handleCompanyDeleted}
                onEdit={handleEditCompany}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleCompanyAdded}
        />
      )}

      {showEditModal && companyToEdit && (
        <EditCompanyModal
          company={companyToEdit}
          onClose={() => { setShowEditModal(false); setCompanyToEdit(null); }}
          onSuccess={handleCompanyEdited}
        />
      )}
    </>
  );
}

