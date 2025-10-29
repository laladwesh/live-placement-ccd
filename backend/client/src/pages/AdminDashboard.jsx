// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import ConfirmDialog from "../components/ConfirmDialog";
import InputModal from "../components/InputModal";
import { useSocket } from "../context/SocketContext";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" or "confirmed"
  const [processing, setProcessing] = useState(null); // offerId being processed
  const [expandedStudent, setExpandedStudent] = useState(null); // Track expanded student rows
  const [searchTerm, setSearchTerm] = useState(""); // Search filter
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: null, // 'approve' or 'reject'
    offerId: null,
    studentName: '',
    companyName: ''
  });
  const [rejectReasonModal, setRejectReasonModal] = useState({
    isOpen: false,
    offerId: null
  });

  useEffect(() => {
    fetchUser();
    fetchOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.emit("join:admin");

    // Listen for new offers created by POCs
    socket.on("offer:created", (data) => {
      // console.log("🎉 New offer created:", data);
      toast.success(`New offer pending approval: ${data.companyName}`);
      fetchOffers(); // Refresh offers list
    });

    // Listen for offer status updates
    socket.on("offer:status-update", (data) => {
      // console.log("📊 Offer status updated:", data);
      fetchOffers(); // Refresh offers list
    });

    // Listen for offer approved events
    socket.on("offer:approved", (data) => {
      // console.log(" Offer approved:", data);
      fetchOffers(); // Refresh offers list
    });

    // Listen for offer rejected events
    socket.on("offer:rejected", (data) => {
      // console.log("❌ Offer rejected:", data);
      fetchOffers(); // Refresh offers list
    });

    return () => {
      socket.off("offer:created");
      socket.off("offer:status-update");
      socket.off("offer:approved");
      socket.off("offer:rejected");
    };
  }, [socket]);

  const fetchUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data.user);
      
      // Redirect if not admin
      if (res.data.user.role !== "admin") {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      navigate("/login");
    }
  };

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        api.get("/admin/offers/pending"),
        api.get("/admin/offers/confirmed")
      ]);
      
      setPendingOffers(pendingRes.data.offers || []);
      setConfirmedOffers(confirmedRes.data.offers || []);
    } catch (err) {
      console.error("Error fetching offers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (offerId, studentId) => {
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/approve`);
      await fetchOffers(); // Refresh data
      toast.success("Offer approved! Other offers auto-rejected and marked as placed.");
    } catch (err) {
      console.error("Error approving offer:", err);
      toast.error(err.response?.data?.message || "Failed to approve offer");
    } finally {
      setProcessing(null);
      setConfirmDialog({ isOpen: false, type: null, offerId: null, studentName: '', companyName: '' });
    }
  };

  const handleReject = async (offerId, reason = '') => {
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/reject`, { reason });
      await fetchOffers(); // Refresh data
      toast.success("Offer rejected successfully");
    } catch (err) {
      console.error("Error rejecting offer:", err);
      toast.error(err.response?.data?.message || "Failed to reject offer");
    } finally {
      setProcessing(null);
      setRejectReasonModal({ isOpen: false, offerId: null });
    }
  };

  const openRejectReasonModal = (offerId) => {
    setRejectReasonModal({ isOpen: true, offerId });
  };

  // Group offers by student
  const groupOffersByStudent = (offers) => {
    const grouped = {};
    offers.forEach(offer => {
      const studentId = offer.studentId?._id;
      if (!studentId) return;
      
      if (!grouped[studentId]) {
        grouped[studentId] = {
          student: offer.studentId,
          offers: []
        };
      }
      grouped[studentId].offers.push(offer);
    });
    return Object.values(grouped);
  };

  // Filter by search term
  const filterBySearch = (studentGroups) => {
    if (!searchTerm.trim()) return studentGroups;
    
    const lowerSearch = searchTerm.toLowerCase();
    return studentGroups.filter(group => {
      const student = group.student;
      return (
        student?.name?.toLowerCase().includes(lowerSearch) ||
        student?.emailId?.toLowerCase().includes(lowerSearch) ||
        student?.phoneNo?.toLowerCase().includes(lowerSearch) ||
        student?.rollNumber?.toLowerCase().includes(lowerSearch)
      );
    });
  };

  const groupedPendingOffers = filterBySearch(groupOffersByStudent(pendingOffers));
  const groupedConfirmedOffers = filterBySearch(groupOffersByStudent(confirmedOffers));

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Table Row Component for Student with Multiple Offers
  const StudentOfferRow = ({ studentData, isPending, index }) => {
    const { student, offers } = studentData;
    const isExpanded = expandedStudent === student._id;
    const hasMultipleOffers = offers.length > 1;
    
    // Find if student is placed (in confirmed offers)
    const placedOffer = !isPending ? offers.find(o => o.offerStatus === "ACCEPTED") : null;

    return (
      <>
        {/* Main Row */}
        <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition`}>
          {/* S.No */}
          <td className="px-4 py-3 text-sm text-slate-900 font-medium border-b border-slate-200">
            {index + 1}
          </td>
          
          {/* Student Info */}
          <td className="px-4 py-3 border-b border-slate-200">
            <div className="font-medium text-slate-900">{student?.name}</div>
            {student?.rollNumber && (
              <div className="text-xs text-slate-600 font-mono">{student.rollNumber}</div>
            )}
            <div className="text-xs text-slate-500">{student?.emailId}</div>
            <div className="text-xs text-slate-500">{student?.phoneNo}</div>
          </td>

          {/* Companies - Show dropdown if multiple */}
          <td className="px-4 py-3 border-b border-slate-200">
            {hasMultipleOffers ? (
              <div className="relative">
                <button
                  onClick={() => setExpandedStudent(isExpanded ? null : student._id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition text-sm font-medium"
                >
                  <span>{offers.length} Companies</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div>
                <div className="font-medium text-blue-700">{offers[0]?.companyId?.name}</div>
                <div className="text-xs text-slate-500">{offers[0]?.companyId?.venue}</div>
              </div>
            )}
          </td>

          {/* Status */}
          <td className="px-4 py-3 border-b border-slate-200">
            {placedOffer ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                ✓ Placed at {placedOffer.companyId?.name}
              </span>
            ) : hasMultipleOffers ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {isPending ? 'Multiple Pending' : 'Multiple Offers'}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {isPending ? 'Pending' : offers[0]?.offerStatus || 'Pending'}
              </span>
            )}
          </td>

          {/* Created Date */}
          <td className="px-4 py-3 text-sm text-slate-600 border-b border-slate-200">
            {formatDate(offers[0]?.createdAt)}
          </td>

          {/* Actions */}
          <td className="px-4 py-3 border-b border-slate-200">
            {!hasMultipleOffers && isPending ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDialog({
                    isOpen: true,
                    type: 'approve',
                    offerId: offers[0]._id,
                    studentName: student?.name,
                    companyName: offers[0]?.companyId?.name
                  })}
                  disabled={processing === offers[0]._id}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50"
                >
                  {processing === offers[0]._id ? "..." : "✓ Approve"}
                </button>
                <button
                  onClick={() => openRejectReasonModal(offers[0]._id)}
                  disabled={processing === offers[0]._id}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition disabled:opacity-50"
                >
                  {processing === offers[0]._id ? "..." : "✕ Reject"}
                </button>
              </div>
            ) : hasMultipleOffers ? (
              <span className="text-xs text-slate-500">Expand to manage →</span>
            ) : placedOffer ? (
              <span className="text-xs text-green-600 font-medium">Completed</span>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </td>
        </tr>

        {/* Expanded Rows for Multiple Offers */}
        {isExpanded && hasMultipleOffers && offers.map((offer, offerIndex) => (
          <tr key={offer._id} className="bg-blue-50 border-l-4 border-blue-400">
            <td className="px-4 py-2 text-xs text-slate-500 border-b border-slate-200"></td>
            <td className="px-4 py-2 text-xs text-slate-500 border-b border-slate-200">
              └─ Offer {offerIndex + 1}
            </td>
            <td className="px-4 py-2 border-b border-slate-200">
              <div className="font-medium text-blue-700 text-sm">{offer.companyId?.name}</div>
              <div className="text-xs text-slate-500">{offer.companyId?.venue}</div>
            </td>
            <td className="px-4 py-2 border-b border-slate-200">
              {!isPending && offer._id === placedOffer?._id ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  ✓ ACCEPTED
                </span>
              ) : !isPending && placedOffer ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">
                  Auto-rejected
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              )}
            </td>
            <td className="px-4 py-2 text-xs text-slate-600 border-b border-slate-200">
              {formatDate(offer.createdAt)}
            </td>
            <td className="px-4 py-2 border-b border-slate-200">
              {isPending ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDialog({
                      isOpen: true,
                      type: 'approve',
                      offerId: offer._id,
                      studentName: student?.name,
                      companyName: offer.companyId?.name
                    })}
                    disabled={processing === offer._id}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {processing === offer._id ? "..." : "Approve"}
                  </button>
                  <button
                    onClick={() => openRejectReasonModal(offer._id)}
                    disabled={processing === offer._id}
                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {processing === offer._id ? "..." : "Reject"}
                  </button>
                </div>
              ) : offer._id !== placedOffer?._id && placedOffer ? (
                <span className="text-xs text-slate-500">Placed at {placedOffer.companyId?.name}</span>
              ) : (
                <span className="text-xs text-green-600">—</span>
              )}
            </td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      {/* Navigation Cards Section */}
      <div className="w-full bg-slate-50 py-6 flex justify-center shadow-sm">
        <div className="max-w-7xl w-full px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => navigate("/admin/students")}
              className="p-6 bg-white border-2 rounded-lg hover:border-blue-300 hover:shadow-md transition text-left"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Student Management</h3>
              <p className="text-sm text-slate-600">Upload students via CSV</p>
            </button>

            <button
              onClick={() => navigate("/admin/company")}
              className="p-6 bg-white border-2 rounded-lg hover:border-blue-300 hover:shadow-md transition text-left"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Company Management</h3>
              <p className="text-sm text-slate-600">Manage companies & upload shortlists</p>
            </button>
          </div>
        </div>
      </div>

      {/* Offers Management Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Offer Management</h1>
          <p className="text-slate-600 mt-2">Review and approve offers created by POCs</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === "pending"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Pending Approval</span>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                  {groupedPendingOffers.length} {groupedPendingOffers.length === 1 ? 'Student' : 'Students'}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("confirmed")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === "confirmed"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Confirmed Offers</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  {groupedConfirmedOffers.length} {groupedConfirmedOffers.length === 1 ? 'Student' : 'Students'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, email, phone, or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-11 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="w-5 h-5 absolute left-3 top-3.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content - Table Layout */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading offers...</p>
          </div>
        ) : activeTab === "pending" ? (
          groupedPendingOffers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {searchTerm ? "No students found" : "No Pending Offers"}
              </h3>
              <p className="text-slate-600">
                {searchTerm ? "Try adjusting your search" : "All offers have been reviewed!"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Student Details
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedPendingOffers.map((studentData, index) => (
                      <StudentOfferRow 
                        key={studentData.student._id} 
                        studentData={studentData} 
                        isPending={true}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
                Showing {groupedPendingOffers.length} {groupedPendingOffers.length === 1 ? 'student' : 'students'}
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
            </div>
          )
        ) : (
          groupedConfirmedOffers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {searchTerm ? "No students found" : "No Confirmed Offers"}
              </h3>
              <p className="text-slate-600">
                {searchTerm ? "Try adjusting your search" : "No offers have been approved yet"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Student Details
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Placed At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedConfirmedOffers.map((studentData, index) => (
                      <StudentOfferRow 
                        key={studentData.student._id} 
                        studentData={studentData} 
                        isPending={false}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
                Showing {groupedConfirmedOffers.length} {groupedConfirmedOffers.length === 1 ? 'student' : 'students'}
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
            </div>
          )
        )}
      </main>

      {/* Confirm Approve Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'approve'}
        onClose={() => setConfirmDialog({ isOpen: false, type: null, offerId: null, studentName: '', companyName: '' })}
        onConfirm={() => handleApprove(confirmDialog.offerId)}
        title="Approve Offer"
        message={`Are you sure you want to approve the offer from ${confirmDialog.companyName} for ${confirmDialog.studentName}?\n\nThis will:\n• Place the student at ${confirmDialog.companyName}\n• Auto-reject all other pending offers for this student\n• Update all company shortlists showing "Placed at ${confirmDialog.companyName}"`}
        confirmText="Approve Offer"
        confirmColor="green"
        icon="success"
      />

      {/* Reject Reason Input Modal */}
      <InputModal
        isOpen={rejectReasonModal.isOpen}
        onClose={() => setRejectReasonModal({ isOpen: false, offerId: null })}
        onSubmit={(reason) => handleReject(rejectReasonModal.offerId, reason)}
        title="Reject Offer"
        label="Reason for Rejection (Optional)"
        placeholder="Enter a reason for rejecting this offer..."
      />
    </div>
  );
}
