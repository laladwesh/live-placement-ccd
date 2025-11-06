// src/components/ShortlistCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function ShortlistCard({ shortlist }) {
  const navigate = useNavigate();

  const getStageColor = (stage) => {
    const colors = {
      SHORTLISTED: "bg-blue-100 text-blue-800 border-blue-200",
      WAITLISTED: "bg-yellow-100 text-yellow-800 border-yellow-200",
      R1: "bg-purple-100 text-purple-800 border-purple-200",
      R2: "bg-purple-100 text-purple-800 border-purple-200",
      R3: "bg-purple-100 text-purple-800 border-purple-200",
      R4: "bg-purple-100 text-purple-800 border-purple-200",
      OFFERED: "bg-green-100 text-green-800 border-green-200",
      REJECTED: "bg-red-100 text-red-800 border-red-200"
    };
    return colors[stage] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Check if shortlist is offered
  const stage = shortlist.isOffered ? "OFFERED" : shortlist.stage;

  const getStageIcon = (stage) => {
    const icons = {
      SHORTLISTED: "",
      WAITLISTED: "",
      R1: "",
      R2: "",
      R3: "",
      R4: "",
      OFFERED: "",
      REJECTED: ""
    };
    return icons[stage] || "";
  };

  const formatCTC = (ctc) => {
    if (!ctc) return "Not specified";
    return `₹${ctc} LPA`;
  };

  const formatDate = (date) => {
    if (!date) return "TBD";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div
      onClick={() => navigate(`/student/shortlist/${shortlist._id}`)}
      className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition cursor-pointer"
    >
      {/* Company Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {shortlist.companyId?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900">
              {shortlist.companyId?.name}
            </h3>
            <p className="text-sm text-slate-500">
              {shortlist.companyId?.jobRole || "Software Engineer"}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStageColor(stage)}`}>
          {getStageIcon(stage)} {stage}
        </span>
      </div>

      {/* Company Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="font-medium">CTC:</span>
          <span>{formatCTC(shortlist.companyId?.ctc)}</span>
        </div>
        {shortlist.companyId?.location && (
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-medium">Location:</span>
            <span>{shortlist.companyId.location}</span>
          </div>
        )}
        {shortlist.companyId?.visitDate && (
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-medium">Visit Date:</span>
            <span>{formatDate(shortlist.companyId.visitDate)}</span>
          </div>
        )}
      </div>

      {/* Remarks */}
      {shortlist.remarks && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-sm text-slate-500 italic">
            Remarks: {shortlist.remarks}
          </p>
        </div>
      )}

      {/* View Details Link */}
      <div className="mt-4 flex items-center justify-end text-blue-600 text-sm font-medium">
        <span>View Details</span>
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
