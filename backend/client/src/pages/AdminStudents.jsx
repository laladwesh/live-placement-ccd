// src/pages/AdminStudents.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import AddStudentToMasterModal from "../components/AddStudentToMasterModal";

export default function AdminStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const res = await api.get("/users/me");
      
      if (res.data.user.role !== "admin") {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      navigate("/login");
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/students");
      setStudents(res.data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error("Please select a CSV file");
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/admin/students/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setUploadResult(res.data);
      setSelectedFile(null);
      
      // Clear file input
      document.getElementById("csvFileInput").value = "";
      
      // Refresh students list
      fetchStudents();
    } catch (err) {
      console.error("Error uploading CSV:", err);
      setUploadResult({
        success: false,
        message: err.response?.data?.message || "Failed to upload CSV",
        error: err.response?.data?.error
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `email,name,rollNumber,phoneNo
student1@iitg.ac.in,Student One,210101001,9876543210
student2@iitg.ac.in,Student Two,210101002,9876543211
student3@iitg.ac.in,Student Three,210101003,9876543212`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-students.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Student Management</h1>
          <p className="text-slate-600 mt-1">Upload and manage student data</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Upload Students CSV</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Student Manually
            </button>
          </div>
          
          <div className="space-y-4">
            {/* File Input */}
            <div className="flex items-center gap-4">
              <input
                id="csvFileInput"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            </div>

            {/* Download Sample */}
            <div className="flex items-center gap-2">
              <button
                onClick={downloadSampleCSV}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                📥 Download Sample CSV Format
              </button>
              <span className="text-sm text-slate-500">
                (Format: email,name,rollNumber,phoneNo)
              </span>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`p-4 rounded-lg ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h3 className={`font-semibold mb-2 ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>
                  {uploadResult.success ? '✅ Upload Successful' : '❌ Upload Failed'}
                </h3>
                <p className={`text-sm ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {uploadResult.message}
                </p>
                
                {uploadResult.summary && (
                  <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                    <div className="bg-white p-2 rounded">
                      <div className="font-semibold text-slate-900">{uploadResult.summary.total}</div>
                      <div className="text-slate-600">Total</div>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <div className="font-semibold text-green-600">{uploadResult.summary.created}</div>
                      <div className="text-slate-600">Created</div>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <div className="font-semibold text-blue-600">{uploadResult.summary.updated}</div>
                      <div className="text-slate-600">Updated</div>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <div className="font-semibold text-yellow-600">{uploadResult.summary.skipped}</div>
                      <div className="text-slate-600">Skipped</div>
                    </div>
                  </div>
                )}

                {uploadResult.details?.errors?.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold text-red-900 mb-1">Errors:</p>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {uploadResult.details.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-slate-900">All Students ({students.length})</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No students found. Upload a CSV file to add students.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Roll Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Shortlisted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.map((student) => (
                    <tr key={student._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {student.userId?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.userId?.emailId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.rollNumber || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.userId?.phoneNo || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {student.shortlistedCompanies?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.isPlaced ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Placed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">
                            Not Placed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentToMasterModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchStudents();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
