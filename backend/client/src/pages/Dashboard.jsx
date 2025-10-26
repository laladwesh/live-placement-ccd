import React, { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/users/me");
        setUser(res.data.user);
      } catch (err) {
        console.error("whoami error", err);
        localStorage.removeItem("jwt_token");
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar user={null} />
        <div className="max-w-4xl mx-auto p-6">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto py-8 px-4">
        <div className="bg-white shadow rounded-lg p-6 w-[100%]">
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              {user.role === "admin"
                ? "Admin Details"
                : user.role === "poc"
                ? "POC Details"
                : "Student Details"}
            </h1>
          </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4  w-[100%]">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Name</div>
              <div className="text-lg font-medium text-slate-800">{user.name}</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Email</div>
              <div className="text-lg font-medium text-slate-800">{user.emailId}</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Role</div>
              <div className="text-lg font-medium text-slate-800">{user.role}</div>
            </div>
          </div>

          {/* <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-700">Account details</h3>
            <div className="mt-3 text-sm text-slate-600">
              <div className="flex justify-between py-2 border-b">
                <div>Joined</div>
                <div>{user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</div>
              </div>
            </div>
          </div> */}

        </div>
      </main>
    </div>
  );
}
