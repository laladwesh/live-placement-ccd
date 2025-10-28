// src/pages/CompanyDetails.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import AddStudentModal from "../components/AddStudentModal";
import UploadCSVModal from "../components/UploadCSVModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useSocket } from "../context/SocketContext";

export default function CompanyDetails() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [shortlists, setShortlists] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    studentId: null,
    studentName: ""
  });

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCompanyDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  // Socket.IO listeners - Silent background updates
  useEffect(() => {
    if (!socket || !companyId) return;

    // Join company room
    socket.emit("join:company", companyId);

    // Silent refresh function - no loading screen
    const silentRefresh = async () => {
      try {
        const res = await api.get(`/admin/companies/${companyId}/shortlist`);
        setCompany(res.data.company);
        setShortlists(res.data.shortlists || []);
        setStats(res.data.stats || {});
      } catch (err) {
        console.error("Silent refresh error:", err);
      }
    };

    // Listen for student additions
    socket.on("student:added", (data) => {
      console.log("📌 Student added:", data);
      silentRefresh(); // Silent background refresh
    });

    // Listen for student removals
    socket.on("student:removed", (data) => {
      console.log("🗑️ Student removed:", data);
      silentRefresh();
    });

    // Listen for shortlist updates (stage changes by POC)
    socket.on("shortlist:update", (data) => {
      console.log("📊 Shortlist updated:", data);
      silentRefresh(); // Refresh when POC changes interview stage
    });

    // Listen for offers created by POC
    socket.on("offer:created", (data) => {
      console.log("🎉 Offer created:", data);
      silentRefresh(); // Refresh to show new offer
    });

    // Listen for offer approvals
    socket.on("offer:approved", (data) => {
      console.log(" Offer approved:", data);
      silentRefresh();
    });

    // Listen for offer rejections
    socket.on("offer:rejected", (data) => {
      console.log("❌ Offer rejected:", data);
      silentRefresh();
    });

    // Listen for student placement notifications (real-time update when student gets placed elsewhere)
    socket.on("student:placed", (data) => {
      console.log("🎓 Student placed elsewhere:", data);
      toast.success(`Student placed at ${data.placedCompanyName}`, {
        duration: 5000
      });
      silentRefresh(); // Refresh to show updated placement status
    });

    // Cleanup
    return () => {
      socket.emit("leave:company", companyId);
      socket.off("student:added");
      socket.off("student:removed");
      socket.off("shortlist:update");
      socket.off("offer:created");
      socket.off("offer:approved");
      socket.off("offer:rejected");
      socket.off("student:placed");
    };
  }, [socket, companyId]);

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

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/companies/${companyId}/shortlist`);
      setCompany(res.data.company);
      setShortlists(res.data.shortlists || []);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error("Error fetching company details:", err);
      if (err.response?.status === 404) {
        toast.error("Company not found");
        navigate("/admin");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentAdded = () => {
    setShowAddModal(false);
    fetchCompanyDetails();
  };

  const handleCSVUploaded = () => {
    setShowUploadModal(false);
    fetchCompanyDetails();
  };

  const handleRemoveStudent = async (shortlistId) => {
    try {
      await api.delete(`/admin/companies/${companyId}/shortlist/${shortlistId}`);
      toast.success("Student removed from shortlist");
      // Don't call fetchCompanyDetails() - let socket handle the refresh
    } catch (err) {
      console.error("Error removing student:", err);
      toast.error(err.response?.data?.message || "Failed to remove student");
    }
  };

  const getStatusBadge = (stage) => {
    const badges = {
      SHORTLISTED: "bg-blue-100 text-blue-800",
      WAITLISTED: "bg-yellow-100 text-yellow-800",
      R1: "bg-purple-100 text-purple-800",
      R2: "bg-purple-100 text-purple-800",
      R3: "bg-purple-100 text-purple-800",
      OFFERED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800"
    };
    return badges[stage] || "bg-gray-100 text-gray-800";
  };

  const filteredShortlists = shortlists.filter(item => {
    const matchesSearch = 
      item.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === "all" ||
      (filterStatus === "shortlisted" && item.currentStage === "SHORTLISTED") ||
      (filterStatus === "waitlisted" && item.currentStage === "WAITLISTED") ||
      (filterStatus === "offered" && item.currentStage === "OFFERED") ||
      (filterStatus === "placed" && item.student?.isPlaced);
    
    return matchesSearch && matchesFilter;
  });

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar user={null} />
        <div className="max-w-7xl mx-auto p-6">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto p-6 text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 mt-4">Loading company details...</p>
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
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Companies
          </button>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-slate-900">{company?.name}</h1>
                {company?.venue && (
                  <p className="text-slate-600 mt-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {company.venue}
                  </p>
                )}
                {company?.description && (
                  <p className="text-slate-600 mt-2">{company.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Student
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload CSV
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-blue-600">Shortlisted</div>
                <div className="text-2xl font-bold text-blue-600">{stats.shortlisted}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-yellow-600">Waitlisted</div>
                <div className="text-2xl font-bold text-yellow-600">{stats.waitlisted}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-purple-600">In Progress</div>
                <div className="text-2xl font-bold text-purple-600">{stats.inProgress}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-green-600">Offered</div>
                <div className="text-2xl font-bold text-green-600">{stats.offered}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-red-600">Rejected</div>
                <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-emerald-600">Placed</div>
                <div className="text-2xl font-bold text-emerald-600">{stats.placed}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="w-5 h-5 absolute left-3 top-2.5 text-slate-400 pointer-events-none"
                style={{ marginTop: "0.5rem", marginLeft: "0.5rem" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Students</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="offered">Offered</option>
              <option value="placed">Placed</option>
            </select>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredShortlists.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-slate-600 mt-4">
                {searchTerm || filterStatus !== "all" 
                  ? "No students match your filters" 
                  : "No students shortlisted yet. Add students or upload a CSV."}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredShortlists.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                          {item.student?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">{item.student?.name}</div>
                          {item.student?.isPlaced && (
                            <div className="text-xs text-green-600">✓ Placed</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.student?.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {item.student?.phoneNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.student?.isPlaced ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
                          Placed
                        </span>
                      ) : item.student?.isBlocked ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(item.currentStage)}`}>
                        {item.currentStage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setConfirmDialog({
                          isOpen: true,
                          studentId: item._id,
                          studentName: item.student?.name
                        })}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddStudentModal
          companyId={companyId}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleStudentAdded}
        />
      )}

      {showUploadModal && (
        <UploadCSVModal
          companyId={companyId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleCSVUploaded}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, studentId: null, studentName: "" })}
        onConfirm={() => handleRemoveStudent(confirmDialog.studentId)}
        title="Remove Student"
        message={`Are you sure you want to remove ${confirmDialog.studentName} from the shortlist?`}
        confirmText="Remove"
        confirmColor="red"
        icon="danger"
      />
    </div>
  );
}
