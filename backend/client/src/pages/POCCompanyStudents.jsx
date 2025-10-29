// src/pages/POCCompanyStudents.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import StudentInterviewRow from "../components/StudentInterviewRow";
import AddWalkInModal from "../components/AddWalkInModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useSocket } from "../context/SocketContext";

export default function POCCompanyStudents() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [shortlists, setShortlists] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCompanyStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyId]);

  // Socket.IO listeners - Silent background updates
  useEffect(() => {
    if (!socket || !companyId) return;

    // Join company room
    // console.log(`🔌 POC joining company room: ${companyId}`);
    socket.emit("join:company", companyId);

    // Silent refresh function - no loading screen
    const silentRefresh = async (message) => {
      try {
        if (message) {
          toast.success(message);
        }
        const res = await api.get(`/poc/companies/${companyId}/students`);
        setCompany(res.data.company);
        setShortlists(res.data.shortlists || []);
        setStats(res.data.stats || {});
      } catch (err) {
        console.error("Silent refresh error:", err);
      }
    };

    // Listen for shortlist updates
    socket.on("shortlist:update", (data) => {
      // console.log("📡 Shortlist update received:", data);
      silentRefresh("Interview stage updated"); // Silent background refresh
    });

    // Listen for new offers
    socket.on("offer:created", (data) => {
      // console.log("🎉 Offer created:", data);
      silentRefresh("New offer created");
    });

    // Listen for offer approved by admin
    socket.on("offer:approved", (data) => {
      // console.log(" Offer approved by admin:", data);
      silentRefresh(`Offer for ${data.studentName} approved by admin`);
    });

    // Listen for offer rejected by admin
    socket.on("offer:rejected", (data) => {
      // console.log("❌ Offer rejected by admin:", data);
      silentRefresh(`Offer for ${data.studentName} rejected by admin`);
    });

    // Listen for offer status updates
    socket.on("offer:status-update", (data) => {
      // console.log("📊 Offer status updated:", data);/
      silentRefresh();
    });

    // Listen for students added
    socket.on("student:added", (data) => {
      // console.log("📌 Student added:", data);
      silentRefresh("New student added");
    });

    // Listen for students removed
    socket.on("student:removed", (data) => {
      // console.log("🗑️ Student removed:", data);
      silentRefresh("Student removed");
    });

    // Listen for student placement notifications (real-time update when student gets placed elsewhere)
    socket.on("student:placed", (data) => {
      // console.log("🎓 Student placed elsewhere:", data);
      toast.success(`Student placed at ${data.placedCompanyName}`, {
        duration: 5000
      });
      silentRefresh(); // Refresh to show updated placement status
    });

    // Cleanup
    return () => {
      socket.emit("leave:company", companyId);
      socket.off("shortlist:update");
      socket.off("offer:created");
      socket.off("offer:approved");
      socket.off("offer:rejected");
      socket.off("offer:status-update");
      socket.off("student:added");
      socket.off("student:removed");
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

  const fetchCompanyStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/poc/companies/${companyId}/students`);
      setCompany(res.data.company);
      setShortlists(res.data.shortlists || []);
      setStats(res.data.stats || {});
      
      // If POC (not admin) and process is completed, redirect
      if (res.data.company?.isProcessCompleted && user?.role === 'poc') {
        toast.error("This company's interview process has been completed");
        navigate("/poc");
        return;
      }
    } catch (err) {
      console.error("Error fetching company students:", err);
      if (err.response?.status === 403) {
        toast.error(err.response?.data?.message || "You are not assigned to this company");
        navigate("/poc");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = () => {
    fetchCompanyStudents();
  };

  const handleOfferCreated = () => {
    fetchCompanyStudents();
  };

  const handleWalkInAdded = () => {
    setShowWalkInModal(false);
    fetchCompanyStudents();
  };

  const handleMarkProcessComplete = async () => {
    try {
      await api.post(`/poc/companies/${companyId}/complete`);
      toast.success("Interview process marked as completed");
      
      // If POC (not admin), redirect to /poc page
      if (user?.role === 'poc') {
        setTimeout(() => {
          navigate("/poc");
        }, 1000); // Small delay to show the toast
      } else {
        // Admin can stay and refresh
        fetchCompanyStudents();
      }
    } catch (err) {
      console.error("Error marking process complete:", err);
      toast.error(err.response?.data?.message || "Failed to mark process as complete");
    }
  };

  const filteredShortlists = shortlists.filter(item => {
    const matchesSearch = 
      item.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Dynamic filter based on stage
    let matchesFilter = filterStage === "all";
    
    if (!matchesFilter) {
      if (filterStage === "shortlisted") {
        matchesFilter = item.currentStage === "SHORTLISTED";
      } else if (filterStage === "waitlisted") {
        matchesFilter = item.currentStage === "WAITLISTED";
      } else if (filterStage.startsWith("r")) {
        // Handle dynamic rounds (r1, r2, r3, r4, etc.)
        const roundNum = filterStage.substring(1);
        matchesFilter = item.stage === `R${roundNum}`;
      } else if (filterStage === "offered") {
        matchesFilter = item.isOffered;
      } else if (filterStage === "rejected") {
        matchesFilter = item.stage === "REJECTED";
      } else if (filterStage === "placed") {
        matchesFilter = item.student?.isPlaced;
      }
    }
    
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
          <p className="text-slate-600 mt-4">Loading students...</p>
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
            onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/poc')}
            className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Companies
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
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span>Max Rounds: {company?.maxRounds}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWalkInModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Walk-In
                </button>
                
                {!company?.isProcessCompleted && (
                  <button
                    onClick={() => setShowCompleteConfirm(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark Process Complete
                  </button>
                )}

                {/* If company is completed, show badge; if admin, show a Reopen button */}
                {company?.isProcessCompleted && (
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Process Completed
                    </div>
                    {user?.role === 'admin' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/admin/companies/${companyId}/complete`, { completed: false });
                            // Refresh company and lists
                            await fetchCompanyStudents();
                            toast.success('Company process reopened');
                          } catch (err) {
                            console.error('Failed to reopen process', err);
                            toast.error(err.response?.data?.message || 'Failed to reopen process');
                          }
                        }}
                        className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                      >
                        Reopen Process
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-xl font-bold text-slate-900">{stats.total}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-blue-600">Shortlisted</div>
                <div className="text-xl font-bold text-blue-600">{stats.shortlisted}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-yellow-600">Waitlist</div>
                <div className="text-xl font-bold text-yellow-600">{stats.waitlisted}</div>
              </div>
              {/* Dynamic round stats based on maxRounds */}
              {Array.from({ length: company?.maxRounds || 4 }, (_, i) => i + 1).map(round => (
                <div key={`r${round}`} className="bg-white rounded-lg shadow p-3">
                  <div className="text-xs text-purple-600">R{round}</div>
                  <div className="text-xl font-bold text-purple-600">{stats[`r${round}`] || 0}</div>
                </div>
              ))}
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-green-600">Offered</div>
                <div className="text-xl font-bold text-green-600">{stats.offered}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-red-600">Rejected</div>
                <div className="text-xl font-bold text-red-600">{stats.rejected}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-3">
                <div className="text-xs text-emerald-600">Placed</div>
                <div className="text-xl font-bold text-emerald-600">{stats.placed}</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="w-5 h-5 absolute left-3 top-2.5 text-slate-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stages</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="waitlisted">Waitlisted</option>
              {/* Dynamic round options based on maxRounds */}
              {Array.from({ length: company?.maxRounds || 4 }, (_, i) => i + 1).map(round => (
                <option key={`r${round}`} value={`r${round}`}>Round {round}</option>
              ))}
              <option value="offered">Offered</option>
              <option value="rejected">Rejected</option>
              <option value="placed">Placed</option>
            </select>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            {filteredShortlists.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-slate-600 mt-4">
                  {searchTerm || filterStage !== "all" 
                    ? "No students match your filters" 
                    : "No students shortlisted yet."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredShortlists.map((shortlist) => (
                  <StudentInterviewRow
                    key={shortlist._id}
                    shortlist={shortlist}
                    maxRounds={company?.maxRounds || 4}
                    onStageUpdate={handleStageUpdate}
                    onOfferCreated={handleOfferCreated}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Walk-In Modal */}
      {showWalkInModal && (
        <AddWalkInModal
          companyId={companyId}
          onClose={() => setShowWalkInModal(false)}
          onSuccess={handleWalkInAdded}
        />
      )}

      {/* Confirm Process Complete Dialog */}
      <ConfirmDialog
        isOpen={showCompleteConfirm}
        onClose={() => setShowCompleteConfirm(false)}
        onConfirm={handleMarkProcessComplete}
        title="Mark Process Complete"
        message={`Are you sure you want to mark the interview process for "${company?.name}" as completed? This will hide the company from all students' dashboards.`}
        confirmText="Mark Complete"
        // confirmColor="purple"
        icon="warning"
      />
    </div>
  );
}
