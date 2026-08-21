import React, { useEffect, useState, useMemo } from 'react';
import { Table, Input, Select, Button, Tag, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../api/axios';
import toast from 'react-hot-toast';
import StudentDetailsModal from '../components/StudentDetailsModal';

export default function ViewersConfirmed() {
  const [offers, setOffers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [programme, setProgramme] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [cpiMin, setCpiMin]   = useState('');
  const [cpiMax, setCpiMax]   = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedYear, setSelectedYear] = useState('current');

  useEffect(() => {
    api.get('/viewers/seasons').then(res => setSeasons(res.data.seasons || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/viewers/confirmed?year=${encodeURIComponent(selectedYear)}`);
        setOffers(res.data.offers || []);
      } catch {
        toast.error('Failed to load offers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  const programmes = useMemo(() => Array.from(new Set(offers.map(o => o.studentId?.programme).filter(Boolean))).sort(), [offers]);
  const departments = useMemo(() => Array.from(new Set(offers.map(o => o.studentId?.department).filter(Boolean))).sort(), [offers]);
  const companies   = useMemo(() => Array.from(new Set(offers.map(o => o.companyId?.name).filter(Boolean))).sort(), [offers]);

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase();
    return offers.filter(o => {
      const st = o.studentId || {};
      if (programme && st.programme !== programme) return false;
      if (department && st.department !== department) return false;
      if (company && !(o.companyId?.name || '').toLowerCase().includes(company.toLowerCase())) return false;
      if (cpiMin && (st.cpi == null || st.cpi < Number(cpiMin))) return false;
      if (cpiMax && (st.cpi == null || st.cpi > Number(cpiMax))) return false;
      if (!s) return true;
      return (
        (st.name || '').toLowerCase().includes(s) ||
        (st.emailId || '').toLowerCase().includes(s) ||
        (o.companyId?.name || '').toLowerCase().includes(s)
      );
    });
  }, [offers, search, programme, department, company, cpiMin, cpiMax]);

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  const seasonOptions = [
    { label: 'Current Season', value: 'current' },
    ...seasons.map(s => ({ label: s.label || `Placement ${s.year}`, value: s.year })),
    { label: 'All Seasons', value: 'all' },
  ];

  const columns = [
    {
      title: '#', width: 50,
      render: (_, __, i) => <span style={{ fontSize: 12, color: '#8D9096' }}>{i + 1}</span>,
    },
    {
      title: 'Student',
      render: (_, o) => (
        <div>
          <div style={{ fontWeight: 600, color: '#161B22' }}>{o.studentId?.name}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#666B72' }}>
            {o.studentId?.rollNumber}
          </div>
          <div style={{ fontSize: 12, color: '#8D9096' }}>
            {[o.studentId?.programme, o.studentId?.department].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      title: 'CPI',
      width: 70,
      render: (_, o) => (
        <span style={{ fontWeight: 600, color: '#33383F' }}>
          {typeof o.studentId?.cpi === 'number' ? o.studentId.cpi.toFixed(2) : 'N/A'}
        </span>
      ),
    },
    {
      title: 'Company',
      render: (_, o) => (
        <div>
          <Tag color="geekblue" style={{ fontWeight: 600, marginBottom: 2 }}>{o.companyId?.name}</Tag>
          <div style={{ fontSize: 11, color: '#8D9096' }}>{o.companyId?.venue || 'Virtual'}</div>
        </div>
      ),
    },
    {
      title: 'Date',
      width: 120,
      render: (_, o) => <span style={{ fontSize: 12, color: '#666B72' }}>{formatDate(o.approvedAt || o.createdAt)}</span>,
    },
    {
      title: 'Action',
      width: 110,
      align: 'right',
      render: (_, o) => (
        <Button
          size="small"
          onClick={() => { setSelectedStudentId(o.studentId?._id); setShowStudentModal(true); }}
        >
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <main className="px-6 py-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161B22', margin: 0 }}>Confirmed Placements</h1>
          <p style={{ fontSize: 13, color: '#666B72', marginTop: 4 }}>
            {filtered.length} placement{filtered.length !== 1 ? 's' : ''} shown
          </p>
        </div>
        <Space wrap>
          <Select
            value={selectedYear}
            onChange={v => { setSelectedYear(v); setProgramme(''); setDepartment(''); setCompany(''); }}
            options={seasonOptions}
            style={{ width: 180 }}
          />
          <Input
            prefix={<SearchOutlined style={{ color: '#8D9096' }} />}
            placeholder="Search students or companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
        </Space>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2 items-end p-3" style={{ background: '#F4F2F1', border: '1px solid #E4E1E0' }}>
        <Select
          value={programme || undefined}
          onChange={v => setProgramme(v || '')}
          placeholder="Programme" allowClear style={{ width: 150 }}
          options={programmes.map(p => ({ label: p, value: p }))}
        />
        <Select
          value={department || undefined}
          onChange={v => setDepartment(v || '')}
          placeholder="Department" allowClear style={{ width: 160 }}
          options={departments.map(d => ({ label: d, value: d }))}
        />
        <Select
          value={company || undefined}
          onChange={v => setCompany(v || '')}
          placeholder="Company" allowClear showSearch style={{ width: 200 }}
          options={companies.map(c => ({ label: c, value: c }))}
        />
        <Input
          value={cpiMin} onChange={e => setCpiMin(e.target.value)}
          placeholder="CPI Min" style={{ width: 80 }} type="number"
        />
        <Input
          value={cpiMax} onChange={e => setCpiMax(e.target.value)}
          placeholder="CPI Max" style={{ width: 80 }} type="number"
        />
        <Button
          onClick={() => { setProgramme(''); setDepartment(''); setCompany(''); setCpiMin(''); setCpiMax(''); setSearch(''); }}
        >
          Reset
        </Button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4E1E0' }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
          size="small"
          locale={{ emptyText: 'No placement records match your filters.' }}
        />
      </div>

      <StudentDetailsModal
        isOpen={showStudentModal}
        onClose={() => { setShowStudentModal(false); setSelectedStudentId(null); }}
        studentId={selectedStudentId}
        isViewer={true}
      />
    </main>
  );
}
