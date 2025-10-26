import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar({ user }) {
  console.log("navbar user is: ", user);

  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("jwt_token");
    navigate("/login");
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-md shadow-sm flex items-center justify-center text-white font-bold">PP</div>
              <span className="font-semibold text-slate-700">Placement Portal</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {(user.role === "admin" || user.role === "superadmin") && (
                  <Link
                  to="/admin"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                >
                  Admin Dashboard
                </Link>
                
                )}
                {(user.role === "poc" || user.role === "superadmin") && (
                  <Link
                  to="/poc"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                >
                  POC Dashboard
                </Link>
                
                )}
                {(user.role === "student" || user.role === "superadmin") && (
                  <Link
                  to="/student"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
                >
                  Student Dashboard
                </Link>
                
                )}
                <div className="hidden sm:block text-sm text-slate-600">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="h-10 w-20 px-3 py-1 rounded-full bg-red-500 text-white text-sm hover:bg-red-600"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div>
                <Link to="/login" className="px-3 py-1 rounded-md bg-primary text-white text-sm hover:bg-blue-600">Sign in</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
