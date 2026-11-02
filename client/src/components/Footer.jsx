import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { pathname } = useLocation();

  const onLoginPage = pathname === "/login" || pathname === "/";

  if (onLoginPage) {
    return (
      <footer className="absolute bottom-0 left-0 right-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex flex-col sm:flex-row items-center justify-between">
            <div className="text-xs mb-1 sm:mb-0" style={{ color: "rgba(255,255,255,0.7)" }}>
              © {currentYear} Technical Team CCD IITG. All rights reserved.
            </div>
            <Link
              to="/team"
              className="text-xs font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Meet the Team
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col sm:flex-row items-center justify-between">
          <div className="text-black text-sm mb-2 sm:mb-0">
            © {currentYear} Technical Team CCD IITG. All rights reserved.
          </div>
          <Link to="/team" className="text-black hover:text-gray-600 text-sm font-medium transition-colors">
            Meet the Team
          </Link>
        </div>
      </div>
    </footer>
  );
}
