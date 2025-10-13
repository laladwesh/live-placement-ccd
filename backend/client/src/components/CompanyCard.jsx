// src/components/CompanyCard.jsx
import React, { useState } from "react";
import EditCompanyModal from "./EditCompanyModal";
import api from "../api/axios";

export default function CompanyCard({ company, onUpdate, onDelete }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/admin/companies/${company._id}`);
      // Don't call onDelete() - let socket handle the refresh
    } catch (err) {
      console.error("Error deleting company:", err);
      alert(err.response?.data?.message || "Failed to delete company");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
        {/* Company Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{company.name}</h3>
            {company.venue && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {company.venue}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="text-slate-400 hover:text-blue-600 transition"
              title="Edit"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-slate-400 hover:text-red-600 transition disabled:opacity-50"
              title="Delete"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        {company.description && (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2">{company.description}</p>
        )}

        {/* Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Max Rounds</span>
            <span className="font-medium text-slate-900">{company.maxRounds}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">POCs Assigned</span>
            <span className="font-medium text-slate-900">
              {company.pocs?.length || 0}
            </span>
          </div>
        </div>

        {/* POCs List */}
        {company.pocs && company.pocs.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-xs text-slate-500 mb-2">Assigned POCs:</div>
            <div className="space-y-1">
              {company.pocs.map(poc => (
                <div key={poc._id} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-medium">
                    {poc.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 truncate">{poc.name}</div>
                    <div className="text-xs text-slate-500 truncate">{poc.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t flex gap-2">
          <button 
            onClick={() => window.location.href = `/company/${company._id}`}
            className="flex-1 px-3 py-2 text-sm bg-slate-50 text-slate-700 rounded hover:bg-slate-100 transition"
          >
            View Details
          </button>
          <button 
            onClick={() => window.location.href = `/company/${company._id}`}
            className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
          >
            Manage Students
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditCompanyModal
          company={company}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            // Don't call onUpdate() - let socket handle the refresh
          }}
        />
      )}
    </>
  );
}
