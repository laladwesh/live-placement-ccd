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
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("");
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
      toast.error("Failed to load intern master data");
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

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.department).filter(Boolean))).sort();
  }, [rows]);

  const summary = useMemo(() => {
    const placed = rows.filter((row) => row.isGotIntern).length;
    const total = rows.length;
    return { total, placed, unplaced: total - placed };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter === "placed" && !row.isGotIntern) return false;
      if (statusFilter === "not-placed" && row.isGotIntern) return false;
      if (departmentFilter && row.department !== departmentFilter) return false;

      if (!q) return true;
      const haystack = [
        row.iitgEmail,
        row.rollNumber,
        row.name,
        row.department,
        row.email,
        row.mobile,
        row.company,
        row.slotSpot
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, statusFilter, departmentFilter]);

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
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Intern Master Data</h1>
          <p className="text-slate-600 mt-1">Complete internship sheet with placement status tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Total Students</div>
            <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 p-4">
            <div className="text-sm text-emerald-600">Got Internship (Yes)</div>
            <div className="text-2xl font-bold text-emerald-700">{summary.placed}</div>
          </div>
          <div className="bg-white rounded-lg border border-amber-200 p-4">
            <div className="text-sm text-amber-600">Not Placed</div>
            <div className="text-2xl font-bold text-amber-700">{summary.unplaced}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, roll number, name, company..."
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="placed">Yes (Got Intern)</option>
              <option value="not-placed">No (Not Placed)</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-500">Loading intern master data...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No records found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">IITG Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Roll</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">CPI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Mobile</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Yes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Slot / Spot</th>
                    {canEdit && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">{row.iitgEmail || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.rollNumber || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 font-medium">{row.name || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {typeof row.cpi === "number" ? row.cpi.toFixed(2) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.department || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.email || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.mobile || "-"}</td>
                      <td className="px-4 py-3 text-sm">
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
                      <td className="px-4 py-3 text-sm text-slate-700">{row.company || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.slotSpot || "-"}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-sm">
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
