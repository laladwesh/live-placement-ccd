// src/pages/StudentDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
//import ShortlistCard from "../components/ShortlistCard";
import { useSocket } from "../context/SocketContext";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // const [stats, setStats] = useState({
  //   total: 0,
  //   shortlisted: 0,
  //   waitlisted: 0,
  //   inInterview: 0
  // });
  const [shortlists, setShortlists] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("ALL");

  useEffect(() => {
    fetchUser();
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only fetch shortlists if user is not placed
    if (profile && !profile.isPlaced) {
      fetchShortlists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Socket.IO listeners - Silent background updates
  useEffect(() => {
    if (!socket || !user) return;

    // Join student's personal room
    socket.emit("join:student", user._id);

    // Silent refresh function - no loading screen
    const silentRefresh = async () => {
      try {
        // Refresh profile first to check placement status
        const profileRes = await api.get("/student/profile");
        setProfile(profileRes.data.profile);

        // Only fetch shortlists if not placed
        if (!profileRes.data.profile.isPlaced) {
          const res = await api.get("/student/shortlists");
          //setStats(res.data.stats);
          setShortlists(res.data.shortlists);
        }
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

  const fetchProfile = async () => {
    try {
      const res = await api.get("/student/profile");
      setProfile(res.data.profile);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShortlists = async () => {
    try {
      const res = await api.get("/student/shortlists");
      //setStats(res.data.stats);
      setShortlists(res.data.shortlists);
    } catch (err) {
      console.error("Error fetching shortlists:", err);
    }
  };

  const filteredShortlists = shortlists.filter((shortlist) => {
    const matchesSearch = shortlist.companyId?.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter = filterStage === "ALL" || shortlist.stage === filterStage || shortlist.status === filterStage;
    return matchesSearch && matchesFilter;
  });

  // const StatCard = ({ title, value, icon, color }) => (
  //   <div className={`bg-white border-l-4 ${color} rounded-lg p-4 shadow-sm`}>
  //     <div className="flex items-center justify-between">
  //       <div>
  //         <p className="text-sm text-slate-600 font-medium">{title}</p>
  //         <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  //       </div>
  //       <div className="text-3xl">{icon}</div>
  //     </div>
  //   </div>
  // );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-600 mt-4">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Placed Student View - Only show congratulations message
  if (profile?.isPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Navbar user={user} />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full text-center">
            <div className="mb-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">🎉</span>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Congratulations!</h1>
              <p className="text-xl text-slate-600 mb-8">You are successfully placed</p>
            </div>
            
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-8 text-white mb-6">
              <div className="text-5xl mb-4">🏢</div>
              <h2 className="text-3xl font-bold mb-2">
                {profile.placedCompany?.name || 'Company Name'}
              </h2>
              <p className="text-green-100">Your placement company</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-6">
              <p className="text-slate-600 mb-2">
                <span className="font-semibold text-slate-800">Student:</span> {profile.name}
              </p>
              <p className="text-slate-600">
                <span className="font-semibold text-slate-800">Email:</span> {profile.emailId}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unplaced Student View - Show full dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-slate-900">Live Interview Dashboard</h1>
          <p className="text-slate-600 mt-2">Track your placement journey and interview progress</p>
        </div>

        {/* Statistics Grid 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Applications" value={stats.total} icon="📊" color="border-purple-500" />
          <StatCard title="Shortlisted" value={stats.shortlisted} icon="📋" color="border-blue-500" />
          <StatCard title="Waitlisted" value={stats.waitlisted} icon="⏳" color="border-yellow-500" />
          <StatCard title="In Interview" value={stats.inInterview} icon="🎯" color="border-indigo-500" />
        </div> */}

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

            {/* Filter by Stage - Removed OFFERED and REJECTED */}
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
              </select>
            </div>
          </div>
        </div>

        {/* Shortlists Table */}
{filteredShortlists.length === 0 ? (
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

    <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Company Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Venue
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Current Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              POCs
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {filteredShortlists.map((shortlist) => (
            <tr key={shortlist._id} className="hover:bg-slate-50 transition-colors cursor-pointer">
              <td className="px-6 py-4 text-slate-900 font-medium">
                {shortlist.companyId?.name || "—"}
              </td>
              <td className="px-6 py-4 text-slate-700">
                {shortlist.companyId?.venue || "—"}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    shortlist.stage === "OFFERED" || shortlist.stage === "SELECTED"
                      ? "bg-green-100 text-green-800"
                      : shortlist.stage === "REJECTED"
                      ? "bg-red-100 text-red-800"
                      : shortlist.stage === "WAITLISTED"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {shortlist.stage || "Pending"}
                </span>
              </td>
              <td className="px-6 py-4 text-slate-700">
                {shortlist.companyId?.POCs?.length > 0 ? (
                    shortlist.companyId.POCs.map((poc) => (
                      <span key={poc._id} className="block">
                        {poc.name} : {poc.phoneNo}
                      </span>
                      ))):("—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}
      </main>
    </div>
  );
}