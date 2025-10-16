// src/pages/AdminOffersDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import { useSocket } from "../context/SocketContext";

export default function AdminOffersDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" or "confirmed"
  const [processing, setProcessing] = useState(null); // offerId being processed

  useEffect(() => {
    fetchUser();
    fetchOffers();
  }, []);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.emit("join:admin");

    socket.on("offer:created", () => {
      fetchOffers(); // Refresh when new offer created
    });

    socket.on("offer:approved", () => {
      fetchOffers(); // Refresh when offer approved
    });

    return () => {
      socket.off("offer:created");
      socket.off("offer:approved");
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

  const handleApprove = async (offerId) => {
    if (!window.confirm("Are you sure you want to approve this offer? It will be sent to the student.")) {
      return;
    }

    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/approve`);
      await fetchOffers(); // Refresh data
      alert("Offer approved and sent to student!");
    } catch (err) {
      console.error("Error approving offer:", err);
      alert(err.response?.data?.message || "Failed to approve offer");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (offerId) => {
    const reason = window.prompt("Enter reason for rejection (optional):");
    if (reason === null) return; // User cancelled

    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/reject`, { reason });
      await fetchOffers(); // Refresh data
      alert("Offer rejected successfully");
    } catch (err) {
      console.error("Error rejecting offer:", err);
      alert(err.response?.data?.message || "Failed to reject offer");
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
    <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition">
      {/* Student & Company Info */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-900">{offer.studentId?.name}</h3>
          <p className="text-sm text-slate-500">{offer.studentId?.emailId}</p>
          <p className="text-sm text-slate-500">{offer.studentId?.phoneNo}</p>
        </div>
        <div className="text-right">
          <div className="font-semibold text-blue-700">{offer.companyId?.name}</div>
          <div className="text-xs text-slate-500">{offer.companyId?.venue}</div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="space-y-1 text-sm text-slate-600 mb-4">
        <div className="flex justify-between">
          <span>Created:</span>
          <span className="font-medium">{formatDate(offer.createdAt)}</span>
        </div>
        {!isPending && offer.approvedAt && (
          <div className="flex justify-between">
            <span>Approved:</span>
            <span className="font-medium">{formatDate(offer.approvedAt)}</span>
          </div>
        )}
        {!isPending && offer.approvedBy && (
          <div className="flex justify-between">
            <span>Approved by:</span>
            <span className="font-medium">{offer.approvedBy.name}</span>
          </div>
        )}
      </div>

      {/* Remarks */}
      {offer.remarks && (
        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded mb-4">
          <span className="font-medium">Remarks:</span> {offer.remarks}
        </div>
      )}

      {/* Student Response Status */}
      {!isPending && (
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 text-sm rounded-full ${
            offer.offerStatus === "ACCEPTED" 
              ? "bg-green-100 text-green-800"
              : offer.offerStatus === "DECLINED"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}>
            Student: {offer.offerStatus}
          </span>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={() => handleApprove(offer._id)}
            disabled={processing === offer._id}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
          >
            {processing === offer._id ? "Processing..." : "✓ Approve"}
          </button>
          <button
            onClick={() => handleReject(offer._id)}
            disabled={processing === offer._id}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 font-medium"
          >
            {processing === offer._id ? "Processing..." : "✕ Reject"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin Dashboard
          </button>
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
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Pending Offers</h3>
              <p className="text-slate-600">All offers have been reviewed!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingOffers.map((offer) => (
                <OfferCard key={offer._id} offer={offer} isPending={true} />
              ))}
            </div>
          )
        ) : (
          confirmedOffers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Confirmed Offers</h3>
              <p className="text-slate-600">No offers have been approved yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {confirmedOffers.map((offer) => (
                <OfferCard key={offer._id} offer={offer} isPending={false} />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
