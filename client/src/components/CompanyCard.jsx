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

  const iconBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#8D9096', fontSize: 16, padding: '2px 4px',
    display: 'inline-flex', alignItems: 'center', transition: 'color .15s',
  };

  return (
    <>
      <div style={{
        background: '#fff',
        border: '1px solid #E4E1E0',
        borderRadius: 2,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#161B22', lineHeight: 1.3 }}>
              {company.name}
            </div>
            {company.venue && (
              <div style={{ fontSize: 12, color: '#8D9096', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <EnvironmentOutlined style={{ fontSize: 11 }} />
                {company.venue}
              </div>
            )}
          </div>
          {/* Icon-only toolbar */}
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button onClick={handleDownloadPDF} disabled={downloading} title="Download student list (PDF)"
              style={{ ...iconBtn, opacity: downloading ? 0.4 : 1 }}
              onMouseOver={e => e.currentTarget.style.color = '#14213D'}
              onMouseOut={e => e.currentTarget.style.color = '#8D9096'}
            ><DownloadOutlined /></button>
            <button onClick={() => setShowEditModal(true)} title="Edit / assign POCs"
              style={iconBtn}
              onMouseOver={e => e.currentTarget.style.color = '#14213D'}
              onMouseOut={e => e.currentTarget.style.color = '#8D9096'}
            ><EditOutlined /></button>
            <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} title="Delete company"
              style={{ ...iconBtn, opacity: deleting ? 0.4 : 1 }}
              onMouseOver={e => e.currentTarget.style.color = '#D83B01'}
              onMouseOut={e => e.currentTarget.style.color = '#8D9096'}
            ><DeleteOutlined /></button>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#666B72' }}>
          <span>Rounds: <strong style={{ color: '#33383F' }}>{company.maxRounds}</strong></span>
          <span>POCs: <strong style={{ color: '#33383F' }}>{company.POCs?.length || 0}</strong></span>
          {company.description && (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {company.description}
            </span>
          )}
        </div>

        {/* POC avatars */}
        {company.POCs && company.POCs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {company.POCs.map(poc => (
              <div key={poc._id} title={`${poc.name} · ${poc.emailId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#494D57',
                  background: '#F4F2F1', padding: '2px 8px', borderRadius: 2 }}>
                <div style={{ width: 18, height: 18, background: '#E9E2DF', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#14213D', flexShrink: 0 }}>
                  {poc.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {poc.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sync result */}
        {shortlistSyncResult && (
          <div style={{ fontSize: 12, padding: '4px 8px',
            background: shortlistSyncResult.error ? '#FFF4F2' : '#F0F9F0',
            color: shortlistSyncResult.error ? '#D83B01' : '#107C10',
            border: `1px solid ${shortlistSyncResult.error ? '#FBCDC2' : '#C6EFCE'}`,
          }}>
            {shortlistSyncResult.error
              ? shortlistSyncResult.error
              : `Synced — ${shortlistSyncResult.added} added, ${shortlistSyncResult.skipped} skipped`}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #E4E1E0', paddingTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`/admin/companies/${company._id}`)}
            className="pp-btn" style={{ flex: '1 1 auto', fontSize: 12, height: 30, whiteSpace: 'nowrap' }}
            title="Manage shortlist and upload CSV">
            <SettingOutlined /> Manage
          </button>
          <button onClick={() => navigate(`/poc/companies/${company._id}/students`)}
            className="pp-btn2" style={{ flex: '1 1 auto', fontSize: 12, height: 30, whiteSpace: 'nowrap' }}
            title="View students as POC">
            <EyeOutlined /> POC View
          </button>
          <button onClick={() => setShowEditModal(true)}
            className="pp-btn2" style={{ flex: '1 1 auto', fontSize: 12, height: 30, whiteSpace: 'nowrap' }}
            title="Assign POCs">
            <UserAddOutlined /> POCs
          </button>
          {company.placementPortalJobId && (user?.role === "admin" || user?.role === "superadmin") && (
            <button onClick={handleSyncShortlist} disabled={syncingShortlist}
              className="pp-btn2" style={{ flex: '1 1 auto', fontSize: 12, height: 30, whiteSpace: 'nowrap', opacity: syncingShortlist ? 0.6 : 1 }}
              title="Sync shortlist from placement portal">
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
