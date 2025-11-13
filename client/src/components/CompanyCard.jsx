// src/components/CompanyCard.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditCompanyModal from "./EditCompanyModal";
import ConfirmDialog from "./ConfirmDialog";
import AlertModal from "./AlertModal";
import api from "../api/axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CompanyCard({ company, onUpdate, onDelete }) {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      
      // Fetch students data
      const res = await api.get(`/poc/companies/${company._id}/students`);
      const shortlists = res.data.shortlists || [];
      
      // Filter: Include SHORTLISTED, WAITLISTED, and all ROUNDS (R1, R2, R3, R4)
      // Exclude: REJECTED, students with OFFERS, students PLACED at this company
      const filteredStudents = shortlists.filter(s => {
        const isRejected = s.stage === 'REJECTED' || s.currentStage === 'REJECTED';
        const isOffered = s.isOffered;
        const isPlacedAtThisCompany = s.student?.isPlaced; // isPlaced is true only for students placed at THIS company
        
        return !isRejected && !isOffered && !isPlacedAtThisCompany;
      });

      // Sort by status (shortlisted first, then waitlisted, then rounds), then by name
      const sortedStudents = filteredStudents.sort((a, b) => {
        // Priority order: SHORTLISTED > WAITLISTED > R1 > R2 > R3 > R4
        const priority = {
          'SHORTLISTED': 1,
          'WAITLISTED': 2,
          'R1': 3,
          'R2': 4,
          'R3': 5,
          'R4': 6
        };
        
        const aPriority = priority[a.currentStage] || 999;
        const bPriority = priority[b.currentStage] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        return (a.student?.name || '').localeCompare(b.student?.name || '');
      });

      // Generate PDF
      const doc = new jsPDF();
      
            //IITG Placement Cell Header
            doc.setFontSize(16);
            doc.text("Indian Institute of Technology Guwahati", 105, 10, null, null, "center");
            
            //Confidentiality Notice
            doc.setFontSize(10);
            doc.text("Confidential - For Placement Use Only", 105, 16, null, null, "center");
            
            // Add title
            doc.setFontSize(18);
            doc.text(`Company - ${company.name} - Student List`, 105, 25, null, null, "center");
            
            // Add date and time
            doc.setFontSize(10);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 33);
      
      
      // Prepare table data
      const tableData = sortedStudents.map((s, index) => {
        let statusText = s.currentStage;
        if (s.currentStage === 'SHORTLISTED') statusText = 'Shortlisted';
        else if (s.currentStage === 'WAITLISTED') statusText = 'Waitlisted';
        else if (s.currentStage?.startsWith('R')) statusText = 'Shortlisted'; // Show rounds as Shortlisted in PDF
        
        return [
          index + 1,
          s.student?.name || 'N/A',
          s.student?.email || 'N/A',
          s.student?.phoneNumber || 'N/A',
          statusText
        ];
      });
      
      // Add table
      autoTable(doc, {
        startY: 35,
        head: [['#', 'Name', 'Email', 'Phone Number', 'Status']],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 40 },
          2: { cellWidth: 60 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30 }
        }
      });
      
      // Save PDF
      doc.save(`${company.name.replace(/[^a-z0-9]/gi, '_')}_students.pdf`);
      
    } catch (err) {
      console.error("Error downloading PDF:", err);
      setErrorAlert({
        show: true,
        message: err.response?.data?.message || "Failed to download student list"
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      setDeleting(true);
      await api.delete(`/admin/companies/${company._id}`);
      // Don't call onDelete() - let socket handle the refresh
    } catch (err) {
      console.error("Error deleting company:", err);
      setErrorAlert({
        show: true,
        message: err.response?.data?.message || "Failed to delete company"
      });
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
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="text-slate-400 hover:text-green-600 transition disabled:opacity-50"
              title="Download Student List (PDF)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
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
              onClick={() => setShowDeleteConfirm(true)}
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
              {company.POCs?.length || 0}
            </span>
          </div>
        </div>

        {/* POCs List */}
        {company.POCs && company.POCs.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-xs text-slate-500 mb-2">Assigned POCs:</div>
            <div className="space-y-1">
              {company.POCs.map(poc => (
                <div key={poc._id} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-medium">
                    {poc.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 truncate">{poc.name}</div>
                    <div className="text-xs text-slate-500 truncate">{poc.emailId}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t flex gap-2">
          <button 
            onClick={() => navigate(`/admin/companies/${company._id}`)}
            className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition font-medium flex items-center justify-center gap-1"
            title="Manage shortlist and upload CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Company
          </button>
          <button 
            onClick={() => navigate(`/poc/companies/${company._id}/students`)}
            className="flex-1 px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition font-medium flex items-center justify-center gap-1"
            title="View and manage students as POC"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Act as POC
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Company"
        message={`Are you sure you want to delete "${company.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />

      {/* Error Alert */}
      <AlertModal
        isOpen={errorAlert.show}
        onClose={() => setErrorAlert({ show: false, message: '' })}
        title="Error"
        message={errorAlert.message}
        type="error"
      />
    </>
  );
}
