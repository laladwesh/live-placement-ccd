import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";

/* ─── Theme (oxford blue) ─────────────────────────────────────────────────── */
const T = {
  primary: "#14213D",
  primaryHover: "#1C2C4F",
  bg: "#F4F2F1",
  tint: "#E9E2DF",
  white: "#FFFFFF",
  border: "#D8D3D0",
  textMain: "#1A1A2E",
  textSub: "#6B7280",
  success: "#107C10",
  danger: "#D83B01",
  warn: "#C47700",
  info: "#0078D4",
};

const API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:4000/dday/api"
    : "/dday/api";

const TOKEN_KEY = "share_token";

function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }

function sFetch(url, opts = {}) {
  const token = getToken();
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function fmtSize(b) {
  if (!b) return "0 B";
  const k = 1024, u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + " " + u[i];
}

function fmtExpiry(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
  return `${m}m ${s}s`;
}

/* ─── Shared primitives ───────────────────────────────────────────────────── */
const card = { background: T.white, borderRadius: 10, boxShadow: "0 1px 6px rgba(20,33,61,.08)", overflow: "hidden" };

function SBtn({ color = T.primary, onClick, disabled, children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "8px 16px", background: disabled ? T.tint : color, color: disabled ? T.textSub : T.white,
        border: "none", borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap", ...style
      }}>
      {children}
    </button>
  );
}

function LabeledInput({ label, required, value, onChange, type = "text", placeholder, style = {} }) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textSub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}{required && <span style={{ color: T.danger }}> *</span>}
        </label>
      )}
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: "100%", height: 36, padding: "0 10px", fontSize: 14, fontFamily: "inherit",
          border: `1.5px solid ${focus ? T.primary : T.border}`, borderRadius: 4,
          boxSizing: "border-box", outline: "none", background: T.white, ...style
        }}
      />
    </div>
  );
}

/* ─── Password Gate ──────────────────────────────────────────────────────── */
function PasswordGate({ onAuth }) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${API}/share/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (r.ok) {
        const { token } = await r.json();
        sessionStorage.setItem(TOKEN_KEY, token);
        onAuth(token);
      } else {
        toast.error("Incorrect password");
      }
    } catch { toast.error("Connection failed"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20 }}>
      <div style={{ ...card, padding: 40, maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>🔗</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: T.primary, letterSpacing: "-0.5px" }}>Share for Care</h1>
          <p style={{ margin: 0, color: T.textSub, fontSize: 14 }}>CCD Office — IIT Guwahati</p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LabeledInput type="password" placeholder="Enter password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          <button type="submit" disabled={loading}
            style={{ padding: "12px 0", background: T.primary, color: T.white, border: "none", borderRadius: 6, fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Upload & Tools Tab ─────────────────────────────────────────────────── */
function UploadToolsTab() {
  const [busy, setBusy] = useState(false);
  const fileInputStyle = {
    width: "100%", padding: "10px 12px", border: `2px dashed ${T.border}`, borderRadius: 6,
    fontSize: 13, cursor: "pointer", boxSizing: "border-box", fontFamily: "inherit",
    background: T.bg, color: T.textMain,
  };

  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const upload = async (file, permanent) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("isPermanent", String(permanent));
    const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
    if (r.ok) toast.success(`Uploaded ${permanent ? "permanently" : "(15 min)"}`);
    else toast.error("Upload failed");
  };

  const tool = async (endpoint, fd, msg) => {
    const r = await sFetch(`${API}/share/${endpoint}`, { method: "POST", body: fd });
    if (r.ok) { const d = await r.json(); toast.success(msg(d)); }
    else { const e = await r.json().catch(() => ({})); toast.error(e.message || "Failed"); }
  };

  const SectionHead = ({ title }) => (
    <h2 style={{ margin: "0 0 18px", color: T.primary, fontSize: 18, fontWeight: 800, paddingBottom: 10, borderBottom: `2px solid ${T.tint}`, letterSpacing: "-0.3px" }}>{title}</h2>
  );

  const ToolCard = ({ icon, title, desc, children }) => (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: T.primary, marginBottom: 6 }}>{icon} {title}</div>
      {children}
      <p style={{ margin: "10px 0 0", color: T.textSub, fontSize: 12 }}>{desc}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {/* Upload */}
      <div>
        <SectionHead title="Upload Files" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[{ label: "Temporary (15 min)", perm: false, desc: "Auto-deleted after 15 minutes" },
            { label: "Permanent", perm: true, desc: "Stays until manually deleted" }].map(({ label, perm, desc }) => (
            <div key={label} style={{ ...card, padding: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.primary, marginBottom: 16 }}>{label}</div>
              <input type="file" disabled={busy}
                onChange={(e) => { run(() => upload(e.target.files[0], perm)); e.target.value = ""; }}
                style={{ ...fileInputStyle, border: `2px dashed ${T.primary}` }} />
              <p style={{ margin: "12px 0 0", color: T.textSub, fontSize: 13 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <SectionHead title="File Processing Tools" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <ToolCard icon="🖼" title="Image Compressor" desc="Compress JPEG / PNG / WebP images">
            <input type="file" accept="image/*" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("image", f); fd.append("quality", "80"); run(() => tool("tools/compress-image", fd, (d) => `Compressed! Saved ${d.reduction}`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard icon="📄" title="PDF Merger" desc="Select multiple PDFs to merge into one">
            <input type="file" accept="application/pdf" multiple disabled={busy}
              onChange={(e) => { const files = Array.from(e.target.files); if (files.length < 2) { toast.error("Select ≥2 PDFs"); return; } const fd = new FormData(); files.forEach((f) => fd.append("pdfs", f)); run(() => tool("tools/merge-pdfs", fd, (d) => `Merged! ${d.pageCount} pages`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard icon="📦" title="Files → ZIP" desc="Compress multiple files into a ZIP archive">
            <input type="file" multiple disabled={busy}
              onChange={(e) => { const files = Array.from(e.target.files); if (!files.length) return; const fd = new FormData(); files.forEach((f) => fd.append("files", f)); run(() => tool("tools/compress-files", fd, (d) => `ZIP created with ${d.fileCount} files`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard icon="📥" title="CV Bulk Downloader" desc="Excel with CV URLs → downloads all as ZIP">
            <input type="file" accept=".xlsx,.xls,.csv" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("excel", f); run(() => tool("tools/cv-downloader", fd, (d) => `CVs: ${d.success} downloaded`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard icon="🔄" title="CSV ↔ Excel" desc="Auto-detects direction — CSV to XLSX or vice versa">
            <input type="file" accept=".csv,.xlsx,.xls" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); run(() => tool("tools/convert-spreadsheet", fd, () => "Converted — check Files tab")); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard icon="📊" title="Export Placements" desc="Generate Excel of all placements from database">
            <SBtn onClick={async () => { setBusy(true); try { const r = await sFetch(`${API}/share/tools/export-placements`); if (r.ok) { const d = await r.json(); toast.success(`Exported ${d.count} placements`); } else toast.error("Export failed"); } finally { setBusy(false); } }} disabled={busy} style={{ width: "100%", padding: "10px 0" }}>
              {busy ? "Generating…" : "Generate Excel"}
            </SBtn>
          </ToolCard>
        </div>
      </div>

      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: T.white, padding: "28px 48px", borderRadius: 10, fontSize: 18, fontWeight: 700, color: T.primary }}>Processing…</div>
        </div>
      )}
    </div>
  );
}

/* ─── Excel Creator Tab ──────────────────────────────────────────────────── */
function ExcelCreatorTab() {
  const [data, setData] = useState([["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]);
  const [busy, setBusy] = useState(false);

  const setCell = (r, c, v) => { const d = data.map((row) => [...row]); d[r][c] = v; setData(d); };
  const addRow = () => setData([...data, Array(data[0]?.length || 4).fill("")]);
  const addCol = () => setData(data.map((row) => [...row, ""]));

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split("\n").map((r) => r.split("\t"));
      const maxC = Math.max(...rows.map((r) => r.length));
      setData(rows.map((r) => { const row = [...r]; while (row.length < maxC) row.push(""); return row; }));
      toast.success("Pasted!");
    } catch { toast.error("Clipboard access denied"); }
  };

  const download = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "created-excel.xlsx");
    toast.success("Downloaded!");
  };

  const uploadToFiles = async () => {
    setBusy(true);
    try {
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fd = new FormData();
      fd.append("file", blob, "created-excel.xlsx");
      fd.append("isPermanent", "false");
      const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
      if (r.ok) toast.success("Uploaded to Files tab!");
      else toast.error("Upload failed");
    } catch { toast.error("Failed"); }
    setBusy(false);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", color: T.primary, fontSize: 18, fontWeight: 800, paddingBottom: 10, borderBottom: `2px solid ${T.tint}` }}>Excel Creator & Editor</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <SBtn onClick={addRow}>+ Row</SBtn>
        <SBtn onClick={addCol}>+ Column</SBtn>
        <SBtn onClick={paste}>📋 Paste from Clipboard</SBtn>
        <SBtn onClick={uploadToFiles} disabled={busy}>⬆ Upload to Files</SBtn>
        <SBtn color={T.success} onClick={download}>⬇ Download</SBtn>
        <SBtn color={T.danger} onClick={() => setData([["", "", "", ""], ["", "", "", ""], ["", "", "", ""]])}>🗑 Clear</SBtn>
      </div>
      <div style={{ ...card, padding: 16, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri}>
                <td style={{ padding: "2px 6px", border: `1px solid ${T.tint}`, background: T.bg, fontSize: 11, color: T.textSub, textAlign: "center", userSelect: "none", minWidth: 28 }}>{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: 1, border: `1px solid ${T.tint}` }}>
                    <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)}
                      style={{ width: "100%", minWidth: 100, padding: "7px 8px", border: "none", fontSize: 14, fontFamily: "inherit", outline: "none", background: "transparent" }}
                      onFocus={(e) => (e.target.style.background = "#EEF2FF")}
                      onBlur={(e) => (e.target.style.background = "transparent")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Files Tab ──────────────────────────────────────────────────────────── */
function FilesTab() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const fetch_ = useCallback(async () => {
    const p = new URLSearchParams();
    if (search) p.append("search", search);
    if (filter !== "all") p.append("permanent", filter === "permanent");
    try {
      const r = await sFetch(`${API}/share/files?${p}`);
      if (r.ok) setFiles(await r.json());
    } catch {}
  }, [search, filter]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { const id = setInterval(fetch_, 15000); return () => clearInterval(id); }, [fetch_]);

  const download = async (shareUrl, name) => {
    setBusy(true);
    try {
      const r = await sFetch(`${API}/share/file/${shareUrl}`);
      if (r.ok) {
        const blob = await r.blob();
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        toast.success("Downloaded!"); fetch_();
      }
    } catch { toast.error("Download failed"); }
    setBusy(false);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this file?")) return;
    const r = await sFetch(`${API}/share/files/${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Deleted"); fetch_(); }
    else toast.error("Delete failed");
  };

  const copyLink = (shareUrl) => {
    navigator.clipboard.writeText(`${window.location.origin}/dday/api/share/file/${shareUrl}`)
      .then(() => toast.success("Link copied!"), () => toast.error("Copy failed"));
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <input type="text" placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 5, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => (e.target.style.borderColor = T.primary)} onBlur={(e) => (e.target.style.borderColor = T.border)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 5, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
          <option value="all">All Files</option>
          <option value="permanent">Permanent Only</option>
          <option value="temporary">Temporary Only</option>
        </select>
        <SBtn onClick={fetch_}>↻ Refresh</SBtn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!files.length
          ? <div style={{ textAlign: "center", padding: "60px 20px", color: T.textSub, fontSize: 15 }}>No files found</div>
          : files.map((f) => (
            <div key={f._id}
              style={{ ...card, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", transition: "box-shadow .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,33,61,.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = card.boxShadow)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.textMain, marginBottom: 5, wordBreak: "break-word" }}>{f.originalName}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: T.textSub }}>
                  <span>{fmtSize(f.fileSize)}</span>
                  <span>•</span>
                  <span>↓ {f.downloadCount}</span>
                  {f.isPermanent
                    ? <><span>•</span><span style={{ color: T.success, fontWeight: 700 }}>Permanent</span></>
                    : <><span>•</span><span style={{ color: T.warn, fontWeight: 700 }}>Expires {fmtExpiry(f.expiresAt)}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <SBtn color={T.info} onClick={() => copyLink(f.shareUrl)}>🔗 Copy Link</SBtn>
                <SBtn color={T.success} onClick={() => download(f.shareUrl, f.originalName)} disabled={busy}>⬇ Download</SBtn>
                <SBtn color={T.danger} onClick={() => del(f._id)}>🗑 Delete</SBtn>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── Mail Tab ───────────────────────────────────────────────────────────── */
function MailTab() {
  const [fromEmail, setFromEmail] = useState("");
  const [fromPwd, setFromPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [fromName, setFromName] = useState("Centre for Career Development");
  const [defaultCc, setDefaultCc] = useState("fc2ccd@iitg.ac.in, cdo.ccd@iitg.ac.in");
  const [delayMs, setDelayMs] = useState(600);
  const [advOpen, setAdvOpen] = useState(false);

  const [recipients, setRecipients] = useState([]);
  const [columns, setColumns] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewIdx, setPreviewIdx] = useState(0);
  const [rightTab, setRightTab] = useState("preview");

  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const esSrc = useRef(null);

  const sub = (tmpl, row) =>
    tmpl.replace(/\{\{([\w.]+)\}\}/g, (_, k) =>
      String(row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? "")
    );

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        if (rows.length) {
          setColumns(Object.keys(rows[0]));
          setRecipients(rows.map((r) => ({ ...r, _status: "pending", _error: null })));
          toast.success(`Loaded ${rows.length} recipients`);
        } else toast.error("Empty file");
      } catch { toast.error("Failed to parse"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const startSend = async () => {
    if (!fromEmail || !fromPwd) { toast.error("Enter sender email and password"); return; }
    if (!subject || !body) { toast.error("Subject and body are required"); return; }
    const pending = recipients.filter((r) => r._status === "pending" || r._status === "failed");
    if (!pending.length) { toast.error("No pending recipients"); return; }

    setSending(true); setSummary(null);
    setRecipients((rs) => rs.map((r) => r._status === "failed" ? { ...r, _status: "pending", _error: null } : r));

    try {
      const r = await sFetch(`${API}/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpEmail: fromEmail, smtpPassword: fromPwd, fromName, defaultCc, delayMs, subject, htmlBody: body, recipients: pending }),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.message || "Send failed"); setSending(false); return; }
      const { jobId: jid } = await r.json();
      setJobId(jid); setRightTab("status");
      const es = new EventSource(`${API}/mail/progress/${jid}?token=${encodeURIComponent(getToken())}`);
      esSrc.current = es;
      es.onmessage = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.type === "snapshot") {
          setJobStatus(d.jobStatus); setSummary(d.summary);
          setRecipients((rs) => rs.map((r, i) => d.rows[i] ? { ...r, _status: d.rows[i]._status, _error: d.rows[i]._error } : r));
        } else if (d.type === "update") {
          setRecipients((rs) => rs.map((r, i) => i === d.index ? { ...r, _status: d.status, _error: d.error || null } : r));
        } else if (d.type === "done") {
          setSummary(d); setJobStatus("done"); setSending(false); es.close();
          toast.success(`Done! ${d.sent} sent, ${d.failed} failed`);
        } else if (d.type === "stopped") {
          setSummary(d); setJobStatus("stopped"); setSending(false); es.close(); toast("Stopped");
        } else if (d.type === "error") {
          toast.error(d.message); setJobStatus("error"); setSending(false); es.close();
        }
      };
      es.onerror = () => { es.close(); setSending(false); };
    } catch { toast.error("Network error"); setSending(false); }
  };

  const stopSend = async () => {
    if (!jobId) return;
    await sFetch(`${API}/mail/stop/${jobId}`, { method: "POST" });
    esSrc.current?.close();
  };

  const sentCount = recipients.filter((r) => r._status === "sent").length;
  const failCount = recipients.filter((r) => r._status === "failed").length;
  const pendCount = recipients.filter((r) => r._status === "pending").length;
  const total = recipients.length;
  const progress = total ? Math.round(((sentCount + failCount) / total) * 100) : 0;
  const previewRow = recipients[previewIdx] || {};

  const inpStyle = {
    width: "100%", height: 36, padding: "0 10px", fontSize: 14, fontFamily: "inherit",
    border: `1.5px solid ${T.border}`, borderRadius: 4, boxSizing: "border-box", outline: "none", background: T.white,
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: T.textSub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div>
      {/* SMTP bar */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", borderBottom: advOpen ? `1px solid ${T.tint}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: fromEmail && fromPwd ? T.success : T.danger }} />
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: fromEmail && fromPwd ? T.success : T.danger }}>
              {fromEmail && fromPwd ? "Ready to send" : "Setup required"}
            </span>
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <label style={lbl}>From (IITG email) <span style={{ color: T.danger }}>*</span></label>
            <input type="email" placeholder="internship@iitg.ac.in" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
              style={{ ...inpStyle, border: `1.5px solid ${fromEmail ? T.success : T.danger}`, background: fromEmail ? "#F0FFF0" : "#FFF5F5" }} />
          </div>
          <div style={{ flex: "1 1 190px", minWidth: 170 }}>
            <label style={lbl}>Password <span style={{ color: T.danger }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} placeholder="App password" value={fromPwd} onChange={(e) => setFromPwd(e.target.value)}
                style={{ ...inpStyle, paddingRight: 36, fontFamily: "monospace", border: `1.5px solid ${fromPwd ? T.success : T.danger}`, background: fromPwd ? "#F0FFF0" : "#FFF5F5" }} />
              <button onClick={() => setShowPwd((p) => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.textSub }}>{showPwd ? "🙈" : "👁"}</button>
            </div>
          </div>
          <button onClick={() => setAdvOpen((o) => !o)}
            style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 700, background: advOpen ? T.primary : T.tint, color: advOpen ? T.white : T.textMain, border: `1px solid ${T.border}`, borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-end", fontFamily: "inherit" }}>
            {advOpen ? "▲ Less" : "▼ More settings"}
          </button>
        </div>
        {advOpen && (
          <div style={{ padding: "12px 20px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, background: T.bg }}>
            {[{ label: "From Name", val: fromName, set: setFromName, type: "text" },
              { label: "Default CC", val: defaultCc, set: setDefaultCc, type: "text" },
              { label: "Delay between emails (ms)", val: delayMs, set: (v) => setDelayMs(Number(v)), type: "number" }].map(({ label, val, set, type }) => (
              <div key={label}>
                <label style={lbl}>{label}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)} style={inpStyle} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 300px", gap: 14, alignItems: "start" }}>

        {/* Left: Recipients */}
        <div style={card}>
          <div style={{ padding: "12px 16px", background: T.primary }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: T.white }}>Recipients</div>
            {total > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{total} loaded</div>}
          </div>
          <div style={{ padding: 14 }}>
            <input type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { if (e.target.files[0]) { parseFile(e.target.files[0]); e.target.value = ""; } }}
              style={{ width: "100%", padding: 8, border: `2px dashed ${T.border}`, borderRadius: 5, fontSize: 12, cursor: "pointer", boxSizing: "border-box", fontFamily: "inherit", background: T.bg }} />
            {columns.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.textSub, textTransform: "uppercase", marginBottom: 4 }}>Columns (click → insert)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {columns.map((c) => (
                    <span key={c} onClick={() => setSubject((s) => s + `{{${c}}}`)}
                      style={{ padding: "2px 7px", background: "#E8F0FE", color: "#1A56DB", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                      {`{{${c}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 10 }}>
              {recipients.map((r, i) => (
                <div key={i} onClick={() => setPreviewIdx(i)}
                  style={{ padding: "5px 8px", borderRadius: 5, marginBottom: 2, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, background: previewIdx === i ? "#E8F0FE" : "transparent" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : r._status === "skipped" ? T.textSub : T.border }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.textMain }}>{r.email || r.Email || r.EMAIL || `Row ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Compose */}
        <div style={card}>
          <div style={{ padding: "12px 16px", background: T.primary }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: T.white }}>Compose</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{"Use {{column}} for variables"}</div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Internship Opportunity — {{company_name}}"
                style={inpStyle} />
            </div>
            <div>
              <label style={lbl}>Body <span style={{ fontSize: 10, textTransform: "none", letterSpacing: 0, color: T.info }}>(HTML supported)</span></label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={`<p>Dear {{contact_name}},</p>\n<p>Greetings from CCD, IIT Guwahati!</p>\n\n<p>We would like to invite <strong>{{company_name}}</strong>...</p>`}
                rows={14}
                style={{ ...inpStyle, height: "auto", padding: "10px", resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }} />
              <div style={{ marginTop: 6, fontSize: 11, color: T.textSub }}>
                HTML email body. Click column chips to insert variables.{" "}
                <a href="/dday/mail" target="_blank" rel="noreferrer" style={{ color: T.info }}>Open WYSIWYG editor →</a>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview / Status */}
        <div style={card}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.tint}` }}>
            {["preview", "status"].map((t) => (
              <button key={t} onClick={() => setRightTab(t)}
                style={{ flex: 1, padding: "11px 0", border: "none", background: rightTab === t ? T.white : T.bg, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", borderBottom: `2px solid ${rightTab === t ? T.primary : "transparent"}`, color: rightTab === t ? T.primary : T.textSub, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t === "preview" ? "Preview" : "Status"}
              </button>
            ))}
          </div>

          {rightTab === "preview" && (
            <div style={{ padding: 14 }}>
              {recipients.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Preview for</label>
                  <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))} style={{ ...inpStyle, cursor: "pointer" }}>
                    {recipients.map((r, i) => (
                      <option key={i} value={i}>{r.email || r.Email || `Row ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 8, fontSize: 12, color: T.textMain }}>
                <strong>Subj:</strong> {sub(subject, previewRow) || <em style={{ color: T.textSub }}>—</em>}
              </div>
              <div style={{ border: `1px solid ${T.tint}`, borderRadius: 6, overflow: "hidden", height: 320 }}>
                {body
                  ? <iframe srcDoc={`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:14px;margin:0;font-size:14px">${sub(body, previewRow)}</body></html>`}
                      style={{ width: "100%", height: "100%", border: "none" }} title="preview" />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.border, fontSize: 13 }}>Write body to preview</div>
                }
              </div>
            </div>
          )}

          {rightTab === "status" && (
            <div style={{ padding: 14 }}>
              {jobStatus && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, fontWeight: 600 }}>
                    <span style={{ color: jobStatus === "done" ? T.success : T.primary }}>{jobStatus === "done" ? "Complete ✓" : jobStatus === "stopped" ? "Stopped" : "Sending…"}</span>
                    <span style={{ color: T.textSub }}>{sentCount + failCount}/{total}</span>
                  </div>
                  <div style={{ background: T.tint, borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: jobStatus === "done" ? T.success : T.primary, width: `${progress}%`, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {[[sentCount, "Sent", T.success], [failCount, "Failed", T.danger], [pendCount, "Pending", T.textSub]].map(([n, l, c]) => (
                      <div key={l} style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: T.bg, borderRadius: 5 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{n}</div>
                        <div style={{ fontSize: 10, color: T.textSub, marginTop: 1 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ maxHeight: 260, overflowY: "auto", fontSize: 12 }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ padding: "5px 8px", borderRadius: 4, marginBottom: 2, display: "flex", gap: 6, alignItems: "flex-start", background: r._status === "failed" ? "#FFF5F5" : "transparent" }}>
                    <span style={{ flexShrink: 0, color: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.border }}>
                      {r._status === "sent" ? "✓" : r._status === "failed" ? "✗" : r._status === "skipped" ? "—" : "•"}
                    </span>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.textMain }}>{r.email || r.Email || `Row ${i + 1}`}</div>
                      {r._error && <div style={{ color: T.danger, fontSize: 11, marginTop: 1 }}>{r._error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send bar */}
      <div style={{ ...card, marginTop: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {!sending && jobStatus !== "done" && (
          <SBtn disabled={!total || !subject || !body || !fromEmail || !fromPwd} onClick={startSend} style={{ padding: "10px 24px", fontSize: 14 }}>
            ✉ Send to {pendCount || total} recipient{total !== 1 ? "s" : ""}
          </SBtn>
        )}
        {sending && (
          <>
            <SBtn color={T.danger} onClick={stopSend} style={{ padding: "10px 20px", fontSize: 14 }}>■ Stop</SBtn>
            <span style={{ fontSize: 14, color: T.textSub }}>Sending… {sentCount + failCount}/{total}</span>
          </>
        )}
        {jobStatus === "done" && (
          <>
            <SBtn onClick={() => { setJobId(null); setJobStatus(null); setSummary(null); setRecipients((rs) => rs.map((r) => ({ ...r, _status: "pending", _error: null }))); }} style={{ padding: "10px 20px", fontSize: 14 }}>↺ Send Again</SBtn>
            {summary && <span style={{ fontSize: 14, color: T.textSub }}>Done — {summary.sent} sent, {summary.failed} failed</span>}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function SharePage() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState("upload");

  if (!authed) {
    return (
      <>
        <Toaster position="top-right" />
        <PasswordGate onAuth={() => setAuthed(true)} />
      </>
    );
  }

  const TABS = [
    { id: "upload", label: "📁 Upload & Tools" },
    { id: "excel",  label: "📊 Excel Creator" },
    { id: "files",  label: "🗂 All Files" },
    { id: "mail",   label: "✉ Mail Sender" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={{ background: T.primary, padding: "16px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.white, letterSpacing: "-0.3px" }}>Share for Care</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2, letterSpacing: "0.04em" }}>CCD OFFICE — IIT GUWAHATI</div>
        </div>
        <button onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false); }}
          style={{ padding: "7px 18px", background: "rgba(255,255,255,0.12)", color: T.white, border: "1px solid rgba(255,255,255,0.25)", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.tint}`, padding: "0 30px", display: "flex", gap: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: tab === t.id ? T.primary : T.textSub, borderBottom: `3px solid ${tab === t.id ? T.primary : "transparent"}`, transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 30, maxWidth: 1400, margin: "0 auto" }}>
        {tab === "upload" && <UploadToolsTab />}
        {tab === "excel" && <ExcelCreatorTab />}
        {tab === "files" && <FilesTab />}
        {tab === "mail" && <MailTab />}
      </div>
    </div>
  );
}
