// src/components/EditCompanyModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";

export default function EditCompanyModal({ company, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: company.name || "",
    venue: company.venue || "",
    description: company.description || "",
    maxRounds: company.maxRounds || 4,
    pocIds: company.POCs?.map(p => p._id) || [],
    newPocs: [] // Add state for creating new POCs
  });
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPOCs();
  }, []);

  const fetchPOCs = async () => {
    try {
      const res = await api.get("/admin/pocs");
      setPocs(res.data.pocs || []);
    } catch (err) {
      console.error("Error fetching POCs:", err);
      toast.error("Failed to load POCs");
    }
  };

  const filteredPocs = useMemo(() => {
    if (!searchQuery) return pocs;
    const q = searchQuery.trim().toLowerCase();
    return pocs.filter(p => (p.name || "").toLowerCase().includes(q));
  }, [pocs, searchQuery]);

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

  // --- NEW HANDLERS FOR CREATING POCS ---
  const handleAddNewPOC = () => {
    setFormData(prev => ({
      ...prev,
      newPocs: [...prev.newPocs, { name: "", emailId: "", phoneNo: "" }]
    }));
  };

  const handleNewPOCChange = (index, e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newPocs = [...prev.newPocs];
      newPocs[index][name] = value;
      return { ...prev, newPocs };
    });
  };

  const handleRemoveNewPOC = (index) => {
    setFormData(prev => {
      const newPocs = prev.newPocs.filter((_, i) => i !== index);
      return { ...prev, newPocs };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure newly created POCs are allowed by default when editing/updating a company
      const payload = {
        ...formData,
        newPocs: (formData.newPocs || []).map(p => ({ ...p, isAllowed: true }))
      };

      await api.patch(`/admin/companies/${company._id}`, payload);
      toast.success("Company updated successfully!");
      // Don't call onSuccess() - let socket handle the refresh
      onClose(); // Just close the modal
    } catch (err) {
      console.error("Error updating company:", err);
      toast.error(err.response?.data?.message || "Failed to update company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Edit Company</h2>
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

          {/* --- NEW SECTION: Create New POCs --- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Create & Assign New POCs
              </label>
              <button
                type="button"
                onClick={handleAddNewPOC}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + Add POC
              </button>
            </div>
            {formData.newPocs.map((poc, index) => (
              <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-3 relative">
                <button
                  type="button"
                  onClick={() => handleRemoveNewPOC(index)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="name"
                    value={poc.name}
                    onChange={(e) => handleNewPOCChange(index, e)}
                    placeholder="POC Name"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    name="emailId"
                    value={poc.emailId}
                    onChange={(e) => handleNewPOCChange(index, e)}
                    placeholder="POC Email"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <input
                  type="text"
                  name="phoneNo"
                  value={poc.phoneNo}
                  onChange={(e) => handleNewPOCChange(index, e)}
                  placeholder="Phone Number"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            ))}
          </div>

          {/* Assign POCs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign Existing POCs
            </label>
            {pocs.length === 0 ? (
              <p className="text-sm text-slate-500">No existing POCs available.</p>
            ) : (
              <div>
                <div className="mb-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search POCs by name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {filteredPocs.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">No POCs match your search.</div>
                  ) : (
                    filteredPocs.map(poc => (
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
                          <div className="text-xs text-slate-500">{poc.emailId}</div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          POC
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected POCs Summary */}
          {(formData.pocIds.length > 0 || formData.newPocs.length > 0) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-2">
                Assigned POCs ({formData.pocIds.length + formData.newPocs.length})
              </div>
              <div className="space-y-2">
                {/* Existing POCs */}
                {formData.pocIds.map(pocId => {
                  const poc = pocs.find(p => p._id === pocId) || company.POCs?.find(p => p._id === pocId);
                  return poc ? (
                    <div key={pocId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
                          {poc.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-slate-900 font-medium">{poc.name}</div>
                          <div className="text-xs text-slate-600">{poc.emailId}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePOCToggle(pocId)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ) : null;
                })}
                {/* New POCs */}
                {formData.newPocs.map((poc, index) => (
                  <div key={`new-${index}`} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
                        {poc.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="text-slate-900 font-medium">{poc.name || 'New POC'}</div>
                        <div className="text-xs text-slate-600">{poc.emailId || 'Pending...'}</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      New
                    </span>
                  </div>
                ))}
              </div>
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
              {loading ? "Updating..." : "Update Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
