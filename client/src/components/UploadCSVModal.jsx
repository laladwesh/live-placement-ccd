// src/components/UploadCSVModal.jsx
import React, { useState } from "react";
import api from "../api/axios";

export default function UploadCSVModal({ companyId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError("Please select a CSV file");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please select a CSV file");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const res = await api.post(
        `/admin/companies/${companyId}/shortlist/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResult(res.data);
      
      // If successful, close after 2 seconds
      // Don't call onSuccess() - let socket handle the refresh
      if (res.data.summary.failed === 0) {
        setTimeout(() => {
          onClose(); // Just close the modal
        }, 2000);
      }
    } catch (err) {
      console.error("Error uploading CSV:", err);
      setError(err.response?.data?.message || "Failed to upload CSV");
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `rollNumber,email,name,phoneNumber,status
210101001,student1@iitg.ac.in,Rahul Kumar,9876543210,shortlisted
210101002,student2@iitg.ac.in,Priya Sharma,9876543211,shortlisted
210101003,student3@iitg.ac.in,Amit Patel,9876543212,waitlisted`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-students.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Upload Student List (CSV)</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">CSV Format Instructions</h3>
            <p className="text-sm text-blue-800 mb-3">
              Your CSV file should have the following columns:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>rollNumber</strong> (required) - Student roll number (unique identifier)</li>
              <li><strong>email</strong> (required) - Student email address</li>
              <li><strong>name</strong> (optional) - Student full name</li>
              <li><strong>phoneNumber</strong> (optional) - Contact number</li>
              <li><strong>status</strong> (optional) - Either "shortlisted" or "waitlisted" (default: shortlisted)</li>
            </ul>
            <button
              onClick={downloadSampleCSV}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV
            </button>
          </div>

          {/* File Upload */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              {file && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Result Summary */}
            {result && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-medium text-green-900 mb-2">Upload Complete!</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p>✓ Total processed: {result.summary.total}</p>
                  <p>✓ Added: {result.summary.added}</p>
                  <p>✓ Updated: {result.summary.updated}</p>
                  {result.summary.failed > 0 && (
                    <p className="text-red-600">✗ Failed: {result.summary.failed}</p>
                  )}
                </div>

                {/* Show failed entries */}
                {result.details?.failed?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-300">
                    <p className="text-sm font-medium text-red-700 mb-2">Failed Entries:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {result.details.failed.map((item, idx) => (
                        <p key={idx} className="text-xs text-red-600">
                          {item.email}: {item.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {result.summary.failed === 0 && (
                  <p className="text-sm text-green-700 mt-2">
                    Closing in 2 seconds...
                  </p>
                )}
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
                disabled={loading || !file}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload CSV
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
