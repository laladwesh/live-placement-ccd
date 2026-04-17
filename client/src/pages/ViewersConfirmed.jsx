import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import StudentDetailsModal from '../components/StudentDetailsModal';

export default function ViewersConfirmed() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programme, setProgramme] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [cpiMin, setCpiMin] = useState('');
  const [cpiMax, setCpiMax] = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/viewers/confirmed');
        setOffers(res.data.offers || []);
        try {
          const me = await api.get('/users/me');
          setUser(me.data.user);
        } catch (e) {
          console.warn('Viewer not authenticated');
        }
      } catch (err) {
        toast.error('Failed to load offers');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const programmes = useMemo(() => Array.from(new Set(offers.map(o => o.studentId?.programme).filter(Boolean))).sort(), [offers]);
  const departments = useMemo(() => Array.from(new Set(offers.map(o => o.studentId?.department).filter(Boolean))).sort(), [offers]);
  const companies = useMemo(() => Array.from(new Set(offers.map(o => o.companyId?.name).filter(Boolean))).sort(), [offers]);

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase();
    return offers.filter(o => {
      const student = o.studentId || {};
      if (programme && student.programme !== programme) return false;
      if (department && student.department !== department) return false;
      if (company && !(o.companyId?.name || '').toLowerCase().includes(company.toLowerCase())) return false;
      if (cpiMin && (student.cpi === null || student.cpi < Number(cpiMin))) return false;
      if (cpiMax && (student.cpi === null || student.cpi > Number(cpiMax))) return false;
      if (!s) return true;
      return (
        (student.name || '').toLowerCase().includes(s) ||
        (student.emailId || '').toLowerCase().includes(s) ||
        (o.companyId?.name || '').toLowerCase().includes(s)
      );
    });
  }, [offers, search, programme, department, company, cpiMin, cpiMax]);

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Placement <span className="text-indigo-600">Data</span>
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Viewing {filtered.length} confirmed placements</p>
          </div>
          <div className="relative group">
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search students or companies..." 
              className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
            <div className="absolute left-3 top-3 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <FilterGroup label="Programme" value={programme} onChange={setProgramme} options={programmes} />
            <FilterGroup label="Department" value={department} onChange={setDepartment} options={departments} />
            <FilterGroup label="Company" value={company} onChange={setCompany} options={companies} />
            <div className="flex flex-col">
               <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">CPI Range</label>
               <div className="flex items-center gap-2">
                 <input type="number" placeholder="Min" value={cpiMin} onChange={e => setCpiMin(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors" />
                 <span className="text-slate-300">-</span>
                 <input type="number" placeholder="Max" value={cpiMax} onChange={e => setCpiMax(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors" />
               </div>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => {setProgramme(''); setDepartment(''); setCompany(''); setCpiMin(''); setCpiMax(''); setSearch('');}}
                className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Fetching placement data...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">#</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Student Profile</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Placement Entity</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Timeline</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length > 0 ? filtered.map((o, idx) => (
                    <tr key={o._id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{o.studentId?.name}</span>
                          <span className="text-xs text-slate-500">{o.studentId?.rollNumber} • {o.studentId?.programme}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold w-fit mb-1">
                            {o.companyId?.name}
                          </span>
                          <span className="text-xs text-slate-500">{o.companyId?.venue || 'Virtual'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                           <span className="text-sm text-slate-600">{formatDate(o.approvedAt || o.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { setSelectedStudentId(o.studentId?._id); setShowStudentModal(true); }}
                          className="inline-flex items-center px-4 py-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                        No placement records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <StudentDetailsModal 
          isOpen={showStudentModal} 
          onClose={() => { setShowStudentModal(false); setSelectedStudentId(null); }} 
          studentId={selectedStudentId}
          isViewer={true}
        />
      </main>
    </div>
  );
}

// Helper component for cleaner filters
function FilterGroup({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
      >
        <option value="">All {label}s</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}