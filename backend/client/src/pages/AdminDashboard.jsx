// src/pages/AdminOffersDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import ConfirmDialog from "../components/ConfirmDialog";
import { useSocket } from "../context/SocketContext";

export default function AdminOffersDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [processing, setProcessing] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: null,
    offerId: null,
    studentName: ''
  });

  useEffect(() => {
    fetchUser();
    fetchOffers();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join:admin");
    socket.on("offer:created", fetchOffers);
    socket.on("offer:approved", fetchOffers);
    return () => {
      socket.off("offer:created");
      socket.off("offer:approved");
    };
  }, [socket]);

  const fetchUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data.user);
      if (res.data.user.role !== "admin") navigate("/dashboard");
    } catch (err) {
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

      console.log("hello there! all confirmed offers" ,confirmedRes.data.offers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (offerId) => {
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/approve`);
      await fetchOffers();
      toast.success("Offer approved and sent to student!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve offer");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (offerId) => {
    const reason = window.prompt("Enter reason for rejection (optional):");
    if (reason === null) return;
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/reject`, { reason });
      await fetchOffers();
      toast.success("Offer rejected successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject offer");
    } finally {
      setProcessing(null);
    }
  };

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

  const OfferCard = ({ offer, isPending }) => (
    <div className="bg-white flex flex-col border border-slate-200 rounded-lg p-5 hover:shadow-md transition gap-4">
      {/* Student Info Row */}
      <div className="flex flex-col sm:flex-row justify-center gap-12 items-center">
        <div className="flex-1">
          <span className="font-medium">Name:</span> {offer.studentId?.name}
        </div>
        <div className="flex-1">
          <span className="font-medium">Email:</span> {offer.studentId?.emailId}
        </div>
        <div className="flex-1">
          <span className="font-medium">Contact:</span> {offer.studentId?.phoneNo}
        </div>
        <div className="flex-1">
          <span className="font-medium">Company:</span> <span className="text-blue-700 font-semibold">{offer.companyId?.name}</span>
        </div>
      </div>
  
      {/* Pending Approval Buttons */}
{isPending && (
  <div className="flex flex-row gap-2 text-sm text-slate-600 mt-2">
    <button
      onClick={() =>
        setConfirmDialog({
          isOpen: true,
          type: "approve",
          offerId: offer._id,
          studentName: offer.studentId?.name,
        })
      }
      disabled={processing === offer._id}
      className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 font-medium"
    >
      {processing === offer._id ? "Processing..." : "✓ Approve"}
    </button>
    <button
      onClick={() => handleReject(offer._id)}
      disabled={processing === offer._id}
      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 font-medium"
    >
      {processing === offer._id ? "Processing..." : "✕ Reject"}
    </button>
  </div>
)}
  
      {/* Approved by & Remarks Row */}
      {!isPending && (offer.approvedBy || offer.remarks) && (
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          {offer.approvedBy && (
            <div>
              <span className="font-medium">Approved by:</span> {offer.approvedBy.name}
            </div>
          )}
          {offer.remarks && (
            <div>
              <span className="font-medium">Remarks:</span> {offer.remarks}
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  

  return (
    <>
      <Navbar user={user} />

      {/* Section 1: Red background with 3 boxes */}
      <div className="w-full bg-slat-50 py-6 flex justify-center shadow-lg">
        <div className="max-w-7xl w-full px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* <button
              onClick={() => navigate("/admin/offers")}
              className="p-6 bg-white border-2 rounded-lg hover:border-blue-300 hover:shadow-md transition text-left"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Offer Management</h3>
              <p className="text-sm text-slate-600">Review & approve pending offers</p>
            </button> */}
          </div>
        </div>
      </div>

      {/* Section 2: Blue background containing the Offer Management dashboard */}
      <div className="w-full  bg-white">
        <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 bg-white">
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
                    {pendingOffers.length}
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
                    {confirmedOffers.length}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
{loading ? (
  <div className="text-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
    <p className="text-slate-600 mt-4">Loading offers...</p>
  </div>
) : activeTab === "pending" ? (
  pendingOffers.length === 0 ? (
    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
      <h3 className="text-xl font-semibold text-slate-900 mb-2">No Pending Offers</h3>
      <p className="text-slate-600">All offers have been reviewed!</p>
    </div>
  ) : (
    <div className="flex flex-col gap-4 py-4">
      {pendingOffers.map((offer) => (
        <OfferCard key={offer._id} offer={offer} isPending={true} />
      ))}
    </div>
  )
) : confirmedOffers.length === 0 ? (
  <div className="bg-white rounded-lg shadow-sm p-12 text-center">
    <h3 className="text-xl font-semibold text-slate-900 mb-2">No Confirmed Offers</h3>
    <p className="text-slate-600">No offers have been approved yet</p>
  </div>
) : (
  <div className="flex flex-col gap-4 py-4">
  {confirmedOffers.map((offer) => (
      <div key={offer._id} className="w-[100%]">
          <OfferCard offer={offer} isPending={false}/>
      </div>
  ))}
</div>


)}

        </main>
      </div>

      {/* Confirm Approve Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === "approve"}
        onClose={() => setConfirmDialog({ isOpen: false, type: null, offerId: null, studentName: "" })}
        onConfirm={() => handleApprove(confirmDialog.offerId)}
        title="Approve Offer"
        message={`Are you sure you want to approve this offer for ${confirmDialog.studentName}? It will be sent to the student.`}
        confirmText="Approve"
        confirmColor="green"
        icon="success"
      />
    </>
  );
}
