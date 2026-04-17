import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import api from "../api/axios";

export default function InternMasterData() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const [department, setDepartment] = useState("");
  const [company, setCompany] = useState("");
  const [cpiMin, setCpiMin] = useState("");
  const [cpiMax, setCpiMax] = useState("");
  const [marking, setMarking] = useState(false);

  const [isPlacementModalOpen, setIsPlacementModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [companyInput, setCompanyInput] = useState("");
  const [slotSpotInput, setSlotSpotInput] = useState("");
  const canEdit = user?.role === "admin";

  const loadPageData = async () => {
    setLoading(true);
    try {
      const meRes = await api.get("/users/me");
      const me = meRes.data.user;
      setUser(me);

      if (me.role !== "admin" && me.role !== "viewer") {
        navigate("/dashboard", { replace: true });
        return;
      }

      const internRes = await api.get("/viewers/intern-master");
      setRows(internRes.data.data || []);
    } catch (err) {
      console.error("Error loading intern master data:", err);
      toast.error("Failed to load intership data");
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const programmes = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.programme).filter(Boolean))).sort();
  }, [rows]);

  const departments = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.department).filter(Boolean))).sort();
  }, [rows]);

  const companies = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.company).filter(Boolean))).sort();
  }, [rows]);

  const summary = useMemo(() => {
    const placed = rows.filter((row) => row.isGotIntern).length;
    const total = rows.length;
    return { total, placed, unplaced: total - placed };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const s = (search || "").toLowerCase();

    return rows.filter((row) => {
      if (programme && row.programme !== programme) return false;
      if (department && row.department !== department) return false;
      if (company && !(row.company || "").toLowerCase().includes(company.toLowerCase())) return false;
      if (cpiMin && (row.cpi === null || row.cpi === undefined || Number(row.cpi) < Number(cpiMin))) return false;
      if (cpiMax && (row.cpi === null || row.cpi === undefined || Number(row.cpi) > Number(cpiMax))) return false;
      if (!s) return true;
      return (
        (row.name || "").toLowerCase().includes(s) ||
        (row.iitgEmail || "").toLowerCase().includes(s) ||
        (row.rollNumber || "").toLowerCase().includes(s) ||
        (row.email || "").toLowerCase().includes(s) ||
        (row.company || "").toLowerCase().includes(s)
      );
    });
  }, [rows, search, programme, department, company, cpiMin, cpiMax]);

  const openPlacementModal = (record) => {
    setSelectedRecord(record);
    setCompanyInput(record.company || "");
    setSlotSpotInput(record.slotSpot || "");
    setIsPlacementModalOpen(true);
  };

  const handleMarkPlaced = async (event) => {
    event.preventDefault();
    if (!selectedRecord) return;

    if (!companyInput.trim()) {
      toast.error("Please enter company name");
      return;
    }

    setMarking(true);
    try {
      const res = await api.patch(`/viewers/intern-master/${selectedRecord._id}/placement`, {
        isGotIntern: true,
        company: companyInput.trim(),
        slotSpot: slotSpotInput.trim()
      });

      const updated = res.data.data;
      setRows((prev) => prev.map((row) => (row._id === updated._id ? updated : row)));
      toast.success("Student marked as placed");
      setIsPlacementModalOpen(false);
      setSelectedRecord(null);
      setCompanyInput("");
      setSlotSpotInput("");
    } catch (err) {
      console.error("Error marking placed:", err);
      toast.error(err.response?.data?.message || "Failed to update placement");
    } finally {
      setMarking(false);
    }
  };

  const handleMarkNotPlaced = async (record) => {
    const confirmed = window.confirm(`Mark ${record.name} as not placed?`);
    if (!confirmed) return;

    try {
      const res = await api.patch(`/viewers/intern-master/${record._id}/placement`, {
        isGotIntern: false,
        company: "",
        slotSpot: ""
      });

      const updated = res.data.data;
      setRows((prev) => prev.map((row) => (row._id === updated._id ? updated : row)));
      toast.success("Student marked as not placed");
    } catch (err) {
      console.error("Error marking not placed:", err);
      toast.error(err.response?.data?.message || "Failed to update placement");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Intership <span className="text-indigo-600">Data</span>
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Viewing {filteredRows.length} records</p>
          </div>
          <div className="relative group">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <FilterGroup label="Programme" value={programme} onChange={setProgramme} options={programmes} />
            <FilterGroup label="Department" value={department} onChange={setDepartment} options={departments} />
            <FilterGroup label="Company" value={company} onChange={setCompany} options={companies} />
            <div className="flex flex-col">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">CPI Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={cpiMin}
                  onChange={(e) => setCpiMin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={cpiMax}
                  onChange={(e) => setCpiMax(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white transition-colors"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setProgramme("");
                  setDepartment("");
                  setCompany("");
                  setCpiMin("");
                  setCpiMax("");
                  setSearch("");
                }}
                className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Students</div>
            <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-4">
            <div className="text-sm text-emerald-600">Got Intern (Yes)</div>
            <div className="text-2xl font-bold text-emerald-700">{summary.placed}</div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 p-4">
            <div className="text-sm text-amber-600">Not Placed</div>
            <div className="text-2xl font-bold text-amber-700">{summary.unplaced}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-500 font-medium">Fetching intership data...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No records found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">#</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">IITG Email</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Roll</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">CPI</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Department</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Mobile</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Got Intern</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Slot / Spot</th>
                    {canEdit && (
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRows.map((row, idx) => (
                    <tr key={row._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.iitgEmail || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.rollNumber || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 font-medium">{row.name || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {typeof row.cpi === "number" ? row.cpi.toFixed(2) : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.department || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.email || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.mobile || "-"}</td>
                      <td className="px-6 py-4 text-sm">
                        {row.isGotIntern ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Yes
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.company || "-"}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{row.slotSpot || "-"}</td>
                      {canEdit && (
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openPlacementModal(row)}
                              className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                            >
                              {row.isGotIntern ? "Update" : "Mark Placed"}
                            </button>
                            {row.isGotIntern && (
                              <button
                                onClick={() => handleMarkNotPlaced(row)}
                                className="px-3 py-1.5 rounded-md bg-slate-200 text-slate-800 text-xs font-medium hover:bg-slate-300"
                              >
                                Mark Not Placed
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isPlacementModalOpen}
        onClose={() => {
          if (marking) return;
          setIsPlacementModalOpen(false);
          setSelectedRecord(null);
          setCompanyInput("");
          setSlotSpotInput("");
        }}
        title={selectedRecord ? `Mark Placement: ${selectedRecord.name}` : "Mark Placement"}
      >
        <form onSubmit={handleMarkPlaced}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="Enter company name"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slot / Spot (optional)</label>
              <input
                value={slotSpotInput}
                onChange={(e) => setSlotSpotInput(e.target.value)}
                placeholder="e.g. Slot-1"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsPlacementModalOpen(false);
                setSelectedRecord(null);
                setCompanyInput("");
                setSlotSpotInput("");
              }}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              disabled={marking}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={marking}
            >
              {marking ? "Saving..." : "Save Placement"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
      >
        <option value="">All {label}s</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
