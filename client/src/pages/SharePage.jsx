import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";
import { EditorState, convertToRaw } from "draft-js";
import { Editor } from "react-draft-wysiwyg";
import draftToHtml from "draftjs-to-html";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

/* ─── Dark theme ──────────────────────────────────────────────────────────── */
const T = {
  primary:    "#14213D",
  accent:     "#4B7FE8",
  bg:         "#0C0F1A",
  bgCard:     "#141928",
  bgInput:    "#1A1E2E",
  bgHover:    "#1C2135",
  tint:       "#1E2338",
  border:     "#272E45",
  textMain:   "#DCE2F5",
  textSub:    "#6B739A",
  success:    "#22C55E",
  danger:     "#EF4444",
  warn:       "#F59E0B",
  info:       "#60A5FA",
  white:      "#FFFFFF",
};

const FONT = "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
const card = {
  background: T.bgCard,
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  overflow: "hidden",
};

function SBtn({ color = T.accent, onClick, disabled, children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "8px 16px",
        background: disabled ? T.tint : color,
        color: disabled ? T.textSub : T.white,
        border: "none", borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 13, fontFamily: FONT, whiteSpace: "nowrap", ...style,
      }}>
      {children}
    </button>
  );
}

const inpBase = {
  width: "100%", height: 36, padding: "0 10px", fontSize: 13, fontFamily: FONT,
  background: T.bgInput, color: T.textMain, border: `1.5px solid ${T.border}`,
  borderRadius: 4, boxSizing: "border-box", outline: "none",
};

/* ─── Font loader ────────────────────────────────────────────────────────── */
function useMontserrat() {
  useEffect(() => {
    if (document.getElementById("montserrat-font")) return;
    const link = document.createElement("link");
    link.id = "montserrat-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ─── Password Gate ──────────────────────────────────────────────────────── */
function PasswordGate({ onAuth }) {
  useMontserrat();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState(false);

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
      } else toast.error("Incorrect password");
    } catch { toast.error("Connection failed"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20, fontFamily: FONT }}>
      <div style={{ ...card, padding: 44, maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.tint, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: T.textMain, letterSpacing: "-0.5px" }}>Share for Care</h1>
          <p style={{ margin: 0, color: T.textSub, fontSize: 13 }}>CCD Office — IIT Guwahati</p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password" placeholder="Enter password" value={pwd}
            onChange={(e) => setPwd(e.target.value)} required autoFocus
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            style={{ ...inpBase, height: 42, fontSize: 14, border: `1.5px solid ${focus ? T.accent : T.border}` }}
          />
          <button type="submit" disabled={loading}
            style={{ padding: "12px 0", background: T.accent, color: T.white, border: "none", borderRadius: 6, fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: FONT, letterSpacing: "0.02em" }}>
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
    width: "100%", padding: "10px 12px",
    border: `1.5px dashed ${T.border}`,
    borderRadius: 6, fontSize: 12, cursor: "pointer",
    boxSizing: "border-box", fontFamily: FONT,
    background: T.bgInput, color: T.textSub,
  };

  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const upload = async (file, permanent) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file); fd.append("isPermanent", String(permanent));
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
    <h2 style={{ margin: "0 0 16px", color: T.textMain, fontSize: 15, fontWeight: 700, paddingBottom: 10, borderBottom: `1px solid ${T.border}`, letterSpacing: "0.02em", textTransform: "uppercase" }}>{title}</h2>
  );

  const ToolCard = ({ title, desc, children }) => (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: T.textMain, marginBottom: 10, letterSpacing: "0.01em" }}>{title}</div>
      {children}
      <p style={{ margin: "10px 0 0", color: T.textSub, fontSize: 11, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <div>
        <SectionHead title="Upload Files" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[
            { label: "Temporary", sub: "15 minutes", perm: false, desc: "File is auto-deleted after 15 minutes" },
            { label: "Permanent", sub: "Keep forever", perm: true, desc: "Stays until you manually delete it" },
          ].map(({ label, sub, perm, desc }) => (
            <div key={label} style={{ ...card, padding: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: T.textMain, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>{sub}</div>
              <input type="file" disabled={busy}
                onChange={(e) => { run(() => upload(e.target.files[0], perm)); e.target.value = ""; }}
                style={{ ...fileInputStyle, borderColor: perm ? T.accent : T.border }} />
              <p style={{ margin: "10px 0 0", color: T.textSub, fontSize: 11 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHead title="Tools" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          <ToolCard title="Image Compressor" desc="Compress JPEG, PNG or WebP images">
            <input type="file" accept="image/*" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("image", f); fd.append("quality", "80"); run(() => tool("tools/compress-image", fd, (d) => `Compressed — saved ${d.reduction}`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard title="PDF Merger" desc="Select multiple PDFs to merge into one">
            <input type="file" accept="application/pdf" multiple disabled={busy}
              onChange={(e) => { const files = Array.from(e.target.files); if (files.length < 2) { toast.error("Select at least 2 PDFs"); return; } const fd = new FormData(); files.forEach((f) => fd.append("pdfs", f)); run(() => tool("tools/merge-pdfs", fd, (d) => `Merged — ${d.pageCount} pages`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard title="Files to ZIP" desc="Bundle multiple files into a ZIP archive">
            <input type="file" multiple disabled={busy}
              onChange={(e) => { const files = Array.from(e.target.files); if (!files.length) return; const fd = new FormData(); files.forEach((f) => fd.append("files", f)); run(() => tool("tools/compress-files", fd, (d) => `ZIP created with ${d.fileCount} files`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard title="CV Bulk Downloader" desc="Upload Excel with CV URLs — downloads all as ZIP">
            <input type="file" accept=".xlsx,.xls,.csv" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("excel", f); run(() => tool("tools/cv-downloader", fd, (d) => `${d.success} CVs downloaded`)); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard title="CSV to Excel / Excel to CSV" desc="Auto-detects direction from file extension">
            <input type="file" accept=".csv,.xlsx,.xls" disabled={busy}
              onChange={(e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); run(() => tool("tools/convert-spreadsheet", fd, () => "Converted — check Files tab")); e.target.value = ""; }}
              style={fileInputStyle} />
          </ToolCard>

          <ToolCard title="Export Placements" desc="Generate an Excel file of all placements from the database">
            <SBtn disabled={busy} style={{ width: "100%", padding: "10px 0", background: busy ? T.tint : T.accent }}
              onClick={async () => { setBusy(true); try { const r = await sFetch(`${API}/share/tools/export-placements`); if (r.ok) { const d = await r.json(); toast.success(`Exported ${d.count} placements`); } else toast.error("Export failed"); } finally { setBusy(false); } }}>
              {busy ? "Generating…" : "Generate Excel"}
            </SBtn>
          </ToolCard>
        </div>
      </div>

      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, padding: "28px 48px", borderRadius: 10, fontSize: 15, fontWeight: 700, color: T.textMain, fontFamily: FONT }}>Processing…</div>
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
      toast.success("Pasted from clipboard");
    } catch { toast.error("Clipboard access denied"); }
  };

  const download = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "created-excel.xlsx");
    toast.success("Downloaded");
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
      if (r.ok) toast.success("Uploaded to Files");
      else toast.error("Upload failed");
    } catch { toast.error("Failed"); }
    setBusy(false);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", color: T.textMain, fontSize: 15, fontWeight: 700, paddingBottom: 10, borderBottom: `1px solid ${T.border}`, textTransform: "uppercase", letterSpacing: "0.02em" }}>Excel Creator</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <SBtn onClick={addRow}>Add Row</SBtn>
        <SBtn onClick={addCol}>Add Column</SBtn>
        <SBtn onClick={paste}>Paste from Clipboard</SBtn>
        <SBtn disabled={busy} onClick={uploadToFiles}>Upload to Files</SBtn>
        <SBtn color={T.success} onClick={download}>Download</SBtn>
        <SBtn color={T.danger} onClick={() => setData([["", "", "", ""], ["", "", "", ""], ["", "", "", ""]])}>Clear</SBtn>
      </div>
      <div style={{ ...card, padding: 14, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri}>
                <td style={{ padding: "2px 8px", border: `1px solid ${T.border}`, background: T.tint, fontSize: 11, color: T.textSub, textAlign: "center", userSelect: "none", minWidth: 28 }}>{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: 1, border: `1px solid ${T.border}` }}>
                    <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)}
                      style={{ width: "100%", minWidth: 100, padding: "7px 8px", border: "none", fontSize: 13, fontFamily: FONT, outline: "none", background: "transparent", color: T.textMain }}
                      onFocus={(e) => (e.target.style.background = T.bgHover)}
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
  const [focus, setFocus] = useState(false);

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
        toast.success("Downloaded"); fetch_();
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
      .then(() => toast.success("Link copied"), () => toast.error("Copy failed"));
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <input type="text" placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ ...inpBase, flex: 1, minWidth: 200, border: `1.5px solid ${focus ? T.accent : T.border}` }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ ...inpBase, width: "auto", cursor: "pointer" }}>
          <option value="all">All Files</option>
          <option value="permanent">Permanent Only</option>
          <option value="temporary">Temporary Only</option>
        </select>
        <SBtn onClick={fetch_}>Refresh</SBtn>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!files.length
          ? <div style={{ textAlign: "center", padding: "60px 20px", color: T.textSub, fontSize: 14 }}>No files found</div>
          : files.map((f) => (
            <div key={f._id}
              style={{ ...card, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = T.bgCard)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: T.textMain, marginBottom: 5, wordBreak: "break-word" }}>{f.originalName}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: T.textSub }}>
                  <span>{fmtSize(f.fileSize)}</span>
                  <span>·</span>
                  <span>{f.downloadCount} downloads</span>
                  {f.isPermanent
                    ? <><span>·</span><span style={{ color: T.success, fontWeight: 700 }}>Permanent</span></>
                    : <><span>·</span><span style={{ color: T.warn, fontWeight: 700 }}>Expires {fmtExpiry(f.expiresAt)}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <SBtn color={T.info} onClick={() => copyLink(f.shareUrl)}>Copy Link</SBtn>
                <SBtn color={T.success} onClick={() => download(f.shareUrl, f.originalName)} disabled={busy}>Download</SBtn>
                <SBtn color={T.danger} onClick={() => del(f._id)}>Delete</SBtn>
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
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const [previewIdx, setPreviewIdx] = useState(0);
  const [rightTab, setRightTab] = useState("preview");

  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const esSrc = useRef(null);

  const getBody = () => {
    const raw = convertToRaw(editorState.getCurrentContent());
    return raw.blocks.some((b) => b.text.trim()) ? draftToHtml(raw) : "";
  };

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
      } catch { toast.error("Failed to parse file"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const startSend = async () => {
    const body = getBody();
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
          toast.success(`Done — ${d.sent} sent, ${d.failed} failed`);
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
  const body = getBody();

  const lbl = { fontSize: 10, fontWeight: 700, color: T.textSub, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" };

  return (
    <div>
      {/* SMTP bar */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", borderBottom: advOpen ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: fromEmail && fromPwd ? T.success : T.danger }} />
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: fromEmail && fromPwd ? T.success : T.danger }}>
              {fromEmail && fromPwd ? "Ready" : "Setup required"}
            </span>
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <label style={lbl}>From Email <span style={{ color: T.danger }}>*</span></label>
            <input type="email" placeholder="internship@iitg.ac.in" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
              style={{ ...inpBase, border: `1.5px solid ${fromEmail ? T.success : T.danger}`, background: fromEmail ? "#0D1F12" : "#1F0D0D" }} />
          </div>
          <div style={{ flex: "1 1 190px", minWidth: 170 }}>
            <label style={lbl}>Password <span style={{ color: T.danger }}>*</span></label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} placeholder="App password" value={fromPwd} onChange={(e) => setFromPwd(e.target.value)}
                style={{ ...inpBase, paddingRight: 36, fontFamily: "monospace", border: `1.5px solid ${fromPwd ? T.success : T.danger}`, background: fromPwd ? "#0D1F12" : "#1F0D0D" }} />
              <button onClick={() => setShowPwd((p) => !p)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.textSub }}>
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button onClick={() => setAdvOpen((o) => !o)}
            style={{ height: 36, padding: "0 14px", fontSize: 11, fontWeight: 700, background: advOpen ? T.accent : T.tint, color: advOpen ? T.white : T.textSub, border: `1px solid ${T.border}`, borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-end", fontFamily: FONT, letterSpacing: "0.04em" }}>
            {advOpen ? "Less" : "More Settings"}
          </button>
        </div>
        {advOpen && (
          <div style={{ padding: "12px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, background: T.tint }}>
            {[
              { label: "From Name", val: fromName, set: setFromName, type: "text" },
              { label: "Default CC", val: defaultCc, set: setDefaultCc, type: "text" },
              { label: "Delay (ms)", val: delayMs, set: (v) => setDelayMs(Number(v)), type: "number" },
            ].map(({ label, val, set, type }) => (
              <div key={label}>
                <label style={lbl}>{label}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)} style={inpBase} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 290px", gap: 12, alignItems: "start" }}>

        {/* Left: Recipients */}
        <div style={card}>
          <div style={{ padding: "11px 14px", background: T.primary, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: T.textMain, letterSpacing: "0.04em", textTransform: "uppercase" }}>Recipients</div>
            {total > 0 && <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>{total} loaded</div>}
          </div>
          <div style={{ padding: 12 }}>
            <input type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { if (e.target.files[0]) { parseFile(e.target.files[0]); e.target.value = ""; } }}
              style={{ width: "100%", padding: "8px 10px", border: `1.5px dashed ${T.border}`, borderRadius: 5, fontSize: 11, cursor: "pointer", boxSizing: "border-box", fontFamily: FONT, background: T.bgInput, color: T.textSub }} />
            {columns.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Click to insert</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {columns.map((c) => (
                    <span key={c} onClick={() => setSubject((s) => s + `{{${c}}}`)}
                      style={{ padding: "2px 7px", background: "#1A2340", color: T.accent, border: `1px solid ${T.accent}30`, borderRadius: 4, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                      {`{{${c}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 10 }}>
              {recipients.map((r, i) => (
                <div key={i} onClick={() => setPreviewIdx(i)}
                  style={{ padding: "5px 8px", borderRadius: 5, marginBottom: 2, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6, background: previewIdx === i ? T.bgHover : "transparent" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.border }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.textMain }}>{r.email || r.Email || r.EMAIL || `Row ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Compose */}
        <div style={card}>
          <div style={{ padding: "11px 14px", background: T.primary, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: T.textMain, letterSpacing: "0.04em", textTransform: "uppercase" }}>Compose</div>
            <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>{"Use {{column}} for variable substitution"}</div>
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Internship Opportunity — {{company_name}}"
                style={inpBase} />
            </div>
            <div>
              <label style={lbl}>Body</label>
              {/* WYSIWYG editor — wrapper and toolbar styled to match dark theme */}
              <style>{`
                .wysiwyg-dark .rdw-editor-wrapper { background: ${T.bgInput}; border-radius: 4px; border: 1.5px solid ${T.border}; }
                .wysiwyg-dark .rdw-editor-toolbar { background: ${T.tint}; border: none; border-bottom: 1px solid ${T.border}; padding: 6px 8px; border-radius: 0; }
                .wysiwyg-dark .rdw-option-wrapper { background: ${T.bgInput}; border: 1px solid ${T.border}; border-radius: 3px; min-width: 24px; height: 24px; }
                .wysiwyg-dark .rdw-option-wrapper:hover { background: ${T.bgHover}; border-color: ${T.accent}; }
                .wysiwyg-dark .rdw-option-active { background: ${T.accent}20; border-color: ${T.accent}; }
                .wysiwyg-dark .rdw-option-wrapper img { filter: invert(0.8); }
                .wysiwyg-dark .rdw-dropdown-wrapper { background: ${T.bgInput}; border: 1px solid ${T.border}; border-radius: 3px; }
                .wysiwyg-dark .rdw-dropdown-wrapper:hover { background: ${T.bgHover}; }
                .wysiwyg-dark .rdw-dropdown-selectedtext { color: ${T.textMain}; font-family: ${FONT}; font-size: 12px; }
                .wysiwyg-dark .rdw-dropdownoption-default { background: ${T.bgCard}; color: ${T.textMain}; font-family: ${FONT}; }
                .wysiwyg-dark .rdw-dropdownoption-default:hover { background: ${T.bgHover}; }
                .wysiwyg-dark .rdw-dropdownoption-active { background: ${T.accent}30; }
                .wysiwyg-dark .rdw-editor-main { color: ${T.textMain}; font-family: ${FONT}; font-size: 13px; min-height: 220px; max-height: 340px; overflow-y: auto; padding: 10px 14px; }
                .wysiwyg-dark .DraftEditor-root { color: ${T.textMain}; }
                .wysiwyg-dark .public-DraftEditorPlaceholder-root { color: ${T.textSub}; }
                .wysiwyg-dark .rdw-colorpicker-modal, .wysiwyg-dark .rdw-link-modal { background: ${T.bgCard}; border: 1px solid ${T.border}; color: ${T.textMain}; }
                .wysiwyg-dark .rdw-colorpicker-modal-header span { color: ${T.textMain}; }
                .wysiwyg-dark .rdw-link-modal-label { color: ${T.textSub}; }
                .wysiwyg-dark .rdw-link-modal-input { background: ${T.bgInput}; border: 1px solid ${T.border}; color: ${T.textMain}; border-radius: 3px; padding: 4px 8px; font-family: ${FONT}; }
                .wysiwyg-dark .rdw-link-modal-btn { background: ${T.accent}; color: white; border: none; border-radius: 3px; padding: 4px 12px; cursor: pointer; font-family: ${FONT}; }
                .wysiwyg-dark .rdw-dropdown-carettoopen, .wysiwyg-dark .rdw-dropdown-carettoclose { border-top-color: ${T.textSub}; border-bottom-color: ${T.textSub}; }
              `}</style>
              <div className="wysiwyg-dark">
                <Editor
                  editorState={editorState}
                  onEditorStateChange={setEditorState}
                  wrapperStyle={{ margin: 0 }}
                  toolbarStyle={{ margin: 0 }}
                  editorStyle={{ lineHeight: 1.6 }}
                  placeholder="Dear {{contact_name}}, Greetings from CCD, IIT Guwahati…"
                  toolbar={{
                    options: ["inline", "blockType", "fontSize", "list", "textAlign", "colorPicker", "link", "history"],
                    inline: { options: ["bold", "italic", "underline", "strikethrough"] },
                    blockType: { options: ["Normal", "H1", "H2", "H3", "Blockquote"] },
                    fontSize: { options: [10, 11, 12, 13, 14, 16, 18, 24, 36] },
                    list: { options: ["ordered", "unordered"] },
                    textAlign: { options: ["left", "center", "right", "justify"] },
                    link: { defaultTargetOption: "_blank" },
                    history: { options: ["undo", "redo"] },
                  }}
                />
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: T.textSub }}>Click column chips to insert variables into subject or body.</div>
            </div>
          </div>
        </div>

        {/* Right: Preview / Status */}
        <div style={card}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
            {["preview", "status"].map((t) => (
              <button key={t} onClick={() => setRightTab(t)}
                style={{ flex: 1, padding: "11px 0", border: "none", background: rightTab === t ? T.bgCard : T.tint, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: FONT, borderBottom: `2px solid ${rightTab === t ? T.accent : "transparent"}`, color: rightTab === t ? T.accent : T.textSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t === "preview" ? "Preview" : "Status"}
              </button>
            ))}
          </div>

          {rightTab === "preview" && (
            <div style={{ padding: 12 }}>
              {recipients.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Preview for</label>
                  <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))}
                    style={{ ...inpBase, cursor: "pointer" }}>
                    {recipients.map((r, i) => (
                      <option key={i} value={i}>{r.email || r.Email || `Row ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 8, fontSize: 11, color: T.textMain }}>
                <span style={{ color: T.textSub }}>Subject: </span>{sub(subject, previewRow) || <em style={{ color: T.textSub }}>—</em>}
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden", height: 300 }}>
                {body
                  ? <iframe srcDoc={`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:14px;margin:0;font-size:13px">${sub(body, previewRow)}</body></html>`}
                      style={{ width: "100%", height: "100%", border: "none", background: "white" }} title="preview" />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.border, fontSize: 12 }}>Write body to preview</div>
                }
              </div>
            </div>
          )}

          {rightTab === "status" && (
            <div style={{ padding: 12 }}>
              {jobStatus && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, fontWeight: 700 }}>
                    <span style={{ color: jobStatus === "done" ? T.success : T.accent }}>{jobStatus === "done" ? "Complete" : jobStatus === "stopped" ? "Stopped" : "Sending…"}</span>
                    <span style={{ color: T.textSub }}>{sentCount + failCount}/{total}</span>
                  </div>
                  <div style={{ background: T.tint, borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: jobStatus === "done" ? T.success : T.accent, width: `${progress}%`, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {[[sentCount, "Sent", T.success], [failCount, "Failed", T.danger], [pendCount, "Pending", T.textSub]].map(([n, l, c]) => (
                      <div key={l} style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: T.tint, borderRadius: 5 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{n}</div>
                        <div style={{ fontSize: 9, color: T.textSub, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ maxHeight: 260, overflowY: "auto", fontSize: 11 }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ padding: "5px 8px", borderRadius: 4, marginBottom: 2, display: "flex", gap: 6, alignItems: "flex-start", background: r._status === "failed" ? "#2A0D0D" : "transparent" }}>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.border }}>
                      {r._status === "sent" ? "+" : r._status === "failed" ? "x" : r._status === "skipped" ? "-" : "·"}
                    </span>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.textMain }}>{r.email || r.Email || `Row ${i + 1}`}</div>
                      {r._error && <div style={{ color: T.danger, fontSize: 10, marginTop: 1 }}>{r._error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send bar */}
      <div style={{ ...card, marginTop: 12, padding: "13px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {!sending && jobStatus !== "done" && (
          <SBtn disabled={!total || !subject || !body || !fromEmail || !fromPwd} onClick={startSend} style={{ padding: "10px 24px", fontSize: 13 }}>
            Send to {pendCount || total} recipient{total !== 1 ? "s" : ""}
          </SBtn>
        )}
        {sending && (
          <>
            <SBtn color={T.danger} onClick={stopSend} style={{ padding: "10px 20px", fontSize: 13 }}>Stop</SBtn>
            <span style={{ fontSize: 13, color: T.textSub }}>Sending… {sentCount + failCount}/{total}</span>
          </>
        )}
        {jobStatus === "done" && (
          <>
            <SBtn onClick={() => { setJobId(null); setJobStatus(null); setSummary(null); setRecipients((rs) => rs.map((r) => ({ ...r, _status: "pending", _error: null }))); }} style={{ padding: "10px 20px", fontSize: 13 }}>Send Again</SBtn>
            {summary && <span style={{ fontSize: 13, color: T.textSub }}>Done — {summary.sent} sent, {summary.failed} failed</span>}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function SharePage() {
  useMontserrat();
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
    { id: "upload", label: "Upload & Tools" },
    { id: "excel",  label: "Excel Creator" },
    { id: "files",  label: "All Files" },
    { id: "mail",   label: "Mail Sender" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={{ background: T.primary, padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.textMain, letterSpacing: "-0.3px" }}>Share for Care</div>
          <div style={{ fontSize: 10, color: "rgba(220,226,245,0.4)", marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>CCD Office — IIT Guwahati</div>
        </div>
        <button onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false); }}
          style={{ padding: "6px 16px", background: "rgba(255,255,255,0.07)", color: T.textSub, border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 5, cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: FONT, letterSpacing: "0.03em" }}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: T.bgCard, borderBottom: `1px solid ${T.border}`, padding: "0 28px", display: "flex", gap: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "13px 18px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: FONT, letterSpacing: "0.04em", textTransform: "uppercase", color: tab === t.id ? T.accent : T.textSub, borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`, transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 28, maxWidth: 1400, margin: "0 auto" }}>
        {tab === "upload" && <UploadToolsTab />}
        {tab === "excel"  && <ExcelCreatorTab />}
        {tab === "files"  && <FilesTab />}
        {tab === "mail"   && <MailTab />}
      </div>
    </div>
  );
}
