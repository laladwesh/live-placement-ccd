// src/components/AddCompanyModal.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";

export default function AddCompanyModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    venue: "",
    description: "",
    maxRounds: 4,
    pocIds: []
  });
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPOCs();
  }, []);

  const fetchPOCs = async () => {
    try {
      const res = await api.get("/admin/pocs");
      setPocs(res.data.pocs || []);
    } catch (err) {
      console.error("Error fetching POCs:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePOCToggle = (pocId) => {
    setFormData(prev => {
      const pocIds = prev.pocIds.includes(pocId)
        ? prev.pocIds.filter(id => id !== pocId)
        : [...prev.pocIds, pocId];
      return { ...prev, pocIds };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post("/admin/companies", formData);
      // Don't call onSuccess() - let socket handle the refresh
      onClose(); // Just close the modal
    } catch (err) {
      console.error("Error creating company:", err);
      setError(err.response?.data?.message || "Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Add New Company</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Google, Microsoft"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Venue
            </label>
            <input
              type="text"
              name="venue"
              value={formData.venue}
              onChange={handleChange}
              placeholder="e.g., Admin Building, Room 101"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description about the company..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Rounds */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Maximum Rounds
            </label>
            <select
              name="maxRounds"
              value={formData.maxRounds}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Round</option>
              <option value={2}>2 Rounds</option>
              <option value={3}>3 Rounds</option>
              <option value={4}>4 Rounds</option>
            </select>
          </div>

          {/* Assign POCs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign POCs
            </label>
            {pocs.length === 0 ? (
              <p className="text-sm text-slate-500">No POCs available. Create POC users first.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {pocs.map(poc => (
                  <label
                    key={poc._id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.pocIds.includes(poc._id)}
                      onChange={() => handlePOCToggle(poc._id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{poc.name}</div>
                      <div className="text-xs text-slate-500">{poc.email}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      {poc.role}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
