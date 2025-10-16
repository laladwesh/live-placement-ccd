// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import { useSocket } from "../context/SocketContext";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOfferId, setUpdatingOfferId] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      await fetchUser();
      await fetchOffers();
      setLoading(false);
    };
    initialize();
  }, []);

  // Socket.IO listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Join admin room for broadcasts
    socket.emit("join:admin");

    const handleOfferUpdate = (data) => {
      console.log("📢 Offer update received via socket:", data);
      fetchOffers(); // Re-fetch all offers to stay in sync
    };

    socket.on("offer:created", handleOfferUpdate);
    socket.on("offer:confirmed", handleOfferUpdate);

    return () => {
      socket.off("offer:created", handleOfferUpdate);
      socket.off("offer:confirmed", handleOfferUpdate);
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

  const fetchOffers = async () => {
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        api.get("/admin/offers?status=PENDING"),
        api.get("/admin/offers?status=ACCEPTED"),
      ]);
      setPendingOffers(pendingRes.data.offers || []);
      setConfirmedOffers(confirmedRes.data.offers || []);
    } catch (err) {
      console.error("Error fetching offers:", err);
    }
  };

  const handleConfirmOffer = async (offerId) => {
    if (!window.confirm("Are you sure you want to confirm this offer? This will mark the student as placed.")) {
      return;
    }
    setUpdatingOfferId(offerId);
    try {
      // API call to confirm the offer and update student's `isPlaced` status
      await api.patch(`/admin/offers/${offerId}/confirm`);
      // The socket listener will handle the UI update, but we can also trigger a manual fetch
      // to ensure the UI updates immediately, even if there's a socket delay.
      fetchOffers();
    } catch (err) {
      console.error("Error confirming offer:", err);
      alert(err.response?.data?.message || "Failed to confirm the offer. Please try again.");
    } finally {
      // The offer will disappear from the pending list, so no need to reset the state
      // for this specific ID if the call is successful.
      setUpdatingOfferId(null);
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

  // Role check
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600 mt-1">Manage placements, offers, students and companies.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => navigate("/admin/students")}
            className="p-6 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900">Student Management</h3>
            </div>
            <p className="text-sm text-slate-600">Upload students via CSV</p>
          </button>

          <button
            onClick={() => navigate("/admin/company")}
            className="p-6 bg-white border-2 border-green-200 rounded-lg hover:border-green-400 hover:shadow-md transition text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900">Company Management</h3>
            </div>
            <p className="text-sm text-slate-600">Manage companies & upload shortlists</p>
          </button>

          <button
            onClick={() => navigate("/admin/offers")}
            className="p-6 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:shadow-md transition text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900">Offer Management</h3>
            </div>
            <p className="text-sm text-slate-600">Review & approve pending offers</p>
          </button>
        </div>

        {/* Offers Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Recent Offers</h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">Loading offers...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Pending Offers Section */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 border-b pb-2 mb-4">
                Pending Offers ({pendingOffers.length})
              </h2>
              {pendingOffers.length > 0 ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Offer Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Remarks</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {pendingOffers.map((offer) => (
                        <tr key={offer._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{offer.student?.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{offer.company?.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{format(new Date(offer.createdAt), "dd MMM, yyyy")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{offer.remarks || "-"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleConfirmOffer(offer._id)}
                              className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                              disabled={updatingOfferId === offer._id}
                            >
                              {updatingOfferId === offer._id ? "Confirming..." : "Confirm Offer"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500">No pending offers to review.</p>
              )}
            </section>

            {/* Confirmed Offers Section */}
            <section>
              <h2 className="text-2xl font-semibold text-slate-800 border-b pb-2 mb-4">
                Confirmed Placements ({confirmedOffers.length})
              </h2>
              {confirmedOffers.length > 0 ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Confirmation Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {confirmedOffers.map((offer) => (
                        <tr key={offer._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{offer.student?.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{offer.company?.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{format(new Date(offer.updatedAt), "dd MMM, yyyy")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500">No students have been placed yet.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

