import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";
import { EditorState, convertToRaw, convertFromRaw } from "draft-js";
import { Editor } from "react-draft-wysiwyg";
import draftToHtml from "draftjs-to-html";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

/* ─── Theme ──────────────────────────────────────────────────────────────── */
const T = {
  bg:       "#0a0a0a",
  surface:  "#111111",
  elevated: "#1a1a1a",
  border:   "#222222",
  borderHi: "#333333",
  text:     "#e8e8e8",
  muted:    "#555555",
  accent:   "#4f7cf7",
  success:  "#22c55e",
  danger:   "#ef4444",
  warn:     "#f59e0b",
};

const FONT = "'Roboto', system-ui, sans-serif";

const API =
  process.env.NODE_ENV === "development"
    ? "http://localhost:4000/dday/api"
    : "/dday/api";

const TOKEN_KEY = "share_token";
const DRAFT_KEY = "ccd_mail_drafts";

const getToken = () => sessionStorage.getItem(TOKEN_KEY) || "";

function sFetch(url, opts = {}) {
  const token = getToken();
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

function loadMailDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); } catch { return []; }
}
function persistDrafts(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
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
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m}m` : "<1m";
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ─── Base styles ────────────────────────────────────────────────────────── */
const inp = {
  display: "block", width: "100%", padding: "7px 10px",
  background: T.elevated, color: T.text, border: `1px solid ${T.border}`,
  borderRadius: 4, fontSize: 13, fontFamily: FONT, outline: "none",
  boxSizing: "border-box",
};

function Btn({ children, onClick, disabled, danger, ghost, small, style = {} }) {
  const base = {
    padding: small ? "4px 10px" : "7px 14px",
    fontSize: small ? 11 : 12,
    fontWeight: 600, fontFamily: FONT,
    border: `1px solid ${T.border}`,
    borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap", transition: "background .1s, border-color .1s",
    background: danger ? "#2a0a0a" : ghost ? "transparent" : T.elevated,
    color: disabled ? T.muted : danger ? T.danger : ghost ? T.muted : T.text,
    opacity: disabled ? 0.5 : 1,
    ...style,
  };
  return <button onClick={disabled ? undefined : onClick} style={base}>{children}</button>;
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{children}</div>;
}

/* ─── Font loader ────────────────────────────────────────────────────────── */
function useMontserrat() {
  useEffect(() => {
    if (document.getElementById("mf")) return;
    const l = document.createElement("link");
    l.id = "mf"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ─── Password Gate ──────────────────────────────────────────────────────── */
function PasswordGate({ onAuth }) {
  useMontserrat();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const r = await fetch(`${API}/share/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (r.ok) { const { token } = await r.json(); sessionStorage.setItem(TOKEN_KEY, token); onAuth(token); }
      else toast.error("Incorrect password");
    } catch { toast.error("Connection failed"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: FONT }}>
      <div style={{ width: 320, padding: "36px 28px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Share for Care</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 28 }}>CCD — IIT Guwahati</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" placeholder="Password" value={pwd} onChange={(e) => setPwd(e.target.value)} required autoFocus style={{ ...inp }} />
          <button type="submit" disabled={loading}
            style={{ padding: "9px 0", background: T.accent, color: "#fff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT, opacity: loading ? 0.7 : 1 }}>
            {loading ? "…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Upload & Tools Tab ─────────────────────────────────────────────────── */
function UploadToolsTab() {
  const [busy, setBusy] = useState(false);

  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const upload = async (file, permanent) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file); fd.append("isPermanent", String(permanent));
    const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
    if (r.ok) toast.success(`Uploaded${permanent ? " permanently" : " (15 min)"}`);
    else toast.error("Upload failed");
  };

  const tool = async (endpoint, fd, msg) => {
    const r = await sFetch(`${API}/share/${endpoint}`, { method: "POST", body: fd });
    if (r.ok) { const d = await r.json(); toast.success(msg(d)); }
    else { const e = await r.json().catch(() => ({})); toast.error(e.message || "Failed"); }
  };

  const fileInp = (accept, multiple, onChange) => (
    <input type="file" accept={accept} multiple={multiple} disabled={busy} onChange={onChange}
      style={{ ...inp, cursor: "pointer", padding: "6px 8px", fontSize: 11, color: T.muted }} />
  );

  const row = (label, desc, children) => (
    <div key={label} style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{label}</span>
        <span style={{ fontSize: 11, color: T.muted }}>{desc}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>Upload files or run tools on them</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
        {row("Temporary upload", "auto-deleted after 15 min",
          fileInp("*", false, (e) => { run(() => upload(e.target.files[0], false)); e.target.value = ""; })
        )}
        {row("Permanent upload", "stays until deleted",
          fileInp("*", false, (e) => { run(() => upload(e.target.files[0], true)); e.target.value = ""; })
        )}
        {row("Compress image", "JPEG / PNG / WebP",
          fileInp("image/*", false, (e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("image", f); fd.append("quality", "80"); run(() => tool("tools/compress-image", fd, (d) => `Compressed — saved ${d.reduction}`)); e.target.value = ""; })
        )}
        {row("Merge PDFs", "select 2+ PDFs",
          fileInp("application/pdf", true, (e) => { const fs = Array.from(e.target.files); if (fs.length < 2) { toast.error("Need 2+ PDFs"); return; } const fd = new FormData(); fs.forEach((f) => fd.append("pdfs", f)); run(() => tool("tools/merge-pdfs", fd, (d) => `Merged — ${d.pageCount} pages`)); e.target.value = ""; })
        )}
        {row("Compress to ZIP", "bundle files",
          fileInp("*", true, (e) => { const fs = Array.from(e.target.files); if (!fs.length) return; const fd = new FormData(); fs.forEach((f) => fd.append("files", f)); run(() => tool("tools/compress-files", fd, (d) => `ZIP with ${d.fileCount} files`)); e.target.value = ""; })
        )}
        {row("CV bulk downloader", "Excel with CV URLs → ZIP",
          fileInp(".xlsx,.xls,.csv", false, (e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("excel", f); run(() => tool("tools/cv-downloader", fd, (d) => `${d.success} CVs downloaded`)); e.target.value = ""; })
        )}
        {row("Convert spreadsheet", "CSV ↔ Excel, auto-detected",
          fileInp(".csv,.xlsx,.xls", false, (e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); run(() => tool("tools/convert-spreadsheet", fd, () => "Converted")); e.target.value = ""; })
        )}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: T.text }}>Export placements</span>
            <span style={{ fontSize: 11, color: T.muted }}>generates Excel from database</span>
          </div>
          <Btn disabled={busy} onClick={async () => { setBusy(true); try { const r = await sFetch(`${API}/share/tools/export-placements`); if (r.ok) { const d = await r.json(); toast.success(`${d.count} placements exported`); } else toast.error("Export failed"); } finally { setBusy(false); } }}>
            {busy ? "Generating…" : "Generate"}
          </Btn>
        </div>
      </div>
      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "20px 36px", borderRadius: 6, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT }}>Processing…</div>
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

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split("\n").map((r) => r.split("\t"));
      const maxC = Math.max(...rows.map((r) => r.length));
      setData(rows.map((r) => { const row = [...r]; while (row.length < maxC) row.push(""); return row; }));
      toast.success("Pasted");
    } catch { toast.error("Clipboard denied"); }
  };

  const download = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "created.xlsx");
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
      const fd = new FormData(); fd.append("file", blob, "created.xlsx"); fd.append("isPermanent", "false");
      const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
      if (r.ok) toast.success("Uploaded"); else toast.error("Upload failed");
    } catch { toast.error("Failed"); }
    setBusy(false);
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Btn onClick={() => setData([...data, Array(data[0]?.length || 4).fill("")])} small>+ Row</Btn>
        <Btn onClick={() => setData(data.map((r) => [...r, ""]))} small>+ Column</Btn>
        <Btn onClick={paste} small>Paste</Btn>
        <Btn onClick={uploadToFiles} disabled={busy} small>Upload</Btn>
        <Btn onClick={download} small>Download</Btn>
        <Btn onClick={() => setData([["","","",""],["","","",""],["","","",""]])} danger small>Clear</Btn>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 400 }}>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri}>
                <td style={{ padding: "0 8px", borderRight: `1px solid ${T.border}`, fontSize: 10, color: T.muted, textAlign: "center", background: T.surface, minWidth: 28, userSelect: "none" }}>{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: 0, border: `1px solid ${T.border}` }}>
                    <input value={cell} onChange={(e) => setCell(ri, ci, e.target.value)}
                      style={{ width: "100%", minWidth: 90, padding: "6px 8px", border: "none", fontSize: 12, fontFamily: FONT, outline: "none", background: "transparent", color: T.text, boxSizing: "border-box" }}
                      onFocus={(e) => (e.target.style.background = T.elevated)}
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
    try { const r = await sFetch(`${API}/share/files?${p}`); if (r.ok) setFiles(await r.json()); } catch {}
  }, [search, filter]);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => { const id = setInterval(fetch_, 15000); return () => clearInterval(id); }, [fetch_]);

  const download = async (shareUrl, name) => {
    setBusy(true);
    try {
      const r = await sFetch(`${API}/share/file/${shareUrl}`);
      if (r.ok) { const blob = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); fetch_(); }
    } catch { toast.error("Download failed"); }
    setBusy(false);
  };

  const del = async (id) => {
    if (!window.confirm("Delete?")) return;
    const r = await sFetch(`${API}/share/files/${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("Deleted"); fetch_(); } else toast.error("Failed");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
          <option value="all">All</option>
          <option value="permanent">Permanent</option>
          <option value="temporary">Temporary</option>
        </select>
        <Btn onClick={fetch_} small>Refresh</Btn>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
        {!files.length
          ? <div style={{ padding: "48px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>No files</div>
          : files.map((f, idx) => (
            <div key={f._id} style={{ padding: "12px 16px", borderBottom: idx < files.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 3, wordBreak: "break-word" }}>{f.originalName}</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {fmtSize(f.fileSize)} · {f.downloadCount} downloads · {f.isPermanent ? <span style={{ color: T.success }}>permanent</span> : <span>expires {fmtExpiry(f.expiresAt)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn small onClick={() => navigator.clipboard.writeText(`${window.location.origin}/dday/api/share/file/${f.shareUrl}`).then(() => toast.success("Copied"), () => toast.error("Failed"))}>Copy link</Btn>
                <Btn small onClick={() => download(f.shareUrl, f.originalName)} disabled={busy}>Download</Btn>
                <Btn small danger onClick={() => del(f._id)}>Delete</Btn>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── Mail Tab ───────────────────────────────────────────────────────────── */
function MailTab() {
  /* SMTP */
  const [fromEmail, setFromEmail] = useState("");
  const [fromPwd, setFromPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [fromName, setFromName] = useState("Centre for Career Development");
  const [defaultCc, setDefaultCc] = useState("fc2ccd@iitg.ac.in, cdo.ccd@iitg.ac.in");
  const [delayMs, setDelayMs] = useState(600);
  const [advOpen, setAdvOpen] = useState(false);

  /* Test email */
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  /* Compose */
  const [recipients, setRecipients] = useState([]);
  const [columns, setColumns] = useState([]);
  const [subject, setSubject] = useState("");
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const [previewIdx, setPreviewIdx] = useState(0);
  const [rightTab, setRightTab] = useState("preview");

  /* Send */
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const esSrc = useRef(null);

  /* Drafts */
  const [drafts, setDrafts] = useState(() => loadMailDrafts());
  const [draftSearch, setDraftSearch] = useState("");
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [renameName, setRenameName] = useState("");

  /* helpers */
  const getBody = () => {
    const raw = convertToRaw(editorState.getCurrentContent());
    return raw.blocks.some((b) => b.text.trim()) ? draftToHtml(raw) : "";
  };
  const sub = (tmpl, row) => tmpl.replace(/\{\{([\w.]+)\}\}/g, (_, k) => String(row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? ""));

  /* draft CRUD */
  const saveDraft = () => {
    if (!draftName.trim()) { toast.error("Enter a name"); return; }
    const body = getBody();
    if (!subject && !body) { toast.error("Nothing to save"); return; }
    const entry = { id: Date.now().toString(), name: draftName.trim(), subject, body, rawContent: convertToRaw(editorState.getCurrentContent()), savedAt: new Date().toISOString() };
    const next = [entry, ...drafts];
    setDrafts(next); persistDrafts(next);
    setDraftName(""); setShowSavePanel(false);
    toast.success(`Saved "${entry.name}"`);
  };

  const loadDraft = (draft) => {
    setSubject(draft.subject || "");
    if (draft.rawContent) {
      try { setEditorState(EditorState.createWithContent(convertFromRaw(draft.rawContent))); }
      catch { setEditorState(EditorState.createEmpty()); }
    }
    toast.success(`Loaded "${draft.name}"`);
  };

  const deleteDraft = (id) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next); persistDrafts(next); toast.success("Deleted");
  };

  const duplicateDraft = (draft) => {
    const entry = { ...draft, id: Date.now().toString(), name: `Copy of ${draft.name}`, savedAt: new Date().toISOString() };
    const next = [entry, ...drafts];
    setDrafts(next); persistDrafts(next); toast.success("Duplicated");
  };

  const renameDraft = (id) => {
    if (!renameName.trim()) return;
    const next = drafts.map((d) => d.id === id ? { ...d, name: renameName.trim() } : d);
    setDrafts(next); persistDrafts(next); setEditingId(null); toast.success("Renamed");
  };

  const updateDraft = (id) => {
    const raw = convertToRaw(editorState.getCurrentContent());
    const body = getBody();
    const next = drafts.map((d) => d.id === id ? { ...d, subject, body, rawContent: raw, savedAt: new Date().toISOString() } : d);
    setDrafts(next); persistDrafts(next); toast.success("Draft updated");
  };

  /* test email */
  const sendTest = async () => {
    if (!fromEmail || !fromPwd) { toast.error("Enter SMTP credentials first"); return; }
    if (!testTo.trim()) { toast.error("Enter recipient email"); return; }
    setTestBusy(true);
    try {
      const body = getBody();
      const r = await sFetch(`${API}/mail/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpEmail: fromEmail, smtpPassword: fromPwd, fromName, toEmail: testTo.trim(), subject: subject || "(Test)", htmlBody: body || "<p>Test from CCD Mail Sender.</p>" }),
      });
      if (r.ok) toast.success(`Test sent to ${testTo}`);
      else { const d = await r.json(); toast.error(d.message || "Test failed"); }
    } catch { toast.error("Network error"); }
    setTestBusy(false);
  };

  /* parse recipients file */
  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        if (rows.length) {
          setColumns(Object.keys(rows[0]));
          setRecipients(rows.map((r) => ({ ...r, _status: "pending", _error: null })));
          toast.success(`${rows.length} recipients loaded`);
        } else toast.error("Empty file");
      } catch { toast.error("Failed to parse file"); }
    };
    reader.readAsArrayBuffer(file);
  };

  /* send */
  const startSend = async () => {
    const body = getBody();
    if (!fromEmail || !fromPwd) { toast.error("SMTP credentials required"); return; }
    if (!subject || !body) { toast.error("Subject and body required"); return; }
    const pending = recipients.filter((r) => r._status === "pending" || r._status === "failed");
    if (!pending.length) { toast.error("No pending recipients"); return; }
    setSending(true); setSummary(null);
    setRecipients((rs) => rs.map((r) => r._status === "failed" ? { ...r, _status: "pending", _error: null } : r));
    try {
      const r = await sFetch(`${API}/mail/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtpEmail: fromEmail, smtpPassword: fromPwd, fromName, defaultCc, delayMs, subject, htmlBody: body, recipients: pending }),
      });
      if (!r.ok) { const d = await r.json(); toast.error(d.message || "Failed"); setSending(false); return; }
      const { jobId: jid } = await r.json();
      setJobId(jid); setRightTab("status");
      const es = new EventSource(`${API}/mail/progress/${jid}?token=${encodeURIComponent(getToken())}`);
      esSrc.current = es;
      es.onmessage = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.type === "snapshot") { setJobStatus(d.jobStatus); setSummary(d.summary); setRecipients((rs) => rs.map((r, i) => d.rows[i] ? { ...r, _status: d.rows[i]._status, _error: d.rows[i]._error } : r)); }
        else if (d.type === "update") { setRecipients((rs) => rs.map((r, i) => i === d.index ? { ...r, _status: d.status, _error: d.error || null } : r)); }
        else if (d.type === "done") { setSummary(d); setJobStatus("done"); setSending(false); es.close(); toast.success(`Done — ${d.sent} sent, ${d.failed} failed`); }
        else if (d.type === "stopped") { setSummary(d); setJobStatus("stopped"); setSending(false); es.close(); toast("Stopped"); }
        else if (d.type === "error") { toast.error(d.message); setJobStatus("error"); setSending(false); es.close(); }
      };
      es.onerror = () => { es.close(); setSending(false); };
    } catch { toast.error("Network error"); setSending(false); }
  };

  const stopSend = async () => { if (!jobId) return; await sFetch(`${API}/mail/stop/${jobId}`, { method: "POST" }); esSrc.current?.close(); };

  /* derived */
  const sentCount = recipients.filter((r) => r._status === "sent").length;
  const failCount = recipients.filter((r) => r._status === "failed").length;
  const pendCount = recipients.filter((r) => r._status === "pending").length;
  const total = recipients.length;
  const progress = total ? Math.round(((sentCount + failCount) / total) * 100) : 0;
  const previewRow = recipients[previewIdx] || {};
  const body = getBody();
  const filteredDrafts = draftSearch
    ? drafts.filter((d) => d.name.toLowerCase().includes(draftSearch.toLowerCase()) || (d.subject || "").toLowerCase().includes(draftSearch.toLowerCase()))
    : drafts;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* SMTP */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", borderBottom: advOpen ? `1px solid ${T.border}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "center", flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: fromEmail && fromPwd ? T.success : T.danger }} />
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{fromEmail && fromPwd ? "Ready" : "Not configured"}</span>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <Label>From Email *</Label>
            <input type="email" placeholder="internship@iitg.ac.in" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
              style={{ ...inp, borderColor: fromEmail ? T.success : T.danger }} />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <Label>Password *</Label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} placeholder="App password" value={fromPwd} onChange={(e) => setFromPwd(e.target.value)}
                style={{ ...inp, paddingRight: 44, fontFamily: "monospace", borderColor: fromPwd ? T.success : T.danger }} />
              <button onClick={() => setShowPwd((p) => !p)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.muted, fontFamily: FONT }}>
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <Btn onClick={() => setAdvOpen((o) => !o)} style={{ alignSelf: "flex-end" }}>{advOpen ? "Less" : "More"}</Btn>
        </div>

        {advOpen && (
          <div style={{ padding: "14px 16px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
              {[["From Name", fromName, setFromName, "text"], ["Default CC", defaultCc, setDefaultCc, "text"], ["Delay (ms)", delayMs, (v) => setDelayMs(Number(v)), "number"]].map(([label, val, set, type]) => (
                <div key={label}>
                  <Label>{label}</Label>
                  <input type={type} value={val} onChange={(e) => set(e.target.value)} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <Label>Send test email</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="email" placeholder="test@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ ...inp, flex: "1 1 200px" }} />
                <Btn onClick={sendTest} disabled={testBusy || !fromEmail || !fromPwd}>{testBusy ? "Sending…" : "Send Test"}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3-col */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 10, alignItems: "start" }}>

        {/* Recipients */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Recipients</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{total > 0 ? `${total} loaded · ${pendCount} pending` : "Upload CSV or Excel"}</div>
          </div>
          <div style={{ padding: 10 }}>
            <input type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { if (e.target.files[0]) { parseFile(e.target.files[0]); e.target.value = ""; } }}
              style={{ ...inp, fontSize: 11, cursor: "pointer", color: T.muted, padding: "6px 8px", border: `1px dashed ${T.border}` }} />
            {columns.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: T.muted, marginBottom: 5, letterSpacing: "0.05em", textTransform: "uppercase" }}>Insert into subject</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {columns.map((c) => (
                    <span key={c} onClick={() => setSubject((s) => s + `{{${c}}}`)}
                      style={{ padding: "2px 6px", background: T.elevated, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 10, cursor: "pointer" }}>
                      {`{{${c}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ maxHeight: 280, overflowY: "auto", marginTop: 8 }}>
              {recipients.map((r, i) => (
                <div key={i} onClick={() => setPreviewIdx(i)}
                  style={{ padding: "4px 6px", borderRadius: 3, marginBottom: 1, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6, background: previewIdx === i ? T.elevated : "transparent" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.border }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: previewIdx === i ? T.text : T.muted }}>{r.email || r.Email || r.EMAIL || `Row ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compose */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Compose</div>
            <button onClick={() => { setShowSavePanel((s) => !s); setDraftName(""); }}
              style={{ padding: "3px 10px", background: "transparent", color: showSavePanel ? T.accent : T.muted, border: `1px solid ${showSavePanel ? T.accent : T.border}`, borderRadius: 3, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: FONT }}>
              {showSavePanel ? "Cancel" : "Save Draft"}
            </button>
          </div>

          {showSavePanel && (
            <div style={{ padding: "8px 12px", background: T.bg, borderBottom: `1px solid ${T.border}`, display: "flex", gap: 6 }}>
              <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveDraft()}
                placeholder="Draft name…"
                style={{ ...inp, flex: 1 }} />
              <Btn onClick={saveDraft}>Save</Btn>
            </div>
          )}

          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <Label>Subject</Label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject — {{column}}"
                style={inp} />
            </div>
            <div>
              <Label>Body</Label>
              <style>{`
                .wd .rdw-editor-wrapper{background:${T.elevated};border-radius:4px;border:1px solid ${T.border}}
                .wd .rdw-editor-toolbar{background:${T.surface};border:none;border-bottom:1px solid ${T.border};padding:5px 6px}
                .wd .rdw-option-wrapper{background:${T.elevated};border:1px solid ${T.border};border-radius:2px;min-width:22px;height:22px}
                .wd .rdw-option-wrapper:hover{background:${T.bg};border-color:${T.accent}}
                .wd .rdw-option-active{background:${T.accent}22;border-color:${T.accent}}
                .wd .rdw-option-wrapper img{filter:invert(0.7)}
                .wd .rdw-dropdown-wrapper{background:${T.elevated};border:1px solid ${T.border};border-radius:2px}
                .wd .rdw-dropdown-wrapper:hover{background:${T.bg}}
                .wd .rdw-dropdown-selectedtext{color:${T.text};font-family:${FONT};font-size:11px}
                .wd .rdw-dropdownoption-default{background:${T.surface};color:${T.text};font-family:${FONT};font-size:11px}
                .wd .rdw-dropdownoption-default:hover{background:${T.elevated}}
                .wd .rdw-dropdownoption-active{background:${T.accent}22}
                .wd .rdw-editor-main{color:${T.text};font-family:${FONT};font-size:13px;min-height:200px;max-height:320px;overflow-y:auto;padding:10px 12px}
                .wd .DraftEditor-root{color:${T.text}}
                .wd .public-DraftEditorPlaceholder-root{color:${T.muted}}
                .wd .rdw-colorpicker-modal,.wd .rdw-link-modal{background:${T.surface};border:1px solid ${T.border};color:${T.text}}
                .wd .rdw-link-modal-label{color:${T.muted}}
                .wd .rdw-link-modal-input{background:${T.elevated};border:1px solid ${T.border};color:${T.text};border-radius:3px;padding:4px 8px;font-family:${FONT}}
                .wd .rdw-link-modal-btn{background:${T.accent};color:#fff;border:none;border-radius:3px;padding:4px 12px;cursor:pointer;font-family:${FONT}}
                .wd .rdw-dropdown-carettoopen,.wd .rdw-dropdown-carettoclose{border-top-color:${T.muted};border-bottom-color:${T.muted}}
              `}</style>
              <div className="wd">
                <Editor
                  editorState={editorState} onEditorStateChange={setEditorState}
                  wrapperStyle={{ margin: 0 }} toolbarStyle={{ margin: 0 }} editorStyle={{ lineHeight: 1.6 }}
                  placeholder="Dear {{name}}, Greetings from CCD, IIT Guwahati…"
                  toolbar={{
                    options: ["inline", "blockType", "fontSize", "list", "textAlign", "colorPicker", "link", "history"],
                    inline: { options: ["bold", "italic", "underline", "strikethrough"] },
                    blockType: { options: ["Normal", "H1", "H2", "H3", "Blockquote"] },
                    fontSize: { options: [10, 11, 12, 13, 14, 16, 18, 24, 36] },
                    list: { options: ["ordered", "unordered"] },
                    textAlign: { options: ["left", "center", "right"] },
                    link: { defaultTargetOption: "_blank" },
                    history: { options: ["undo", "redo"] },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview / Status */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
            {["preview", "status"].map((t) => (
              <button key={t} onClick={() => setRightTab(t)}
                style={{ flex: 1, padding: "9px 0", border: "none", background: "transparent", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderBottom: `2px solid ${rightTab === t ? T.accent : "transparent"}`, color: rightTab === t ? T.text : T.muted }}>
                {t === "preview" ? "Preview" : "Status"}
              </button>
            ))}
          </div>

          {rightTab === "preview" && (
            <div style={{ padding: 10 }}>
              {recipients.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <Label>For</Label>
                  <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))} style={{ ...inp, cursor: "pointer" }}>
                    {recipients.map((r, i) => <option key={i} value={i}>{r.email || r.Email || `Row ${i + 1}`}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 6, fontSize: 11, color: T.muted }}>
                Subject: <span style={{ color: T.text }}>{sub(subject, previewRow) || "—"}</span>
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden", height: 280 }}>
                {body
                  ? <iframe srcDoc={`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:12px;margin:0;font-size:13px">${sub(body, previewRow)}</body></html>`}
                      style={{ width: "100%", height: "100%", border: "none", background: "white" }} title="preview" />
                  : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.border, fontSize: 12 }}>Write body to preview</div>
                }
              </div>
            </div>
          )}

          {rightTab === "status" && (
            <div style={{ padding: 10 }}>
              {jobStatus && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: jobStatus === "done" ? T.success : T.accent, fontWeight: 600 }}>{jobStatus === "done" ? "Complete" : jobStatus === "stopped" ? "Stopped" : "Sending…"}</span>
                    <span style={{ color: T.muted }}>{sentCount + failCount}/{total}</span>
                  </div>
                  <div style={{ background: T.elevated, borderRadius: 3, height: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: jobStatus === "done" ? T.success : T.accent, width: `${progress}%`, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {[[sentCount, "Sent", T.success], [failCount, "Failed", T.danger], [pendCount, "Pending", T.muted]].map(([n, l, c]) => (
                      <div key={l} style={{ flex: 1, textAlign: "center", padding: "5px 2px", background: T.elevated, borderRadius: 3 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{n}</div>
                        <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ maxHeight: 240, overflowY: "auto", fontSize: 11 }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ padding: "4px 6px", marginBottom: 1, borderRadius: 3, display: "flex", gap: 6, alignItems: "flex-start", background: r._status === "failed" ? "#1a0a0a" : "transparent" }}>
                    <span style={{ flexShrink: 0, color: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.border }}>
                      {r._status === "sent" ? "+" : r._status === "failed" ? "×" : r._status === "skipped" ? "–" : "·"}
                    </span>
                    <div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.muted, maxWidth: 200 }}>{r.email || r.Email || `Row ${i + 1}`}</div>
                      {r._error && <div style={{ color: T.danger, fontSize: 10 }}>{r._error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send bar */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {!sending && jobStatus !== "done" && (
          <button disabled={!total || !subject || !body || !fromEmail || !fromPwd} onClick={startSend}
            style={{ padding: "8px 20px", background: T.accent, color: "#fff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: (!total || !subject || !body || !fromEmail || !fromPwd) ? "not-allowed" : "pointer", opacity: (!total || !subject || !body || !fromEmail || !fromPwd) ? 0.4 : 1, fontFamily: FONT }}>
            Send to {pendCount || total} recipient{(pendCount || total) !== 1 ? "s" : ""}
          </button>
        )}
        {sending && (
          <>
            <Btn danger onClick={stopSend}>Stop</Btn>
            <span style={{ fontSize: 12, color: T.muted }}>Sending {sentCount + failCount}/{total}…</span>
          </>
        )}
        {jobStatus === "done" && (
          <>
            <Btn onClick={() => { setJobId(null); setJobStatus(null); setSummary(null); setRecipients((rs) => rs.map((r) => ({ ...r, _status: "pending", _error: null }))); }}>Send Again</Btn>
            {summary && <span style={{ fontSize: 12, color: T.muted }}>{summary.sent} sent · {summary.failed} failed</span>}
          </>
        )}
      </div>

      {/* Drafts section */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
            Saved Drafts {drafts.length > 0 && <span style={{ color: T.muted, fontWeight: 400 }}>({drafts.length})</span>}
          </div>
          {drafts.length > 1 && (
            <input type="text" placeholder="Search…" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)}
              style={{ ...inp, width: 200 }} />
          )}
        </div>

        {drafts.length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "36px 20px", textAlign: "center", color: T.muted, fontSize: 12 }}>
            No drafts saved. Write a template and click "Save Draft" to store it here.
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 12, padding: "24px 0", textAlign: "center" }}>No drafts match "{draftSearch}"</div>
        ) : (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
            {filteredDrafts.map((draft, idx) => (
              <div key={draft.id}
                style={{ padding: "12px 14px", borderBottom: idx < filteredDrafts.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

                {/* Name / rename */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  {editingId === draft.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input autoFocus value={renameName} onChange={(e) => setRenameName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameDraft(draft.id); if (e.key === "Escape") setEditingId(null); }}
                        style={{ ...inp, flex: 1, height: 30, fontSize: 12 }} />
                      <Btn small onClick={() => renameDraft(draft.id)}>OK</Btn>
                      <Btn small ghost onClick={() => setEditingId(null)}>×</Btn>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{draft.name}</span>
                      {draft.subject && <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>— {draft.subject.slice(0, 50)}{draft.subject.length > 50 ? "…" : ""}</span>}
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{fmtDate(draft.savedAt)}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <Btn small onClick={() => loadDraft(draft)}>Load</Btn>
                  <Btn small onClick={() => updateDraft(draft.id)} title="Overwrite with current editor">Update</Btn>
                  <Btn small ghost onClick={() => { setEditingId(draft.id); setRenameName(draft.name); }}>Rename</Btn>
                  <Btn small ghost onClick={() => duplicateDraft(draft)}>Duplicate</Btn>
                  <Btn small danger onClick={() => { if (window.confirm(`Delete "${draft.name}"?`)) deleteDraft(draft.id); }}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
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

  if (!authed) return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: T.surface, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: 13 } }} />
      <PasswordGate onAuth={() => setAuthed(true)} />
    </>
  );

  const TABS = [
    { id: "upload", label: "Upload & Tools" },
    { id: "excel",  label: "Excel Creator" },
    { id: "files",  label: "All Files" },
    { id: "mail",   label: "Mail Sender" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
      <Toaster position="top-right" toastOptions={{ style: { background: T.surface, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT, fontSize: 13 } }} />

      {/* Header */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Share for Care</span>
          <span style={{ marginLeft: 12, fontSize: 11, color: T.muted }}>CCD — IIT Guwahati</span>
        </div>
        <Btn ghost small onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false); }}>Logout</Btn>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT, color: tab === t.id ? T.text : T.muted, borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {tab === "upload" && <UploadToolsTab />}
        {tab === "excel"  && <ExcelCreatorTab />}
        {tab === "files"  && <FilesTab />}
        {tab === "mail"   && <MailTab />}
      </div>
    </div>
  );
}
