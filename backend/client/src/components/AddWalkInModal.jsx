// src/components/AddWalkInModal.jsx
import React, { useState } from "react";
import api from "../api/axios";

export default function AddWalkInModal({ companyId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    email: "",
    remarks: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      await api.post(`/poc/companies/${companyId}/walkin`, {
        email: formData.email.trim(),
        remarks: formData.remarks.trim() || undefined
      });
      // If parent provided an onSuccess handler, call it (some pages use onSuccess)
      if (typeof onSuccess === "function") {
        try { onSuccess(); } catch (e) { /* ignore */ }
      }
      // Close the modal
      onClose();
    } catch (err) {
      console.error("Error adding walk-in student:", err);
      setError(err.response?.data?.message || "Failed to add walk-in student");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Add Walk-In Student</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Student Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="student@iitg.ac.in"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Enter only the student's email; the system will fetch or create the student automatically.</p>
          </div>

          {/* Remarks (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes about the walk-in"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
