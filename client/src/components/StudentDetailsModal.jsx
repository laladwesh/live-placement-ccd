import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';

const StudentDetailsModal = ({ isOpen, onClose, studentId, isAdmin = false, isViewer = false }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const isPOC = !isAdmin && !isViewer;

  useEffect(() => {
    if (isOpen && studentId) fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = isAdmin
        ? `/admin/students/${studentId}/details`
        : isViewer
        ? `/viewers/student/${studentId}/details`
        : `/poc/student/${studentId}/details`;
      const response = await api.get(endpoint);
      setData(response.data);
    } catch (err) {
      setError("Failed to load student details");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Backend already deduplicates — just filter out blank entries
  const uniquePOCs = isPOC
    ? (data?.pocs || []).filter(p => p.name && p.name !== "N/A")
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? `${data.student.name}` : "Student Details"}
      size="2xl"
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="max-h-[65vh] overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="text-red-600 text-center py-6">{error}</div>
        ) : data ? (
          <div className="space-y-5">

            {/* Student contact card */}
            <div style={{ background: "#F8F9FB", border: "1px solid #E4E1E0", borderRadius: 6, padding: "14px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Student Contact
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: "#8D9096", fontSize: 12 }}>Email</span>
                  <div style={{ fontWeight: 600, color: "#1E2532" }}>{data.student.email || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#8D9096", fontSize: 12 }}>Phone</span>
                  <div style={{ fontWeight: 600, color: "#1E2532" }}>{data.student.phone || "—"}</div>
                </div>
                {(isAdmin || isViewer) && (
                  <>
                    <div>
                      <span style={{ color: "#8D9096", fontSize: 12 }}>Roll Number</span>
                      <div style={{ fontWeight: 600, color: "#1E2532", fontFamily: "monospace" }}>{data.student.rollNumber || "—"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#8D9096", fontSize: 12 }}>Programme</span>
                      <div style={{ fontWeight: 600, color: "#1E2532" }}>{data.student.programme || "—"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#8D9096", fontSize: 12 }}>Department</span>
                      <div style={{ fontWeight: 600, color: "#1E2532" }}>{data.student.department || "—"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#8D9096", fontSize: 12 }}>Discipline</span>
                      <div style={{ fontWeight: 600, color: "#1E2532" }}>{data.student.discipline || "—"}</div>
                    </div>
                    <div>
                      <span style={{ color: "#8D9096", fontSize: 12 }}>CPI</span>
                      <div style={{ fontWeight: 600, color: "#1E2532" }}>
                        {data.student.cpi !== null && data.student.cpi !== undefined ? data.student.cpi : "—"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* POC view: flat list of POC contacts — no company names revealed */}
            {isPOC && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  POC Contacts for this Student
                </p>
                <p style={{ fontSize: 12, color: "#8D9096", marginBottom: 10 }}>
                  Other POCs assigned to companies shortlisting this student — call them to coordinate.
                </p>
                {uniquePOCs.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "#8D9096", fontSize: 13, background: "#F8F9FB", border: "1px solid #E4E1E0", borderRadius: 4 }}>
                    No other POCs found for this student.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {uniquePOCs.map((poc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", border: "1px solid #E4E1E0", borderRadius: 4 }}>
                        {/* Avatar */}
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E8EDF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#14213D", flexShrink: 0 }}>
                          {poc.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#1E2532" }}>{poc.name}</div>
                          {poc.phone && poc.phone !== "N/A" && (
                            <a href={`tel:${poc.phone}`} style={{ fontSize: 13, color: "#14213D", textDecoration: "none", fontWeight: 500 }}>
                              {poc.phone}
                            </a>
                          )}
                        </div>
                        {poc.phone && poc.phone !== "N/A" && (
                          <a
                            href={`tel:${poc.phone}`}
                            style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, background: "#14213D", color: "#fff", borderRadius: 2, textDecoration: "none", flexShrink: 0 }}
                          >
                            Call
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin / Viewer view: full company table */}
            {(isAdmin || isViewer) && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#8D9096", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  Shortlisted Companies
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Venue</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">POCs</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.companies.map((company, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{company.companyName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full
                              ${company.status === "OFFERED" ? "bg-green-100 text-green-800" :
                                company.status === "REJECTED" ? "bg-red-100 text-red-800" :
                                "bg-blue-100 text-blue-800"}`}>
                              {company.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{company.venue}</td>
                          <td className="px-4 py-3 text-gray-500">
                            <div className="flex flex-col gap-1">
                              {company.pocs.map((poc, pIdx) => (
                                <div key={pIdx} className="text-xs">
                                  <span className="font-medium">{poc.name}</span>
                                  <span className="text-gray-400 mx-1">·</span>
                                  <span>{poc.phone}</span>
                                </div>
                              ))}
                              {company.pocs.length === 0 && <span className="text-gray-400 italic text-xs">No POC</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {data.companies.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                            No shortlists found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm font-medium"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default StudentDetailsModal;
