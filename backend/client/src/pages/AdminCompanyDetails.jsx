// src/pages/AdminCompanyDetails.jsx
import React, { useEffect, useState } from "react"; // Corrected file path comment
import api from "../api/axios";
import Navbar from "../components/Navbar";
import CompanyCard from "../components/CompanyCard";
import AddCompanyModal from "../components/AddCompanyModal";
import EditCompanyModal from "../components/EditCompanyModal"; // Assuming this component exists or will be created
import { useSocket } from "../context/SocketContext";

export default function AdminCompanyDetails() {
  const { socket, connected } = useSocket();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // New state for edit modal visibility
  const [companyToEdit, setCompanyToEdit] = useState(null); // New state to hold company data for editing
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUser();
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
      console.log("🏢 Company update received:", data.action, data.data);
      silentRefresh(); // Silent background refresh
    });

    // Cleanup
    return () => {
      socket.off("company:update");
    };
  }, [socket]);

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
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar user={null} />
        <div className="max-w-7xl mx-auto p-6">Loading...</div>
      </div>
    );
  }

  // Check if user is admin
  if (user.role !== "admin" && user.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Access Denied: Admin privileges required
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Company Management</h1>
              <p className="text-slate-600 mt-1">View, add, and manage all companies.</p>
            </div>
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

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search companies..."
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
                onUpdate={handleCompanyUpdated}
                onDelete={handleCompanyDeleted}
                onEdit={handleEditCompany} // Pass the new handler to CompanyCard
              />
            ))}
          </div>
        )}
      </main>

      {/* Add Company Modal */}
      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleCompanyAdded}
        />
      )}

      {/* Edit Company Modal - NEW */}
      {showEditModal && companyToEdit && (
        <EditCompanyModal
          company={companyToEdit} // Pass the company data to the modal
          onClose={() => {
            setShowEditModal(false);
            setCompanyToEdit(null); // Clear the company to edit on close
          }}
          onSuccess={handleCompanyEdited}
        />
      )}
    </div>
  );
}
