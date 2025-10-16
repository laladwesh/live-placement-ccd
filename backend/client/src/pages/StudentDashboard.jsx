// src/pages/StudentDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import ShortlistCard from "../components/ShortlistCard";
import { useSocket } from "../context/SocketContext";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    shortlisted: 0,
    waitlisted: 0,
    inInterview: 0,
    offered: 0,
    rejected: 0
  });
  const [shortlists, setShortlists] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("ALL");

  useEffect(() => {
    fetchUser();
    fetchShortlists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket.IO listeners - Silent background updates
  useEffect(() => {
    if (!socket || !user) return;

    // Join student's personal room
    socket.emit("join:student", user._id);

    // Silent refresh function - no loading screen
    const silentRefresh = async () => {
      try {
        const res = await api.get("/student/shortlists");
        setStats(res.data.stats);
        setShortlists(res.data.shortlists);
      } catch (err) {
        console.error("Silent refresh error:", err);
      }
    };

    // Listen for shortlist updates
    socket.on("shortlist:update", (data) => {
      console.log("📡 Shortlist update received:", data);
      silentRefresh(); // Silent background refresh
    });

    // Listen for new offers
    socket.on("offer:created", (data) => {
      console.log("🎉 Offer created:", data);
      silentRefresh();
    });

    // Listen for student added/removed
    socket.on("student:added", (data) => {
      console.log("📌 Student added:", data);
      if (data.student === user._id) {
        silentRefresh();
      }
    });

    socket.on("student:removed", (data) => {
      console.log("🗑️ Student removed:", data);
      silentRefresh();
    });

    // Cleanup
    return () => {
      socket.emit("leave:student", user._id);
      socket.off("shortlist:update");
      socket.off("offer:created");
      socket.off("student:added");
      socket.off("student:removed");
    };
  }, [socket, user]);

  const fetchUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data.user);
      
      // Redirect if not a student
      if (res.data.user.role !== "student" && res.data.user.role !== "admin") {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      navigate("/login");
    }
  };

  const fetchShortlists = async () => {
    setLoading(true);
    try {
      const res = await api.get("/student/shortlists");
      setStats(res.data.stats);
      setShortlists(res.data.shortlists);
    } catch (err) {
      console.error("Error fetching shortlists:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredShortlists = shortlists.filter((shortlist) => {
    const matchesSearch = shortlist.companyId?.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter = filterStage === "ALL" || shortlist.stage === filterStage;
    return matchesSearch && matchesFilter;
  });

  const StatCard = ({ title, value, icon, color }) => (
    <div className={`bg-white border-l-4 ${color} rounded-lg p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">My Placement Dashboard</h1>
          <p className="text-slate-600 mt-2">Track your placement journey and interview progress</p>
        </div>

        {/* Placement Status Alert */}
        {user?.isPlaced && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="font-semibold text-green-800">Congratulations! You are placed!</h3>
              <p className="text-sm text-green-700">You cannot participate in further placements.</p>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard title="Total Applications" value={stats.total} icon="📊" color="border-blue-500" />
          <StatCard title="Shortlisted" value={stats.shortlisted} icon="📋" color="border-blue-400" />
          <StatCard title="Waitlisted" value={stats.waitlisted} icon="⏳" color="border-yellow-500" />
          <StatCard title="In Interview" value={stats.inInterview} icon="🎯" color="border-purple-500" />
          <StatCard title="Offers Received" value={stats.offered} icon="🎉" color="border-green-500" />
          <StatCard title="Rejected" value={stats.rejected} icon="❌" color="border-red-500" />
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter by Stage */}
            <div className="md:w-64">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Stages</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="WAITLISTED">Waitlisted</option>
                <option value="R1">Round 1</option>
                <option value="R2">Round 2</option>
                <option value="R3">Round 3</option>
                <option value="R4">Round 4</option>
                <option value="OFFERED">Offered</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shortlists Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading your applications...</p>
          </div>
        ) : filteredShortlists.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {searchTerm || filterStage !== "ALL" ? "No matching applications" : "No applications yet"}
            </h3>
            <p className="text-slate-600">
              {searchTerm || filterStage !== "ALL"
                ? "Try adjusting your search or filter criteria"
                : "You haven't been shortlisted for any company yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-slate-600">
              Showing {filteredShortlists.length} of {shortlists.length} applications
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShortlists.map((shortlist) => (
                <ShortlistCard key={shortlist._id} shortlist={shortlist} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
