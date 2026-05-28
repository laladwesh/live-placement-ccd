import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());

  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user);
      setUser(res.data.user);
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <div className="p-6 text-slate-600">Loading...</div>;

  return (
    <main className="px-6 py-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">
          {user.role === "admin" ? "Admin Details" : user.role === "poc" ? "POC Details" : "Student Details"}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-100 rounded">
            <div className="text-xs text-slate-500">Name</div>
            <div className="text-lg font-medium text-slate-800">{user.name}</div>
          </div>
          <div className="p-4 bg-slate-100 rounded">
            <div className="text-xs text-slate-500">Email</div>
            <div className="text-lg font-medium text-slate-800">{user.emailId}</div>
          </div>
          <div className="p-4 bg-slate-100 rounded">
            <div className="text-xs text-slate-500">Role</div>
            <div className="text-lg font-medium text-slate-800">{user.role}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

