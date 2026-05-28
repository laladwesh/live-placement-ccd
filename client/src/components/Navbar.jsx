import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

export default function Navbar({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("jwt_token");
    navigate("/login");
  };

  // Build nav links based on role
  const navLinks = [];
  if (user) {
    if (user.role === "admin" || user.role === "superadmin") {
      navLinks.push({ to: "/admin",           label: "Offer Management" });
      navLinks.push({ to: "/admin/company",   label: "Companies" });
      navLinks.push({ to: "/admin/students",  label: "Students" });
    }
    if (user.role === "admin" || user.role === "viewer") {
      navLinks.push({ to: "/intern-master-data", label: "Internship Data" });
    }
    if (user.role === "poc" || user.role === "superadmin") {
      navLinks.push({ to: "/poc", label: "POC Dashboard" });
    }
    if (user.role === "student" || user.role === "superadmin") {
      navLinks.push({ to: "/student", label: "My Shortlists" });
    }
    if (user.role === "viewer") {
      navLinks.push({ to: "/viewers/confirmed", label: "Confirmed Placements" });
    }
  }

  return (
    <header
      className="bg-white sticky top-0 z-50"
      style={{ boxShadow: "0px 0.3px 0.9px rgba(27,33,45,0.10), 0px 1.6px 3.6px rgba(27,33,45,0.13)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">

          {/* ── Logo ─────────────────────────────── */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 mr-6">
            <img
              src="https://www.iitg.ac.in/gate-jam/img/logo.png"
              alt="IITG Logo"
              className="h-[52px] w-[52px] object-contain"
            />
            <div className="leading-tight">
              <div
                className="font-bold text-base"
                style={{ color: "#1E2532", fontFamily: "Lato, sans-serif" }}
              >
                Live Placement Portal
              </div>
              <div className="text-xs" style={{ color: "#8D9096" }}>
                IIT Guwahati — CCD
              </div>
            </div>
          </Link>

          {/* ── Desktop nav links ─────────────────── */}
          <nav className="hidden sm:flex items-center flex-1 overflow-x-auto">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  "pp-nav-link" + (isActive ? " active" : "")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* ── User section ─────────────────────── */}
          {user ? (
            <div className="hidden sm:flex items-center gap-3 ml-auto flex-shrink-0 pl-4"
              style={{ borderLeft: "1px solid #E9E9EB" }}>
              <div className="text-right leading-tight">
                <div className="text-sm font-semibold" style={{ color: "#2164E8" }}>
                  {user.name}
                </div>
                <div className="text-xs uppercase tracking-wide" style={{ color: "#8D9096" }}>
                  {user.role}
                </div>
              </div>
              <button
                onClick={logout}
                className="pp-btn2 flex-shrink-0"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex ml-auto pl-4" style={{ borderLeft: "1px solid #E9E9EB" }}>
              <Link to="/login" className="pp-btn">Sign In</Link>
            </div>
          )}

          {/* ── Mobile hamburger ─────────────────── */}
          <button
            className="sm:hidden ml-auto p-2 rounded"
            style={{ color: "#494D57" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ───────────────────────── */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t" style={{ borderColor: "#E9E9EB" }}>
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-sm font-semibold rounded transition ${
                    isActive
                      ? "text-[#2164E8] bg-[#EFF6FC]"
                      : "text-[#353B47] hover:bg-[#EEF1F4]"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}

            {user ? (
              <div className="pt-3 mt-2" style={{ borderTop: "1px solid #E9E9EB" }}>
                <div className="px-3 mb-2">
                  <div className="text-sm font-semibold" style={{ color: "#2164E8" }}>{user.name}</div>
                  <div className="text-xs uppercase" style={{ color: "#8D9096" }}>{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 text-sm font-semibold rounded transition hover:bg-[#EEF1F4]"
                  style={{ color: "#353B47" }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="block px-3 py-2 text-sm font-semibold"
                style={{ color: "#2164E8" }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
