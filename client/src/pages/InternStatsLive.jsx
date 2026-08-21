import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Input, Select, Button, Tag, Space } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function InternStatsLive() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ count: 0, placed_count: 0, unplaced_count: 0, generated_at: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // filters
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [cpiMin, setCpiMin] = useState("");
  const [cpiMax, setCpiMax] = useState("");
  const [gotIntern, setGotIntern] = useState(""); // "" | "yes" | "no"
  const [selectedProgrammes, setSelectedProgrammes] = useState([]);

  // "last fetched X seconds ago" ticker
  const [secondsAgo, setSecondsAgo] = useState(null);
  const tickRef = useRef(null);

  const startTicker = useCallback((generatedAt) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const base = new Date(generatedAt).getTime();
    const tick = () => setSecondsAgo(Math.floor((Date.now() - base) / 1000));
    tick();
    tickRef.current = setInterval(tick, 5000);
  }, []);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const fetchData = useCallback(async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/intern-stats" + (bustCache ? "?refresh=1" : ""));
      const { data = [], count = 0, placed_count = 0, unplaced_count = 0, generated_at = null } = res.data;
      setRows(data);
      setMeta({ count, placed_count, unplaced_count, generated_at });
      if (generated_at) startTicker(generated_at);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load live intern data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [startTicker]);

  useEffect(() => {
    if (user) {
      if (user.role !== "admin" && user.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }
      fetchData();
      return;
    }
    api.get("/users/me").then(res => {
      const me = res.data.user;
      setCachedUser(me);
      setUser(me);
      if (me.role !== "admin" && me.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }
      fetchData();
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(() =>
    Array.from(new Set(rows.map(r => r.department).filter(Boolean))).sort(), [rows]);

  const companies = useMemo(() =>
    Array.from(new Set(rows.map(r => r.company).filter(Boolean))).sort(), [rows]);

  // Normalize programme names — intern portal sometimes sends "B.Tech" instead of "BTech"
  const normProgramme = (p) => p ? p.replace(/\./g, "").trim() : p;

  const programmes = useMemo(() =>
    Array.from(new Set(rows.map(r => normProgramme(r.programme)).filter(Boolean))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(row => {
      if (department && row.department !== department) return false;
      if (companyFilter && !(row.company || "").toLowerCase().includes(companyFilter.toLowerCase())) return false;
      if (cpiMin && (row.cpi == null || Number(row.cpi) < Number(cpiMin))) return false;
      if (cpiMax && (row.cpi == null || Number(row.cpi) > Number(cpiMax))) return false;
      if (gotIntern === "yes" && !row.isGotIntern) return false;
      if (gotIntern === "no"  &&  row.isGotIntern) return false;
      if (selectedProgrammes.length > 0 && !selectedProgrammes.includes(normProgramme(row.programme))) return false;
      if (!s) return true;
      return (
        (row.name || "").toLowerCase().includes(s) ||
        (row.iitgEmail || "").toLowerCase().includes(s) ||
        (row.rollNumber || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s) ||
        (row.company || "").toLowerCase().includes(s)
      );
    });
  }, [rows, search, department, companyFilter, cpiMin, cpiMax, gotIntern, selectedProgrammes]);

  const resetFilters = () => {
    setSearch(""); setDepartment(""); setCompanyFilter(""); setCpiMin(""); setCpiMax(""); setGotIntern(""); setSelectedProgrammes([]);
  };

  const freshnessBadge = () => {
    if (secondsAgo === null) return null;
    const label = secondsAgo < 60
      ? `${secondsAgo}s ago`
      : `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live data — last fetched {label}
      </span>
    );
  };

  const columns = [
    { title: '#', width: 50, render: (_, __, i) => <span style={{ fontSize: 12, color: '#8D9096' }}>{i + 1}</span> },
    { title: 'IITG Email', dataIndex: 'iitgEmail', render: v => v || '—' },
    { title: 'Roll', dataIndex: 'rollNumber', render: v => <span style={{ fontFamily: 'monospace' }}>{v || '—'}</span> },
    { title: 'Name', dataIndex: 'name', render: v => <span style={{ fontWeight: 600, color: '#161B22' }}>{v || '—'}</span> },
    { title: 'CPI', dataIndex: 'cpi', width: 65, render: v => typeof v === 'number' ? v.toFixed(2) : '—' },
    { title: 'Dept', dataIndex: 'department', render: v => v || '—' },
    { title: 'Email', dataIndex: 'email', render: v => v || '—' },
    { title: 'Mobile', dataIndex: 'mobile', render: v => v || '—' },
    {
      title: 'Got Intern', dataIndex: 'isGotIntern', width: 90,
      render: v => v
        ? <Tag color="success">Yes</Tag>
        : <Tag color="error">No</Tag>,
    },
    { title: 'Company', dataIndex: 'company', render: v => v || '—' },
    { title: 'Slot / Spot', dataIndex: 'slotSpot', render: v => v || '—' },
  ];

  return (
    <main className="px-6 py-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161B22', margin: 0 }}>Intern Stats — Live</h1>
          <p style={{ fontSize: 13, color: '#666B72', marginTop: 4 }}>
            {loading ? 'Loading…' : `Showing ${filteredRows.length} of ${rows.length} records`}
          </p>
        </div>
        <Space wrap>
          {freshnessBadge()}
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => fetchData(true)}
          >
            Refresh
          </Button>
          <Input
            prefix={<SearchOutlined style={{ color: '#8D9096' }} />}
            placeholder="Search students or companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: '100%', maxWidth: 260 }}
          />
        </Space>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div style={{ background: '#fff', border: '1px solid #E4E1E0', padding: 16 }}>
          <div style={{ fontSize: 13, color: '#666B72' }}>Total Students</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#161B22' }}>{filteredRows.length}</div>
          {filteredRows.length !== meta.count && <div style={{ fontSize: 11, color: '#8D9096' }}>of {meta.count} total</div>}
        </div>
        <div style={{ background: '#fff', border: '1px solid #B7EB8F', padding: 16 }}>
          <div style={{ fontSize: 13, color: '#389e0d' }}>Got Intern</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#237804' }}>{filteredRows.filter(r => r.isGotIntern).length}</div>
          {filteredRows.length !== meta.count && <div style={{ fontSize: 11, color: '#8D9096' }}>of {meta.placed_count} total</div>}
        </div>
        <div style={{ background: '#fff', border: '1px solid #FFD591', padding: 16 }}>
          <div style={{ fontSize: 13, color: '#d46b08' }}>Not Placed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ad4e00' }}>{filteredRows.filter(r => !r.isGotIntern).length}</div>
          {filteredRows.length !== meta.count && <div style={{ fontSize: 11, color: '#8D9096' }}>of {meta.unplaced_count} total</div>}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-2 items-end p-3" style={{ background: '#F4F2F1', border: '1px solid #E4E1E0' }}>
        <Select
          value={department || undefined}
          onChange={v => setDepartment(v || '')}
          placeholder="Department" allowClear style={{ width: 160 }}
          options={departments.map(d => ({ label: d, value: d }))}
        />
        <Select
          value={companyFilter || undefined}
          onChange={v => setCompanyFilter(v || '')}
          placeholder="Company" allowClear showSearch style={{ width: 200 }}
          options={companies.map(c => ({ label: c, value: c }))}
        />
        <Select
          value={gotIntern || undefined}
          onChange={v => setGotIntern(v || '')}
          placeholder="Got Intern" allowClear style={{ width: 150 }}
          options={[
            { label: 'Yes — Got Intern', value: 'yes' },
            { label: 'No — Not Placed', value: 'no' },
          ]}
        />
        <Input
          value={cpiMin} onChange={e => setCpiMin(e.target.value)}
          placeholder="CPI Min" style={{ width: 80 }} type="number"
        />
        <Input
          value={cpiMax} onChange={e => setCpiMax(e.target.value)}
          placeholder="CPI Max" style={{ width: 80 }} type="number"
        />
        <Button onClick={resetFilters}>Reset</Button>
      </div>

      {/* Programme pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8D9096', textTransform: 'uppercase', letterSpacing: 1 }}>Programme:</span>
        {programmes.length === 0
          ? <span style={{ fontSize: 12, color: '#8D9096', fontStyle: 'italic' }}>No data yet</span>
          : programmes.map(p => {
              const active = selectedProgrammes.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => setSelectedProgrammes(prev =>
                    active ? prev.filter(x => x !== p) : [...prev, p]
                  )}
                  style={{
                    padding: '2px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${active ? '#14213D' : '#E4E1E0'}`,
                    background: active ? '#14213D' : '#fff',
                    color: active ? '#fff' : '#33383F',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p}
                </button>
              );
            })
        }
        {selectedProgrammes.length > 0 && (
          <button
            onClick={() => setSelectedProgrammes([])}
            style={{ fontSize: 12, color: '#8D9096', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {error ? (
        <div style={{ background: '#fff', border: '1px solid #E4E1E0', padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#D83B01', fontWeight: 600 }}>Could not load data</p>
          <p style={{ color: '#666B72', fontSize: 13 }}>{error}</p>
          <Button type="primary" onClick={() => fetchData(true)} style={{ marginTop: 12 }}>Retry</Button>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E4E1E0' }}>
          <Table
            columns={columns}
            dataSource={filteredRows}
            rowKey={r => r.rollNumber || Math.random()}
            loading={loading}
            pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} records` }}
            size="small"
            scroll={{ x: 'max-content' }}
            onRow={r => ({ onClick: () => navigate(`/intern-stats-live/${r.rollNumber}`), style: { cursor: 'pointer' } })}
            locale={{ emptyText: 'No records found for selected filters.' }}
          />
        </div>
      )}
    </main>
  );
}
