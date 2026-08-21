// src/components/CompanyCard.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditCompanyModal from "./EditCompanyModal";
import ConfirmDialog from "./ConfirmDialog";
import AlertModal from "./AlertModal";
import api from "../api/axios";
import { getCachedUser } from "../utils/userCache";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  EnvironmentOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  EyeOutlined,
  UserAddOutlined,
  SyncOutlined,
  UserOutlined,
} from "@ant-design/icons";

// user is read from localStorage cache — no API call per card
export default function CompanyCard({ company, onUpdate, onDelete, user: userProp }) {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [downloading, setDownloading] = useState(false);
  const [syncingShortlist, setSyncingShortlist] = useState(false);
  const [shortlistSyncResult, setShortlistSyncResult] = useState(null);
  // Prefer prop passed by parent; fall back to cache (never hits API)
  const user = userProp ?? getCachedUser();

  const handleSyncShortlist = async () => {
    setSyncingShortlist(true);
    setShortlistSyncResult(null);
    try {
      const res = await api.post(`/admin/sync/companies/${company._id}/shortlist`);
      setShortlistSyncResult(res.data);
      if (onUpdate) onUpdate();
    } catch (err) {
      setShortlistSyncResult({ error: err.response?.data?.message || "Sync failed" });
    } finally {
      setSyncingShortlist(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      
      // Fetch students data
      const res = await api.get(`/poc/companies/${company._id}/students`);
      const shortlists = res.data.shortlists || [];
      
      // Include all non-rejected students (including placed students).
      // Treat OFFERED (unconfirmed offer) as SHORTLISTED for sorting purposes.
      const filteredStudents = shortlists.filter(s => {
        const isRejected = s.stage === 'REJECTED' || s.currentStage === 'REJECTED';
        return !isRejected;
      });

      // Group students: Shortlisted (including OFFERED and rounds) -> Waitlisted -> Placed
      // Preserve original order within each group (stable grouping)
      const shortlistedGroup = [];
      const waitlistedGroup = [];
      const placedGroup = [];

      filteredStudents.forEach(s => {
        // Consider student placed if they are placed at THIS company (student.isPlaced)
        // or if they are placed somewhere else (isStudentPlaced). Both should be
        // grouped into the Placed section in the PDF and shown last.
        if (s.student?.isPlaced || s.isStudentPlaced) {
          placedGroup.push(s);
        } else {
          const stage = (s.currentStage || '').toUpperCase();
          if (stage === 'WAITLISTED') {
            waitlistedGroup.push(s);
          } else {
            // Treat SHORTLISTED, R1-R4, OFFERED etc. as shortlisted group
            shortlistedGroup.push(s);
          }
        }
      });

      const sortedStudents = [...shortlistedGroup, ...waitlistedGroup, ...placedGroup];

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
        // Determine display status for PDF
        let statusText = '';

        if (s.student?.isPlaced || s.isStudentPlaced) {
          // If student is placed at this company, student.isPlaced will be true.
          // If they are placed at another company, the API provides `studentPlacedCompany`.
          if (s.student?.isPlaced) {
            statusText = 'Placed';
          } else {
            statusText = s.studentPlacedCompany ? `Placed` : 'Placed';
          }
        } else {
          const stage = (s.currentStage || '').toUpperCase();
          if (stage === 'SHORTLISTED' || stage.startsWith('R') || stage === 'OFFERED') {
            // Treat rounds and OFFERED as Shortlisted
            statusText = 'Shortlisted';
          } else if (stage === 'WAITLISTED') {
            statusText = 'Waitlisted';
          } else {
            statusText = stage || 'Shortlisted';
          }
        }

        // For placed students, do not show the placed company name (per request).
        // The table currently has columns: #, Name, Email, Phone, Status
        // We will keep those columns and ensure Status shows 'Placed' for placed students.

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
                <EnvironmentOutlined />
                {company.venue}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              title="Download Student List (PDF)"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 }}
            >
              <DownloadOutlined />
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="text-slate-400 hover:text-slate-600 transition"
              title="Edit"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 }}
            >
              <EditOutlined />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              title="Delete"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 }}
            >
              <DeleteOutlined />
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
                  <div style={{ width: 24, height: 24, background: '#E9E2DF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14213D', fontSize: 13, fontWeight: 600 }}>
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

        {/* Shortlist sync result */}
        {shortlistSyncResult && (
          <div className={`mt-3 px-3 py-1.5 rounded text-xs ${shortlistSyncResult.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
            {shortlistSyncResult.error
              ? shortlistSyncResult.error
              : `${shortlistSyncResult.added} added, ${shortlistSyncResult.skipped} skipped`}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/admin/companies/${company._id}`)}
            title="Manage shortlist and upload CSV"
            className="pp-btn2 flex-1"
            style={{ minWidth: 0, fontSize: 13 }}
          >
            <SettingOutlined /> Manage
          </button>
          <button
            onClick={() => navigate(`/poc/companies/${company._id}/students`)}
            title="View and manage students as POC"
            className="pp-btn2 flex-1"
            style={{ minWidth: 0, fontSize: 13 }}
          >
            <EyeOutlined /> POC View
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            title="Assign existing or new POCs to this company"
            className="pp-btn2 flex-1"
            style={{ minWidth: 0, fontSize: 13 }}
          >
            <UserAddOutlined /> {company.POCs?.length ? "POCs" : "Assign POC"}
          </button>
          {company.placementPortalJobId && (user?.role === "admin" || user?.role === "superadmin") && (
            <button
              onClick={handleSyncShortlist}
              disabled={syncingShortlist}
              title="Sync interview shortlist from placement portal"
              className="pp-btn2 flex-1 disabled:opacity-50"
              style={{ minWidth: 0, fontSize: 13 }}
            >
              <SyncOutlined spin={syncingShortlist} /> Sync
            </button>
          )}
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
