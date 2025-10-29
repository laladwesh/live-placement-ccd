import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar({ user }) {
  // console.log("navbar user is: ", user);/

  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("jwt_token");
    navigate("/login");
  };

  return (
    <header className="bg-white  border-b-2 border-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-3 group">
              <img 
                src="https://www.iitg.ac.in/gate-jam/img/logo.png" 
                alt="IIT Guwahati Logo" 
                className="h-14 w-14 object-contain rounded-full shadow-md group-hover:shadow-lg transition-shadow"
              />
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-lg tracking-tight">Live Placement Sheet</span>
                <span className="text-slate-600 text-xs font-medium">IIT Guwahati</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {(user.role === "admin" || user.role === "superadmin") && (
                  <Link
                  to="/admin"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  Admin Dashboard
                </Link>
                
                )}
                {(user.role === "poc" || user.role === "superadmin") && (
                  <Link
                  to="/poc"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  POC Dashboard
                </Link>
                
                )}
                {(user.role === "student" || user.role === "superadmin") && (
                  <Link
                  to="/student"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  Student Dashboard
                </Link>
                
                )}
                <div className="hidden sm:block text-sm text-slate-700 border-l border-slate-300 pl-4 ml-2">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all shadow-sm hover:shadow-md"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div>
                <Link to="/login" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md">Sign In</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
