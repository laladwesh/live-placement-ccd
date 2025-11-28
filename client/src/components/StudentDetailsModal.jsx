import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';

const StudentDetailsModal = ({ isOpen, onClose, studentId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchDetails();
    }
  }, [isOpen, studentId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/poc/student/${studentId}/details`);
      setData(response.data);
    } catch (err) {
      console.error("Error fetching student details:", err);
      setError("Failed to load student details");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? `Details for ${data.student.name}` : "Student Details"}
      size="2xl"
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-center py-4">{error}</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Student Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-600">Email:</span>
                <span className="ml-2 text-gray-900">{data.student.email}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600">Phone:</span>
                <span className="ml-2 text-gray-900">{data.student.phone || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Companies List */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-3">Shortlisted Companies</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POCs</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.companies.map((company, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{company.companyName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${company.status === 'OFFERED' ? 'bg-green-100 text-green-800' : 
                            company.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                            'bg-blue-100 text-blue-800'}`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{company.slot}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{company.venue}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex flex-col space-y-1">
                          {company.pocs.map((poc, pIdx) => (
                            <div key={pIdx} className="text-xs">
                              <span className="font-medium">{poc.name}</span>
                              <span className="text-gray-400 mx-1">|</span>
                              <span>{poc.phone}</span>
                            </div>
                          ))}
                          {company.pocs.length === 0 && <span className="text-gray-400 italic">No POC assigned</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.companies.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-4 py-4 text-center text-sm text-gray-500">
                        No other shortlists found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default StudentDetailsModal;
