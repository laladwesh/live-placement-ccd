import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getCachedUser, setCachedUser, clearCachedUser } from "../utils/userCache";

export default function PrevPlacementData() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCachedUser());

  // ── seasons ────────────────────────────────────────────
  const [seasons, setSeasons] = useState([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null);

  // ── tab ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("companies");

  // ── companies ──────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  // ── add-company modal ──────────────────────────────────
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyVenue, setNewCompanyVenue] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);
  const addCompanyInputRef = useRef(null);

  // ── pending offers ─────────────────────────────────────
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [processing, setProcessing] = useState(null); // offerId being approved/rejected

  // ── confirmed + rejected offers ────────────────────────
  const [confirmedOffers, setConfirmedOffers] = useState([]);
  const [rejectedOffers, setRejectedOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");

  // ── auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (user) {
      if (user.role !== "admin" && user.role !== "superadmin") {
        navigate("/dashboard", { replace: true });
        return;
      }
      loadSeasons();
      return;
    }
    api.get("/users/me").then(res => {
      const me = res.data.user;
      setCachedUser(me);
      setUser(me);
      if (me.role !== "admin" && me.role !== "superadmin") {
        navigate("/dashboard", { replace: true });
        return;
      }
      loadSeasons();
    }).catch(() => {
      clearCachedUser();
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSeasons = async () => {
    setSeasonsLoading(true);
    try {
      const res = await api.get("/prev-placement/seasons");
      const list = res.data.seasons || [];
      setSeasons(list);
      if (list.length > 0) setSelectedYear(list[0].year); // default to newest
    } catch (err) {
      toast.error("Failed to load placement seasons");
    } finally {
      setSeasonsLoading(false);
    }
  };

  const loadCompanies = useCallback(async (year) => {
    setCompaniesLoading(true);
    setCompanies([]);
    try {
      const res = await api.get(`/prev-placement/companies?year=${encodeURIComponent(year)}`);
      setCompanies(res.data.companies || []);
    } catch (err) {
      toast.error("Failed to load companies");
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  const loadOffers = useCallback(async (year) => {
    setOffersLoading(true);
    setConfirmedOffers([]);
    setRejectedOffers([]);
    try {
      const res = await api.get(`/prev-placement/offers?year=${encodeURIComponent(year)}`);
      const all = res.data.offers || [];
      setConfirmedOffers(all.filter(o => o.approvalStatus === "APPROVED"));
      setRejectedOffers(all.filter(o => o.approvalStatus === "REJECTED"));
    } catch (err) {
      toast.error("Failed to load offers");
    } finally {
      setOffersLoading(false);
    }
  }, []);

  const loadPending = useCallback(async (year) => {
    setPendingLoading(true);
    setPendingOffers([]);
    try {
      const res = await api.get(`/prev-placement/pending?year=${encodeURIComponent(year)}`);
      setPendingOffers(res.data.offers || []);
    } catch (err) {
      toast.error("Failed to load pending offers");
    } finally {
      setPendingLoading(false);
    }
  }, []);

  // Reload data whenever year changes
  useEffect(() => {
    if (!selectedYear) return;
    loadCompanies(selectedYear);
    loadOffers(selectedYear);
    loadPending(selectedYear);
    setCompanySearch("");
    setOfferSearch("");
    setActiveTab("companies");
  }, [selectedYear, loadCompanies, loadOffers, loadPending]);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) { toast.error("Company name is required"); return; }
    setAddingCompany(true);
    try {
      await api.post("/admin/companies", {
        name: newCompanyName.trim(),
        venue: newCompanyVenue.trim(),
        placementYear: selectedYear,
      });
      toast.success(`Company added to ${selectedYear}`);
      setAddCompanyOpen(false);
      setNewCompanyName("");
      setNewCompanyVenue("");
      loadCompanies(selectedYear);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add company");
    } finally {
      setAddingCompany(false);
    }
  };

  const handleApprove = async (offerId) => {
    setProcessing(offerId);
    try {
      await api.post(`/admin/offers/${offerId}/approve`);
      toast.success("Offer approved");
      loadPending(selectedYear);
      loadOffers(selectedYear);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (offerId) => {
    const reason = window.prompt("Reason for rejection (optional):");
    if (reason === null) return; // cancelled
    setProcessing(offerId);
    try {
      await api.post(`/admin/offers/${offerId}/reject`, { reason });
      toast.success("Offer rejected");
      loadPending(selectedYear);
      loadOffers(selectedYear);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject");
    } finally {
      setProcessing(null);
    }
  };

  // ── derived ────────────────────────────────────────────
  const q = companySearch.toLowerCase();
  const filteredCompanies = companies.filter(c =>
    !q ||
    (c.name || "").toLowerCase().includes(q) ||
    (c.venue || "").toLowerCase().includes(q) ||
    (c.description || "").toLowerCase().includes(q) ||
    (c.POCs || []).some(p => (p?.name || "").toLowerCase().includes(q) || (p?.emailId || "").toLowerCase().includes(q))
  );

  const oq = offerSearch.toLowerCase();
  const filterOffers = (list) => !oq ? list : list.filter(o => {
    const s = o.studentId;
    return (s?.name || "").toLowerCase().includes(oq) ||
      (s?.rollNumber || "").toLowerCase().includes(oq) ||
      (s?.emailId || "").toLowerCase().includes(oq) ||
      (o.companyId?.name || "").toLowerCase().includes(oq);
  });

  const placedStudents = confirmedOffers.filter(o => o.offerStatus === "ACCEPTED");

  const fmtDate = (d) => d
    ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const selectedSeason = seasons.find(s => s.year === selectedYear);
  const seasonLabel = selectedSeason?.label || (selectedYear ? `Placement ${selectedYear}` : "");
  // Only the season marked isLastFinished in Compass allows late company additions and offer approvals.
  const canEdit = !!selectedSeason?.isLastFinished;

  const tabs = [
    { id: "companies", label: "Companies",            count: companies.length },
    // Pending tab only visible for the last-finished season
    ...(canEdit ? [{ id: "pending", label: "Pending Offers", count: pendingOffers.length, alert: pendingOffers.length > 0 }] : []),
    { id: "confirmed", label: "Confirmed Placements", count: placedStudents.length },
    { id: "rejected",  label: "Rejected Offers",      count: rejectedOffers.length },
  ];

  // ── Loading state for seasons ──
  if (seasonsLoading) {
    return (
      <main className="px-6 flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3" />
        <p className="text-slate-500 text-sm">Loading seasons…</p>
      </main>
    );
  }

  // ── No archived seasons yet ──
  if (seasons.length === 0) {
    return (
      <main className="px-6 py-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-4">
          Prev Placement Data
        </h1>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-slate-500 font-medium mb-2">No archived seasons yet.</p>
          <p className="text-slate-400 text-sm">
            When a placement season concludes, create a <code className="bg-slate-100 px-1 rounded">PlacementSeason</code> document
            in MongoDB Compass with <code className="bg-slate-100 px-1 rounded">isPrevActive: true</code> and bulk-set
            <code className="bg-slate-100 px-1 rounded ml-1">placementYear: "YYYY-YY"</code> on all companies from that season.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 py-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Prev Placement Data</h1>
          {selectedYear && (
            <p className="text-slate-500 mt-1 font-medium">
              {seasonLabel} · {companies.length} companies · {placedStudents.length} placed
            </p>
          )}
        </div>

        {/* ── Year selector ── */}
        <div className="flex flex-col">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Season</label>
          <select
            value={selectedYear || ""}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          >
            {seasons.map(s => (
              <option key={s.year} value={s.year}>
                {s.label || `Placement ${s.year}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-4 py-4 text-sm font-semibold transition ${
                activeTab === t.id
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/60"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span>{t.label}</span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                t.alert && activeTab !== t.id
                  ? "bg-amber-100 text-amber-700"
                  : activeTab === t.id
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          TAB: Companies
      ══════════════════════════════════════ */}
      {activeTab === "companies" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <SearchBar value={companySearch} onChange={setCompanySearch} placeholder="Search companies, venue, POC…" nomb />
            </div>
            {canEdit ? (
              <button
                onClick={() => { setAddCompanyOpen(true); setTimeout(() => addCompanyInputRef.current?.focus(), 50); }}
                className="flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                + Add Company to {selectedYear}
              </button>
            ) : (
              <span className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400">
                Read-only archive
              </span>
            )}
          </div>
          {companiesLoading ? (
            <Spinner label="Loading companies…" />
          ) : filteredCompanies.length === 0 ? (
            <Empty label={companySearch ? "No companies match your search" : `No companies archived for ${selectedYear}`} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <Th>#</Th><Th>Company</Th><Th>Venue</Th><Th>Description</Th><Th>POCs</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredCompanies.map((c, i) => (
                      <tr key={c._id} className="hover:bg-slate-50/60 transition-colors">
                        <Td className="font-mono text-slate-400">{i + 1}</Td>
                        <Td><span className="font-semibold text-slate-900">{c.name}</span></Td>
                        <Td>{c.venue || "—"}</Td>
                        <Td className="max-w-xs truncate text-slate-500">{c.description || "—"}</Td>
                        <Td>
                          {(c.POCs || []).length === 0
                            ? <span className="text-slate-300">—</span>
                            : (c.POCs || []).map((p, pi) => (
                              <div key={pi} className="text-xs">
                                <span className="font-medium text-slate-700">{p.name}</span>
                                {p.emailId && <span className="text-slate-400 ml-1">({p.emailId})</span>}
                              </div>
                            ))
                          }
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Footer left={`${filteredCompanies.length} of ${companies.length} companies`} />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
          TAB: Pending Offers
      ══════════════════════════════════════ */}
      {activeTab === "pending" && (
        <>
          {pendingLoading ? (
            <Spinner label="Loading pending offers…" />
          ) : pendingOffers.length === 0 ? (
            <Empty label={`No pending offers for ${selectedYear} — all caught up!`} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <Th>#</Th><Th>Student</Th><Th>Company</Th><Th>Created</Th><Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pendingOffers.map((o, i) => (
                      <tr key={o._id} className="hover:bg-slate-50/60 transition-colors">
                        <Td className="font-mono text-slate-400">{i + 1}</Td>
                        <Td>
                          <div className="font-semibold text-slate-900">{o.studentId?.name}</div>
                          <div className="text-xs font-mono text-slate-500">{o.studentId?.rollNumber}</div>
                          <div className="text-xs text-slate-400">{o.studentId?.emailId}</div>
                        </Td>
                        <Td>
                          <div className="font-medium text-indigo-700">{o.companyId?.name}</div>
                          <div className="text-xs text-slate-400">{o.companyId?.venue}</div>
                        </Td>
                        <Td>{fmtDate(o.createdAt)}</Td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(o._id)}
                              disabled={processing === o._id}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {processing === o._id ? "…" : "Approve"}
                            </button>
                            <button
                              onClick={() => handleReject(o._id)}
                              disabled={processing === o._id}
                              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                            >
                              {processing === o._id ? "…" : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Footer left={`${pendingOffers.length} pending offer${pendingOffers.length !== 1 ? "s" : ""}`} />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
          TAB: Confirmed Placements
      ══════════════════════════════════════ */}
      {activeTab === "confirmed" && (
        <>
          <SearchBar value={offerSearch} onChange={setOfferSearch} placeholder="Search by name, roll, email, or company…" />
          {offersLoading ? (
            <Spinner label="Loading offers…" />
          ) : filterOffers(placedStudents).length === 0 ? (
            <Empty label={offerSearch ? "No placements match your search" : `No confirmed placements for ${selectedYear}`} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <Th>#</Th><Th>Student</Th><Th>Company</Th><Th>Venue</Th><Th>Placed At</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filterOffers(placedStudents).map((o, i) => (
                      <tr key={o._id} className="hover:bg-slate-50/60 transition-colors">
                        <Td className="font-mono text-slate-400">{i + 1}</Td>
                        <Td>
                          <div className="font-semibold text-slate-900">{o.studentId?.name}</div>
                          <div className="text-xs font-mono text-slate-500">{o.studentId?.rollNumber}</div>
                          <div className="text-xs text-slate-400">{o.studentId?.emailId}</div>
                        </Td>
                        <Td><span className="font-medium text-indigo-700">{o.companyId?.name}</span></Td>
                        <Td>{o.companyId?.venue || "—"}</Td>
                        <Td>{fmtDate(o.approvedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Footer left={`${filterOffers(placedStudents).length} of ${placedStudents.length} placements`} />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
          TAB: Rejected Offers
      ══════════════════════════════════════ */}
      {activeTab === "rejected" && (
        <>
          <SearchBar value={offerSearch} onChange={setOfferSearch} placeholder="Search by name, roll, email, or company…" />
          {offersLoading ? (
            <Spinner label="Loading offers…" />
          ) : filterOffers(rejectedOffers).length === 0 ? (
            <Empty label={offerSearch ? "No rejected offers match your search" : `No rejected offers for ${selectedYear}`} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <Th>#</Th><Th>Student</Th><Th>Company</Th><Th>Rejection Reason</Th><Th>Date</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filterOffers(rejectedOffers).map((o, i) => (
                      <tr key={o._id} className="hover:bg-slate-50/60 transition-colors">
                        <Td className="font-mono text-slate-400">{i + 1}</Td>
                        <Td>
                          <div className="font-semibold text-slate-900">{o.studentId?.name}</div>
                          <div className="text-xs font-mono text-slate-500">{o.studentId?.rollNumber}</div>
                          <div className="text-xs text-slate-400">{o.studentId?.emailId}</div>
                        </Td>
                        <Td><span className="font-medium text-rose-700">{o.companyId?.name}</span></Td>
                        <Td className="italic text-slate-500">{o.remarks || "No reason provided"}</Td>
                        <Td>{fmtDate(o.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Footer left={`${filterOffers(rejectedOffers).length} of ${rejectedOffers.length} rejected offers`} />
            </div>
          )}
        </>
      )}
      {/* ══════════════════════════════════════
          Add Company Modal
      ══════════════════════════════════════ */}
      {addCompanyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Add Company to {selectedYear}</h2>
            <p className="text-sm text-slate-500 mb-5">This company will be pinned to the {selectedYear} archive.</p>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Company Name *</label>
                <input
                  ref={addCompanyInputRef}
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Goldman Sachs"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Venue (optional)</label>
                <input
                  value={newCompanyVenue}
                  onChange={e => setNewCompanyVenue(e.target.value)}
                  placeholder="e.g. Online / IIT Guwahati"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setAddCompanyOpen(false); setNewCompanyName(""); setNewCompanyVenue(""); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  disabled={addingCompany}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={addingCompany}
                >
                  {addingCompany ? "Adding…" : "Add Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Micro-components ─────────────────────────────────────────────────────────

function Th({ children }) {
  return <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-5 py-3.5 text-sm text-slate-700 ${className}`}>{children}</td>;
}
function Footer({ left }) {
  return <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">{left}</div>;
}
function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3" />
      <p className="text-slate-500 text-sm">{label}</p>
    </div>
  );
}
function Empty({ label }) {
  return <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">{label}</div>;
}
function SearchBar({ value, onChange, placeholder, nomb = false }) {
  return (
    <div className={`${nomb ? "" : "mb-4"} relative`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
      />
      <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    </div>
  );
}
