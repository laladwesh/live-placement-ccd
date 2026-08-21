// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Table, Input, Tabs, Button, Tag, Select, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import api from "../api/axios";
import ConfirmDialog from "../components/ConfirmDialog";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";
import InputModal from "../components/InputModal";
import StudentDetailsModal from "../components/StudentDetailsModal";
import { useSocket } from "../context/SocketContext";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [user, setUser]       = useState(() => getCachedUser());
  const [loading, setLoading] = useState(true);
  const [pendingOffers, setPendingOffers]     = useState([]);
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [rejectedOffers, setRejectedOffers]   = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [processing, setProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [cpiMin, setCpiMin] = useState("");
  const [cpiMax, setCpiMax] = useState("");
  const [tempProgramme, setTempProgramme] = useState("");
  const [tempDepartment, setTempDepartment] = useState("");
  const [tempCpiMin, setTempCpiMin] = useState("");
  const [tempCpiMax, setTempCpiMax] = useState("");
  const [programmesList, setProgrammesList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [programmesAll, setProgrammesAll] = useState([]);
  const [departmentsAll, setDepartmentsAll] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [companiesAll, setCompaniesAll] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [tempCompany, setTempCompany] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, type: null, offerId: null, studentName: '', companyName: '',
  });
  const [rejectReasonModal, setRejectReasonModal] = useState({ isOpen: false, offerId: null });

  // ── Auth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) return;
    api.get("/users/me").then(res => {
      setCachedUser(res.data.user);
      setUser(res.data.user);
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user]); // eslint-disable-line

  useEffect(() => { fetchOffers(); }, []); // eslint-disable-line

  // ── Socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit("join:admin");
    const refresh = () => fetchOffers();
    const newOffer = (data) => { toast.success(`New offer pending: ${data.companyName}`); fetchOffers(); };
    socket.on("offer:created",       newOffer);
    socket.on("offer:status-update", refresh);
    socket.on("offer:approved",      refresh);
    socket.on("offer:rejected",      refresh);
    socket.on("offer:reverted", (data) => { toast(`Offer reverted: ${data.companyName}`, { icon: '🔄' }); fetchOffers(); });
    return () => {
      socket.off("offer:created");
      socket.off("offer:status-update");
      socket.off("offer:approved");
      socket.off("offer:rejected");
      socket.off("offer:reverted");
    };
  }, [socket]); // eslint-disable-line

  // ── Data ──────────────────────────────────────────────────────────────
  const fetchOffers = async (overrideFilters = null) => {
    setLoading(true);
    try {
      const params = {};
      const f = overrideFilters || { programme: programmeFilter, department: departmentFilter, cpiMin, cpiMax };
      if (f.programme) params.programme = f.programme;
      if (f.department) params.department = f.department;
      if (f.cpiMin) params.cpiMin = f.cpiMin;
      if (f.cpiMax) params.cpiMax = f.cpiMax;
      const [pendingRes, confirmedRes] = await Promise.all([
        api.get("/admin/offers/pending"),
        api.get("/admin/offers/confirmed", { params }),
      ]);
      setPendingOffers(pendingRes.data.offers || []);
      const allConfirmed = confirmedRes.data.offers || [];
      const confirmedList = allConfirmed.filter(o =>
        o.approvalStatus === "APPROVED" ||
        (o.approvalStatus === "REJECTED" && o.remarks?.toLowerCase().includes("auto-rejected"))
      );
      const rejectedList = allConfirmed.filter(o =>
        o.approvalStatus === "REJECTED" &&
        (!o.remarks || !o.remarks.toLowerCase().includes("auto-rejected"))
      );
      const appliedCompany = (overrideFilters?.company) ? overrideFilters.company : companyFilter;
      if (appliedCompany?.trim()) {
        const lc = appliedCompany.toLowerCase();
        setConfirmedOffers(confirmedList.filter(o => o.companyId?.name?.toLowerCase().includes(lc)));
        setRejectedOffers(rejectedList.filter(o => o.companyId?.name?.toLowerCase().includes(lc)));
      } else {
        setConfirmedOffers(confirmedList);
        setRejectedOffers(rejectedList);
      }
      try {
        const progs = new Set(), depts = new Set(), comps = new Set();
        allConfirmed.forEach(o => {
          if (o.studentId?.programme) progs.add(o.studentId.programme);
          if (o.studentId?.department) depts.add(o.studentId.department);
          if (o.companyId?.name) comps.add(o.companyId.name);
        });
        const pa = Array.from(progs).sort(), da = Array.from(depts).sort(), ca = Array.from(comps).sort();
        setProgrammesList(pa); setDepartmentsList(da); setCompaniesList(ca);
        if (!overrideFilters || Object.keys(overrideFilters).length === 0) {
          if (programmesAll.length === 0) setProgrammesAll(pa);
          if (departmentsAll.length === 0) setDepartmentsAll(da);
          if (companiesAll.length === 0) setCompaniesAll(ca);
        }
      } catch { /* ignore */ }
    } catch (err) {
      console.error("Error fetching offers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (offerId) => {
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/approve`);
      await fetchOffers();
      toast.success("Offer approved!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve offer");
    } finally {
      setProcessing(null);
      setConfirmDialog({ isOpen: false, type: null, offerId: null, studentName: '', companyName: '' });
    }
  };

  const handleReject = async (offerId, reason = '') => {
    try {
      setProcessing(offerId);
      await api.post(`/admin/offers/${offerId}/reject`, { reason });
      await fetchOffers();
      toast.success("Offer rejected");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject offer");
    } finally {
      setProcessing(null);
      setRejectReasonModal({ isOpen: false, offerId: null });
    }
  };

  const openRejectReasonModal = (offerId) => setRejectReasonModal({ isOpen: true, offerId });

  // ── Group + Filter ────────────────────────────────────────────────────
  const groupOffersByStudent = (offers) => {
    const grouped = {};
    offers.forEach(offer => {
      const id = offer.studentId?._id;
      if (!id) return;
      if (!grouped[id]) grouped[id] = { student: offer.studentId, offers: [] };
      grouped[id].offers.push(offer);
    });
    return Object.values(grouped);
  };

  const filterBySearch = (groups) => {
    if (!searchTerm.trim()) return groups;
    const lc = searchTerm.toLowerCase();
    return groups.filter(g => {
      const s = g.student;
      return s?.name?.toLowerCase().includes(lc)
        || s?.emailId?.toLowerCase().includes(lc)
        || s?.phoneNo?.toLowerCase().includes(lc)
        || s?.rollNumber?.toLowerCase().includes(lc);
    });
  };

  const groupedPendingOffers   = filterBySearch(groupOffersByStudent(pendingOffers));
  const groupedConfirmedOffers = filterBySearch(groupOffersByStudent(confirmedOffers));
  const groupedRejectedOffers  = filterBySearch(groupOffersByStudent(rejectedOffers));

  const formatDate = (d) => d
    ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "N/A";

  // ── Column helpers ────────────────────────────────────────────────────

  const studentCell = (student) => (
    <div
      onClick={() => { setSelectedStudentId(student._id); setShowStudentModal(true); }}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ fontWeight: 600, color: '#161B22' }}>{student?.name}</div>
      {student?.rollNumber && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#666B72' }}>{student.rollNumber}</div>}
      <div style={{ fontSize: 12, color: '#666B72' }}>{student?.emailId}</div>
      {student?.phoneNo && <div style={{ fontSize: 12, color: '#666B72' }}>{student.phoneNo}</div>}
      <div style={{ fontSize: 11, color: '#8D9096' }}>
        {[student?.programme, student?.department].filter(Boolean).join(' · ')}
      </div>
    </div>
  );

  const companyCell = (offers) => {
    if (offers.length > 1) return <Tag color="orange">{offers.length} Companies</Tag>;
    return (
      <div>
        <div style={{ fontWeight: 600, color: '#14213D' }}>{offers[0]?.companyId?.name}</div>
        {offers[0]?.companyId?.venue && (
          <div style={{ fontSize: 12, color: '#8D9096' }}>{offers[0].companyId.venue}</div>
        )}
      </div>
    );
  };

  const pendingActions = (offer, student) => (
    <Space size={4} onClick={e => e.stopPropagation()}>
      <Button
        type="primary" size="small"
        loading={processing === offer._id}
        onClick={() => setConfirmDialog({
          isOpen: true, type: 'approve', offerId: offer._id,
          studentName: student?.name, companyName: offer.companyId?.name,
        })}
      >
        Approve
      </Button>
      <Button
        danger size="small"
        loading={processing === offer._id}
        onClick={() => openRejectReasonModal(offer._id)}
      >
        Reject
      </Button>
    </Space>
  );

  // ── Columns ───────────────────────────────────────────────────────────

  const pendingCols = [
    { title: '#', width: 50, render: (_, __, i) => <span style={{ color: '#8D9096', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Student Details', render: (_, r) => studentCell(r.student) },
    { title: 'Company', render: (_, r) => companyCell(r.offers) },
    {
      title: 'Status', render: (_, r) =>
        r.offers.length > 1 ? <Tag color="warning">Multiple Pending</Tag> : <Tag color="processing">Pending</Tag>,
    },
    { title: 'Created', render: (_, r) => <span style={{ fontSize: 12, color: '#666B72' }}>{formatDate(r.offers[0]?.createdAt)}</span> },
    {
      title: 'Actions', render: (_, r) =>
        r.offers.length > 1
          ? <span style={{ fontSize: 12, color: '#8D9096' }}>Expand to manage</span>
          : pendingActions(r.offers[0], r.student),
    },
  ];

  const confirmedCols = [
    { title: '#', width: 50, render: (_, __, i) => <span style={{ color: '#8D9096', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Student Details', render: (_, r) => studentCell(r.student) },
    { title: 'Company', render: (_, r) => companyCell(r.offers) },
    {
      title: 'Status', render: (_, r) => {
        const placed = r.offers.find(o => o.offerStatus === "ACCEPTED");
        if (placed) return <Tag color="success">Placed — {placed.companyId?.name}</Tag>;
        if (r.offers.length > 1) return <Tag color="warning">Multiple Offers</Tag>;
        return <Tag color="blue">{r.offers[0]?.offerStatus || 'Pending'}</Tag>;
      },
    },
    { title: 'Placed At', render: (_, r) => <span style={{ fontSize: 12, color: '#666B72' }}>{formatDate(r.offers[0]?.createdAt)}</span> },
  ];

  const rejectedCols = [
    { title: '#', width: 50, render: (_, __, i) => <span style={{ color: '#8D9096', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Student Details', render: (_, r) => studentCell(r.student) },
    { title: 'Company', render: (_, r) => companyCell(r.offers) },
    { title: 'Status', render: () => <Tag color="error">Rejected</Tag> },
    {
      title: 'Rejection Reason',
      render: (_, r) => <span style={{ fontSize: 12, color: '#C03200', fontStyle: 'italic' }}>{r.offers[0]?.remarks || "No reason provided"}</span>,
    },
  ];

  // ── Expandable sub-table ──────────────────────────────────────────────

  const makeExpandable = (isPending) => ({
    rowExpandable: r => r.offers.length > 1,
    expandedRowRender: r => {
      const subCols = [
        { title: 'Offer', width: 70, render: (_, __, i) => <span style={{ fontSize: 12 }}>Offer {i + 1}</span> },
        {
          title: 'Company', render: (_, o) => (
            <div>
              <div style={{ fontWeight: 600, color: '#14213D' }}>{o.companyId?.name}</div>
              <div style={{ fontSize: 11, color: '#8D9096' }}>{o.companyId?.venue}</div>
            </div>
          ),
        },
        {
          title: 'Status', render: (_, o) => {
            if (isPending) return <Tag color="warning">Pending</Tag>;
            const placed = r.offers.find(x => x.offerStatus === "ACCEPTED");
            if (o._id === placed?._id) return <Tag color="success">ACCEPTED</Tag>;
            if (placed) return <Tag>Auto-rejected</Tag>;
            return <Tag color="error">REJECTED</Tag>;
          },
        },
        { title: 'Date', render: (_, o) => <span style={{ fontSize: 12, color: '#666B72' }}>{formatDate(o.createdAt)}</span> },
        ...(isPending ? [{
          title: 'Actions',
          render: (_, o) => pendingActions(o, r.student),
        }] : []),
      ];
      return (
        <Table
          columns={subCols}
          dataSource={r.offers}
          rowKey="_id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      );
    },
  });

  // ── Confirmed Filters ─────────────────────────────────────────────────

  const progOptions  = (programmesAll.length ? programmesAll : programmesList).map(p => ({ label: p, value: p }));
  const deptOptions  = (departmentsAll.length ? departmentsAll : departmentsList).map(d => ({ label: d, value: d }));
  const compOptions  = (companiesAll.length ? companiesAll : companiesList).map(c => ({ label: c, value: c }));

  const applyFilters = async () => {
    setProgrammeFilter(tempProgramme); setDepartmentFilter(tempDepartment);
    setCpiMin(tempCpiMin); setCpiMax(tempCpiMax); setCompanyFilter(tempCompany);
    await fetchOffers({ programme: tempProgramme, department: tempDepartment, cpiMin: tempCpiMin, cpiMax: tempCpiMax, company: tempCompany });
  };

  const clearFilters = async () => {
    setProgrammeFilter(''); setDepartmentFilter(''); setCpiMin(''); setCpiMax(''); setCompanyFilter('');
    setTempProgramme(''); setTempDepartment(''); setTempCpiMin(''); setTempCpiMax(''); setTempCompany('');
    await fetchOffers({});
  };

  const confirmedFiltersRow = (
    <div className="mb-3 flex flex-wrap gap-2 items-end p-3" style={{ background: '#F4F2F1', border: '1px solid #E4E1E0' }}>
      <Select
        value={tempProgramme || undefined}
        onChange={v => setTempProgramme(v || '')}
        placeholder="Programme" allowClear style={{ width: 150 }} options={progOptions}
      />
      <Select
        value={tempDepartment || undefined}
        onChange={v => setTempDepartment(v || '')}
        placeholder="Department" allowClear style={{ width: 160 }} options={deptOptions}
      />
      <Select
        value={tempCompany || undefined}
        onChange={v => setTempCompany(v || '')}
        placeholder="Company" allowClear showSearch style={{ width: 200 }} options={compOptions}
      />
      <Input
        value={tempCpiMin} onChange={e => setTempCpiMin(e.target.value)}
        placeholder="CPI Min" style={{ width: 90 }} type="number"
      />
      <Input
        value={tempCpiMax} onChange={e => setTempCpiMax(e.target.value)}
        placeholder="CPI Max" style={{ width: 90 }} type="number"
      />
      <Space>
        <Button type="primary" onClick={applyFilters}>Apply</Button>
        <Button onClick={clearFilters}>Clear</Button>
      </Space>
    </div>
  );

  // ── Tab items ─────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'pending',
      label: (
        <span>
          Pending Approval&nbsp;
          <Tag color="warning">{groupedPendingOffers.length}</Tag>
        </span>
      ),
      children: (
        <Table
          columns={pendingCols}
          dataSource={groupedPendingOffers}
          rowKey={r => r.student._id}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          expandable={makeExpandable(true)}
          locale={{ emptyText: searchTerm ? 'No students match your search' : 'No pending offers' }}
        />
      ),
    },
    {
      key: 'confirmed',
      label: (
        <span>
          Confirmed Offers&nbsp;
          <Tag color="success">{groupedConfirmedOffers.length}</Tag>
        </span>
      ),
      children: (
        <>
          {confirmedFiltersRow}
          <Table
            columns={confirmedCols}
            dataSource={groupedConfirmedOffers}
            rowKey={r => r.student._id}
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            expandable={makeExpandable(false)}
            locale={{ emptyText: searchTerm ? 'No students match your search' : 'No confirmed offers yet' }}
          />
        </>
      ),
    },
    {
      key: 'rejected',
      label: (
        <span>
          Rejected Offers&nbsp;
          <Tag color="error">{groupedRejectedOffers.length}</Tag>
        </span>
      ),
      children: (
        <Table
          columns={rejectedCols}
          dataSource={groupedRejectedOffers}
          rowKey={r => r.student._id}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          expandable={makeExpandable(false)}
          locale={{ emptyText: searchTerm ? 'No students match your search' : 'No rejected offers' }}
        />
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <main className="px-6 py-6">
        <div className="mb-6">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161B22', margin: 0 }}>Offer Management</h1>
          <p style={{ fontSize: 13, color: '#666B72', marginTop: 4 }}>Review and approve offers created by POCs</p>
        </div>

        <div className="mb-4">
          <Input
            prefix={<SearchOutlined style={{ color: '#8D9096' }} />}
            placeholder="Search by name, email, phone, or roll number…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
            style={{ maxWidth: 480 }}
          />
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1E0' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane
            items={tabItems}
            style={{ padding: '0 16px' }}
          />
        </div>
      </main>

      <StudentDetailsModal
        isOpen={showStudentModal}
        onClose={() => { setShowStudentModal(false); setSelectedStudentId(null); }}
        studentId={selectedStudentId}
        isAdmin={true}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'approve'}
        onClose={() => setConfirmDialog({ isOpen: false, type: null, offerId: null, studentName: '', companyName: '' })}
        onConfirm={() => handleApprove(confirmDialog.offerId)}
        title="Approve Offer"
        message={`Are you sure you want to approve the offer from ${confirmDialog.companyName} for ${confirmDialog.studentName}?\n\nThis will:\n• Place the student at ${confirmDialog.companyName}\n• Auto-reject all other pending offers for this student\n• Update all company shortlists showing "Placed at ${confirmDialog.companyName}"`}
        confirmText="Approve Offer"
        confirmColor="green"
        icon="success"
      />

      <InputModal
        isOpen={rejectReasonModal.isOpen}
        onClose={() => setRejectReasonModal({ isOpen: false, offerId: null })}
        onSubmit={(reason) => handleReject(rejectReasonModal.offerId, reason)}
        title="Reject Offer"
        label="Reason for Rejection (Optional)"
        placeholder="Enter a reason for rejecting this offer..."
      />
    </>
  );
}
