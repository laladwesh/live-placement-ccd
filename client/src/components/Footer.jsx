import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col sm:flex-row items-center justify-between">
          <div className="text-black text-sm mb-2 sm:mb-0">
            © {currentYear} Technical Team CCD IITG. All rights reserved.
          </div>
          <Link 
            to="/team" 
            className="text-black hover:text-gray-600 text-sm font-medium transition-colors"
          >
            Meet the Team
          </Link>
        </div>
      </div>
    </footer>
  );
}
