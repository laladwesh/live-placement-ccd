import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Toaster, toast } from "react-hot-toast";
import { EditorState, convertToRaw, convertFromRaw, ContentState, AtomicBlockUtils, Modifier } from "draft-js";
import { Editor } from "react-draft-wysiwyg";
import draftToHtml from "draftjs-to-html";
import htmlToDraft from "html-to-draftjs";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

/* ─── Robust High-Contrast Theme ────────────────────────────────────────── */
const T = {
  bg:       "#090a0d",
  surface:  "#111318",
  elevated: "#181b22",
  sunken:   "#0d0e12",
  border:   "#272b35",
  borderHi: "#3d4452",
  text:     "#f4f5f7",
  textSec:  "#9da4b2",
  muted:    "#656e7d",
  primary:  "#ffffff",
  onPrimary:"#000000",
  accent:   "#3b82f6",
  success:  "#10b981",
  successBg:"#064e3b33",
  danger:   "#ef4444",
  dangerBg: "#450a0a44",
  warn:     "#f59e0b",
  warnBg:   "#451a0344",
};

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

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
  if (diff <= 0) return "EXPIRED";
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m}m left` : "<1m left";
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* ─── Typography & Font Loader ───────────────────────────────────────────── */
function useDesignFont() {
  useEffect(() => {
    if (document.getElementById("pjs-font")) return;
    const l = document.createElement("link");
    l.id = "pjs-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ─── Base Input & Button Components ─────────────────────────────────────── */
const inpStyle = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  background: T.sunken,
  color: T.text,
  border: `1.5px solid ${T.border}`,
  borderRadius: 5,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

function Btn({ children, onClick, disabled, variant = "default", size = "md", style = {}, title }) {
  let bg = T.elevated;
  let color = T.text;
  let border = `1.5px solid ${T.border}`;

  if (variant === "primary") {
    bg = T.primary;
    color = T.onPrimary;
    border = `1.5px solid ${T.primary}`;
  } else if (variant === "danger") {
    bg = T.dangerBg;
    color = "#fca5a5";
    border = `1.5px solid ${T.danger}66`;
  } else if (variant === "ghost") {
    bg = "transparent";
    color = T.textSec;
    border = `1.5px solid ${T.border}`;
  }

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: size === "sm" ? "5px 12px" : size === "lg" ? "11px 22px" : "8px 16px",
    fontSize: size === "sm" ? 12 : size === "lg" ? 14 : 13,
    fontWeight: 700,
    fontFamily: FONT,
    border,
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    background: bg,
    color: disabled ? T.muted : color,
    opacity: disabled ? 0.45 : 1,
    letterSpacing: "-0.01em",
    userSelect: "none",
    ...style,
  };
  return <button title={title} onClick={disabled ? undefined : onClick} style={base}>{children}</button>;
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, borderBottom: `2px solid ${T.border}`, paddingBottom: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 500, color: T.textSec }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: "0.02em" }}>
      {children} {required && <span style={{ color: T.danger }}>*</span>}
    </label>
  );
}

/* ─── Password Gate ──────────────────────────────────────────────────────── */
function PasswordGate({ onAuth }) {
  useDesignFont();
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
        toast.error("Invalid credentials");
      }
    } catch {
      toast.error("Server communication failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: FONT, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, padding: 36, background: T.surface, border: `2px solid ${T.border}`, borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "inline-block", background: T.elevated, border: `1px solid ${T.borderHi}`, padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 16, letterSpacing: "0.05em" }}>
          IIT GUWAHATI • CCD
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Share for Care</h1>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.textSec, margin: "0 0 24px" }}>Internal career development and document operations</p>
        
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel required>Portal Password</FieldLabel>
            <input
              type="password"
              placeholder="Enter authorization key"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              autoFocus
              style={{ ...inpStyle, fontSize: 14, padding: "11px 14px" }}
            />
          </div>
          <Btn variant="primary" size="lg" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
            {loading ? "Authenticating…" : "Unlock System"}
          </Btn>
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
    const fd = new FormData();
    fd.append("file", file);
    fd.append("isPermanent", String(permanent));
    const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
    if (r.ok) toast.success(`Uploaded successfully ${permanent ? "[Permanent]" : "[Temporary 15m]"}`);
    else toast.error("Upload failed");
  };

  const tool = async (endpoint, fd, msg) => {
    const r = await sFetch(`${API}/share/${endpoint}`, { method: "POST", body: fd });
    if (r.ok) {
      const d = await r.json();
      toast.success(msg(d));
    } else {
      const e = await r.json().catch(() => ({}));
      toast.error(e.message || "Operation failed");
    }
  };

  const tools = [
    {
      title: "Temporary Upload",
      badge: "AUTO-DELETE 15 MIN",
      desc: "Fast drop for one-off student sharing. Automatically purged from storage.",
      accept: "*",
      multiple: false,
      onSelect: (e) => { const f = e.target.files[0]; if (f) run(() => upload(f, false)); e.target.value = ""; }
    },
    {
      title: "Permanent Upload",
      badge: "PERSISTENT",
      desc: "Archived files, forms, templates, or notices that remain until explicitly deleted.",
      accept: "*",
      multiple: false,
      onSelect: (e) => { const f = e.target.files[0]; if (f) run(() => upload(f, true)); e.target.value = ""; }
    },
    {
      title: "Compress Image",
      badge: "JPG / PNG / WEBP",
      desc: "Minimizes student photo or banner payloads without perceptible quality loss.",
      accept: "image/*",
      multiple: false,
      onSelect: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const fd = new FormData();
        fd.append("image", f);
        fd.append("quality", "80");
        run(() => tool("tools/compress-image", fd, (d) => `Saved ${d.reduction} storage size`));
        e.target.value = "";
      }
    },
    {
      title: "Merge PDF Documents",
      badge: "MULTI-FILE",
      desc: "Combine 2 or more PDF scorecards, grade sheets, or registration documents into 1 file.",
      accept: "application/pdf",
      multiple: true,
      onSelect: (e) => {
        const fs = Array.from(e.target.files);
        if (fs.length < 2) { toast.error("Please pick at least 2 PDF files"); return; }
        const fd = new FormData();
        fs.forEach((f) => fd.append("pdfs", f));
        run(() => tool("tools/merge-pdfs", fd, (d) => `Merged ${d.pageCount} pages total`));
        e.target.value = "";
      }
    },
    {
      title: "Bundle to ZIP Archive",
      badge: "ARCHIVER",
      desc: "Compress multiple arbitrary student attachments into a clean downloadable ZIP package.",
      accept: "*",
      multiple: true,
      onSelect: (e) => {
        const fs = Array.from(e.target.files);
        if (!fs.length) return;
        const fd = new FormData();
        fs.forEach((f) => fd.append("files", f));
        run(() => tool("tools/compress-files", fd, (d) => `Archive built with ${d.fileCount} items`));
        e.target.value = "";
      }
    },
    {
      title: "CV Bulk Downloader",
      badge: "EXCEL PIPELINE",
      desc: "Parse resume drive links from an official placement sheet and pack CVs into a single ZIP.",
      accept: ".xlsx,.xls,.csv",
      multiple: false,
      onSelect: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const fd = new FormData();
        fd.append("excel", f);
        run(() => tool("tools/cv-downloader", fd, (d) => `${d.success} CVs extracted successfully`));
        e.target.value = "";
      }
    },
    {
      title: "Spreadsheet Format Converter",
      badge: "CSV ⇄ XLSX",
      desc: "Instantly transcode candidate spreadsheets between raw CSV format and structured Excel books.",
      accept: ".csv,.xlsx,.xls",
      multiple: false,
      onSelect: (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const fd = new FormData();
        fd.append("file", f);
        run(() => tool("tools/convert-spreadsheet", fd, () => "Spreadsheet transformed successfully"));
        e.target.value = "";
      }
    }
  ];

  return (
    <div>
      <SectionHeader
        title="Operations & File Tools"
        subtitle="Batch transformation pipelines and manual file distribution for CCD operations"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {tools.map((t) => (
          <div key={t.title} style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 6, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>{t.title}</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, background: T.elevated, border: `1px solid ${T.borderHi}`, color: T.textSec, padding: "2px 6px", borderRadius: 3 }}>{t.badge}</span>
              </div>
              <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 16px", lineHeight: 1.45, fontWeight: 500 }}>{t.desc}</p>
            </div>
            <div>
              <label style={{ display: "block" }}>
                <input
                  type="file"
                  accept={t.accept}
                  multiple={t.multiple}
                  disabled={busy}
                  onChange={t.onSelect}
                  style={{ display: "none" }}
                />
                <div style={{
                  padding: "9px 14px",
                  background: T.sunken,
                  border: `1.5px dashed ${T.borderHi}`,
                  borderRadius: 5,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.text,
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "background 0.1s ease",
                }}>
                  Select File{t.multiple ? "s" : ""}
                </div>
              </label>
            </div>
          </div>
        ))}

        {/* Dedicated DB Export Card */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 6, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>Export Placements DB</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, background: T.elevated, border: `1px solid ${T.borderHi}`, color: T.textSec, padding: "2px 6px", borderRadius: 3 }}>RECORDS</span>
            </div>
            <p style={{ fontSize: 13, color: T.textSec, margin: "0 0 16px", lineHeight: 1.45, fontWeight: 500 }}>
              Query the current recruitment database and dump complete placement tallies directly to an Excel sheet.
            </p>
          </div>
          <Btn
            variant="default"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sFetch(`${API}/share/tools/export-placements`);
                if (r.ok) {
                  const d = await r.json();
                  toast.success(`Export ready: ${d.count} candidates parsed`);
                } else {
                  toast.error("Database query failed");
                }
              } finally {
                setBusy(false);
              }
            }}
            style={{ width: "100%", padding: "10px 0" }}
          >
            {busy ? "Generating…" : "Execute DB Export"}
          </Btn>
        </div>
      </div>

      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: T.surface, border: `2px solid ${T.borderHi}`, padding: "24px 36px", borderRadius: 8, fontSize: 15, fontWeight: 800, color: T.text, fontFamily: FONT, letterSpacing: "-0.01em" }}>
            PROCESSING PIPELINE…
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Excel Creator Tab ──────────────────────────────────────────────────── */
function ExcelCreatorTab() {
  const [data, setData] = useState([["", "", "", ""], ["", "", "", ""], ["", "", "", ""]]);
  const [busy, setBusy] = useState(false);

  const setCell = (r, c, v) => {
    const d = data.map((row) => [...row]);
    d[r][c] = v;
    setData(d);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split("\n").map((r) => r.split("\t"));
      const maxC = Math.max(...rows.map((r) => r.length));
      setData(rows.map((r) => {
        const row = [...r];
        while (row.length < maxC) row.push("");
        return row;
      }));
      toast.success("Grid updated from clipboard");
    } catch {
      toast.error("Clipboard access refused");
    }
  };

  const download = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "table_export.xlsx");
    toast.success("Spreadsheet written to disk");
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
      fd.append("file", blob, "created_table.xlsx");
      fd.append("isPermanent", "false");
      const r = await sFetch(`${API}/share/upload`, { method: "POST", body: fd });
      if (r.ok) toast.success("Pushed to server (15m temp)");
      else toast.error("Upload failure");
    } catch {
      toast.error("Process aborted");
    }
    setBusy(false);
  };

  return (
    <div>
      <SectionHeader
        title="Spreadsheet Scratchpad"
        subtitle="Construct or paste quick tabular data arrays and transcode immediately to XLSX format"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn size="sm" onClick={() => setData([...data, Array(data[0]?.length || 4).fill("")])}>+ Row</Btn>
            <Btn size="sm" onClick={() => setData(data.map((r) => [...r, ""]))}>+ Column</Btn>
            <Btn size="sm" onClick={paste}>Paste Clipboard</Btn>
            <Btn size="sm" onClick={uploadToFiles} disabled={busy}>Upload to Files</Btn>
            <Btn size="sm" variant="primary" onClick={download}>Download XLSX</Btn>
            <Btn size="sm" variant="danger" onClick={() => setData([["","","",""],["","","",""],["","","",""]])}>Reset</Btn>
          </div>
        }
      />

      <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
            <thead>
              <tr style={{ background: T.sunken, borderBottom: `2px solid ${T.border}` }}>
                <th style={{ width: 44, padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: T.muted, fontFamily: MONO, borderRight: `1.5px solid ${T.border}` }}>#</th>
                {data[0]?.map((_, ci) => (
                  <th key={ci} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: MONO, borderRight: `1px solid ${T.border}` }}>
                    COL {String.fromCharCode(65 + ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: T.muted, background: T.sunken, borderRight: `1.5px solid ${T.border}`, fontFamily: MONO, userSelect: "none" }}>
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: 0, borderRight: `1px solid ${T.border}` }}>
                      <input
                        value={cell}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        style={{
                          width: "100%",
                          minWidth: 120,
                          padding: "8px 10px",
                          border: "none",
                          fontSize: 13,
                          fontWeight: 500,
                          fontFamily: FONT,
                          outline: "none",
                          background: "transparent",
                          color: T.text,
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.target.style.background = T.elevated)}
                        onBlur={(e) => (e.target.style.background = "transparent")}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        fetch_();
      }
    } catch {
      toast.error("Download error");
    }
    setBusy(false);
  };

  const del = async (id) => {
    if (!window.confirm("Permanently wipe this file from storage?")) return;
    const r = await sFetch(`${API}/share/files/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("File deleted");
      fetch_();
    } else {
      toast.error("Failed to delete");
    }
  };

  return (
    <div>
      <SectionHeader
        title="File Registry"
        subtitle="Manage public distribution links, expiration monitors, and storage allocation"
        action={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search filename…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inpStyle, width: 220 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ ...inpStyle, width: 140, cursor: "pointer" }}
            >
              <option value="all">All Storage</option>
              <option value="permanent">Permanent Only</option>
              <option value="temporary">Temporary (15m)</option>
            </select>
            <Btn onClick={fetch_} size="md">Sync</Btn>
          </div>
        }
      />

      <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
        {!files.length ? (
          <div style={{ padding: "64px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.textSec }}>No storage artifacts found</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.muted }}>Upload a file or run a conversion tool to generate download handles</p>
          </div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ background: T.sunken, borderBottom: `2px solid ${T.border}`, textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: T.textSec }}>DOCUMENT / PAYLOAD</th>
                <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: T.textSec, width: 110 }}>SIZE</th>
                <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: T.textSec, width: 130 }}>LIFECYCLE</th>
                <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: T.textSec, width: 90 }}>D/L</th>
                <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 800, color: T.textSec, textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, idx) => (
                <tr key={f._id} style={{ borderBottom: idx < files.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, wordBreak: "break-all" }}>{f.originalName}</div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: T.muted, marginTop: 3 }}>ID: {f._id}</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, fontFamily: MONO, fontWeight: 600, color: T.textSec }}>
                    {fmtSize(f.fileSize)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {f.isPermanent ? (
                      <span style={{ fontSize: 11, fontWeight: 800, color: T.success, background: T.successBg, border: `1px solid ${T.success}44`, padding: "3px 8px", borderRadius: 4 }}>
                        PERMANENT
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 800, color: T.warn, background: T.warnBg, border: `1px solid ${T.warn}44`, padding: "3px 8px", borderRadius: 4 }}>
                        {fmtExpiry(f.expiresAt)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: MONO, fontWeight: 700, color: T.text }}>
                    {f.downloadCount}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Btn
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/dday/api/share/file/${f.shareUrl}`;
                          navigator.clipboard.writeText(url).then(
                            () => toast.success("URL copied"),
                            () => toast.error("Copy failed")
                          );
                        }}
                      >
                        Copy URL
                      </Btn>
                      <Btn size="sm" onClick={() => download(f.shareUrl, f.originalName)} disabled={busy}>
                        Download
                      </Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(f._id)}>
                        Wipe
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Standard placement email templates (always available, never deleted) ── */
const STANDARD_DRAFTS = [
  {
    id: "std-placement-invite-2027",
    name: "Placement Invitation 2026–27",
    subject: "IIT Guwahati <> {{company_name}} – Invitation for Placements 2026–27",
    body: `<p>Dear {{contact_name}},</p>
<p><em><strong>Greetings from the Centre for Career Development, IIT Guwahati.</strong></em></p>
<p>We are pleased to invite <strong>{{company_name}}</strong> to participate in the <strong>On-Campus Placement Season 2026–27</strong> at IIT Guwahati for the graduating Batch of 2027. Recognized as one of India's premier institutions for engineering, research, and innovation, IIT Guwahati is ranked <strong>8th in Engineering in the NIRF 2025 Rankings</strong> and <strong>#115 in the QS Asia University Rankings 2026</strong>. The Institute also has a strong global research footprint, ranking <strong>42nd globally in Citations per Faculty (QS World University Rankings 2025)</strong>.</p>
<p>These rankings reflect the strong academic, research, and technical capabilities of our students. Our graduating cohort across <strong>EEE, ECE, and CSE</strong> offers {{company_name}} access to a highly skilled talent pool with expertise in <strong>power electronics, power systems, control and automation, electric mobility, embedded systems, electronics, AI/ML, and software development</strong>. This enables recruitment across <strong>R&amp;D, product development, power and energy solutions, industrial automation, EV technologies, embedded systems, and other engineering roles</strong> from a single campus.</p>
<p><em><strong>Placement Timeline</strong></em></p>
<p><strong>Phase 1</strong></p>
<ul>
<li>Online Assessments &amp; Pre-Placement Talks: September 25 – October 30, 2026</li>
<li>Interviews: December onwards</li>
</ul>
<p><strong>Phase 2</strong></p>
<ul>
<li>Online Assessments &amp; Pre-Placement Talks: January 15, 2027 onwards</li>
<li>Interviews: January 15 – April 2027</li>
</ul>
<p><em>Joining:</em> From June 2027 onwards</p>
<p>To register and participate, please submit the <strong>Job Application Form (JAF)</strong> via our <a href="https://iitg.ac.in/placements/auth/login/recruiter" target="_blank">Placement Portal</a>.</p>
<p><em><strong>About IIT Guwahati</strong></em></p>
<p>Every year, leading organizations across diverse industries engage with IIT Guwahati to recruit some of the finest young minds in the country. The Institute's students consistently demonstrate their capabilities through national and international competitions, technical challenges, research initiatives, and industry-oriented projects.</p>
<p><em><strong>Recent achievements of our students include:</strong></em></p>
<ul>
<li>Rank 16 at the ICPC Asia West Finals</li>
<li>Global Ranks 1, 6, 8, and 10 at the Creative Shock international case competition</li>
<li>3rd position overall at Inter IIT Tech Meet 13.0</li>
<li>11th Rank at IICPC Quantfest Finals</li>
<li>Special Innovation Prize at Smart India Hackathon 2025</li>
<li>1st Runner-Up finishes at the LAM Research Challenge and V-Guard Big Idea Tech Design Competition</li>
<li>2nd Runner-Up finishes at Convolve and SARCathon, IIT Bombay</li>
</ul>
<p>We are confident our students will bring exceptional value to your organization.</p>
<p><strong>Faculty Coordinators:</strong></p>
<ul>
<li><strong>Dr. Rishikesh D. Kulkarni</strong> (+91 7636892279)</li>
<li><strong>Dr. Rajkumar P. Thummer</strong> (+91 70868 67025)</li>
</ul>
<p>We look forward to welcoming <strong>{{company_name}}</strong> to our campus and building a successful partnership.</p>
<p>Warm regards,</p>
<p><em><strong>Chandrashekhar Rao</strong></em><br><em>Lead Student Placement Coordinator – Industry Liaison</em><br><em>Centre for Career Development</em><br><em>Indian Institute of Technology Guwahati</em><br><em>Contact: +91 7222940112</em></p>`,
    savedAt: "2026-09-17T00:00:00.000Z",
    isStandard: true,
  },
];

/* ─── Mail Tab ───────────────────────────────────────────────────────────── */
function MailTab() {
  /* SMTP State */
  const [fromEmail, setFromEmail] = useState("");
  const [fromPwd, setFromPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [fromName, setFromName] = useState("Centre for Career Development");
  const [defaultCc, setDefaultCc] = useState("");
  const [delayMs, setDelayMs] = useState(600);
  const [advOpen, setAdvOpen] = useState(false);

  /* Test Email */
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);

  /* Compose Data */
  const [recipients, setRecipients] = useState([]);
  const [columns, setColumns] = useState([]);
  const [subject, setSubject] = useState("");
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const [previewIdx, setPreviewIdx] = useState(0);
  const [rightTab, setRightTab] = useState("preview");

  /* Dispatch Execution */
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const esSrc = useRef(null);

  /* Saved Drafts */
  const [drafts, setDrafts] = useState(() => loadMailDrafts());
  const [draftSearch, setDraftSearch] = useState("");
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [renameName, setRenameName] = useState("");

  const customEntityTransform = (entity) => {
    if (entity.type === "HR") return '<hr style="border:none;border-top:1.5px solid #cccccc;margin:16px 0;">';
  };

  const getBody = () => {
    const raw = convertToRaw(editorState.getCurrentContent());
    const hasContent = raw.blocks.some((b) => b.text.trim()) || raw.blocks.some((b) => b.type === "atomic");
    return hasContent ? draftToHtml(raw, {}, false, customEntityTransform) : "";
  };

  const handlePastedText = (text, html) => {
    if (html) {
      const { contentBlocks, entityMap } = htmlToDraft(html);
      if (contentBlocks && contentBlocks.length) {
        const pasted = ContentState.createFromBlockArray(contentBlocks, entityMap);
        const newContent = Modifier.replaceWithFragment(
          editorState.getCurrentContent(),
          editorState.getSelection(),
          pasted.getBlockMap()
        );
        setEditorState(EditorState.push(editorState, newContent, "insert-fragment"));
        return true;
      }
    }
    return false;
  };

  const insertHr = () => {
    const cs = editorState.getCurrentContent().createEntity("HR", "IMMUTABLE", {});
    const key = cs.getLastCreatedEntityKey();
    const withEntity = EditorState.set(editorState, { currentContent: cs });
    setEditorState(AtomicBlockUtils.insertAtomicBlock(withEntity, key, " "));
  };

  const blockRendererFn = (block) => {
    if (block.getType() === "atomic") {
      const cs = editorState.getCurrentContent();
      const key = block.getEntityAt(0);
      if (key && cs.getEntity(key).getType() === "HR") {
        return {
          component: () => <hr style={{ border: "none", borderTop: `2px solid ${T.borderHi}`, margin: "10px 0" }} />,
          editable: false,
        };
      }
    }
    return null;
  };

  const HrButton = () => (
    <div
      onClick={insertHr}
      title="Insert horizontal line"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 26, cursor: "pointer", fontSize: 14, fontWeight: 800, color: T.text, border: `1.5px solid ${T.border}`, borderRadius: 4, background: T.sunken }}
    >
      —
    </div>
  );

  const sub = (tmpl, row) => tmpl.replace(/\{\{([\w.]+)\}\}/g, (_, k) => String(row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? ""));

  /* Draft CRUD */
  const saveDraft = () => {
    if (!draftName.trim()) { toast.error("Provide a template identifier"); return; }
    const bodyContent = getBody();
    if (!subject && !bodyContent) { toast.error("Cannot save empty message draft"); return; }
    const entry = {
      id: Date.now().toString(),
      name: draftName.trim(),
      subject,
      body: bodyContent,
      rawContent: convertToRaw(editorState.getCurrentContent()),
      savedAt: new Date().toISOString()
    };
    const next = [entry, ...drafts];
    setDrafts(next);
    persistDrafts(next);
    setDraftName("");
    setShowSavePanel(false);
    toast.success(`Draft preserved: "${entry.name}"`);
  };

  const loadDraft = (draft) => {
    setSubject(draft.subject || "");
    if (draft.rawContent) {
      try {
        setEditorState(EditorState.createWithContent(convertFromRaw(draft.rawContent)));
      } catch {
        setEditorState(EditorState.createEmpty());
      }
    }
    toast.success(`Restored template: "${draft.name}"`);
  };

  const deleteDraft = (id) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    persistDrafts(next);
    toast.success("Draft eliminated");
  };

  const duplicateDraft = (draft) => {
    const entry = { ...draft, id: Date.now().toString(), name: `${draft.name} (Copy)`, savedAt: new Date().toISOString() };
    const next = [entry, ...drafts];
    setDrafts(next);
    persistDrafts(next);
    toast.success("Template cloned");
  };

  const renameDraft = (id) => {
    if (!renameName.trim()) return;
    const next = drafts.map((d) => d.id === id ? { ...d, name: renameName.trim() } : d);
    setDrafts(next);
    persistDrafts(next);
    setEditingId(null);
    toast.success("Template renamed");
  };

  const updateDraft = (id) => {
    const raw = convertToRaw(editorState.getCurrentContent());
    const next = drafts.map((d) => d.id === id ? { ...d, subject, body: getBody(), rawContent: raw, savedAt: new Date().toISOString() } : d);
    setDrafts(next);
    persistDrafts(next);
    toast.success("Draft updated from current editor");
  };

  const sendTest = async () => {
    if (!fromEmail || !fromPwd) { toast.error("Set authenticated credentials above"); return; }
    if (!testTo.trim()) { toast.error("Recipient address missing"); return; }
    setTestBusy(true);
    try {
      const r = await sFetch(`${API}/mail/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpEmail: fromEmail,
          smtpPassword: fromPwd,
          fromName,
          toEmail: testTo.trim(),
          subject: subject || "[TEST] CCD Announcement Sample",
          htmlBody: getBody() || "<p>Test pipeline verification message from IIT Guwahati CCD.</p>"
        }),
      });
      if (r.ok) toast.success(`Test email routed to ${testTo}`);
      else {
        const d = await r.json();
        toast.error(d.message || "Dispatch failed");
      }
    } catch {
      toast.error("Network interface error");
    }
    setTestBusy(false);
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        if (rows.length) {
          setColumns(Object.keys(rows[0]));
          setRecipients(rows.map((r) => ({ ...r, _status: "pending", _error: null })));
          toast.success(`${rows.length} records parsed into batch`);
        } else {
          toast.error("Spreadsheet holds 0 rows");
        }
      } catch {
        toast.error("Failed to parse spreadsheet");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const startSend = async () => {
    const currentBody = getBody();
    if (!fromEmail || !fromPwd) { toast.error("SMTP sender authentication is required"); return; }
    if (!subject || !currentBody) { toast.error("Both subject and body are mandatory"); return; }
    const pending = recipients.filter((r) => r._status === "pending" || r._status === "failed");
    if (!pending.length) { toast.error("Zero targets ready for dispatch"); return; }
    
    setSending(true);
    setSummary(null);
    setRecipients((rs) => rs.map((r) => r._status === "failed" ? { ...r, _status: "pending", _error: null } : r));

    try {
      const r = await sFetch(`${API}/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpEmail: fromEmail,
          smtpPassword: fromPwd,
          fromName,
          defaultCc,
          delayMs,
          subject,
          htmlBody: currentBody,
          recipients: pending
        }),
      });

      if (!r.ok) {
        const d = await r.json();
        toast.error(d.message || "Pipeline start rejected");
        setSending(false);
        return;
      }

      const { jobId: jid } = await r.json();
      setJobId(jid);
      setRightTab("status");

      const es = new EventSource(`${API}/mail/progress/${jid}?token=${encodeURIComponent(getToken())}`);
      esSrc.current = es;

      es.onmessage = (ev) => {
        const d = JSON.parse(ev.data);
        if (d.type === "snapshot") {
          setJobStatus(d.jobStatus);
          setSummary(d.summary);
          setRecipients((rs) => rs.map((r, i) => d.rows[i] ? { ...r, _status: d.rows[i]._status, _error: d.rows[i]._error } : r));
        } else if (d.type === "update") {
          setRecipients((rs) => rs.map((r, i) => i === d.index ? { ...r, _status: d.status, _error: d.error || null } : r));
        } else if (d.type === "done") {
          setSummary(d);
          setJobStatus("done");
          setSending(false);
          es.close();
          toast.success(`Complete: ${d.sent} transmitted, ${d.failed} dropped`);
        } else if (d.type === "stopped") {
          setSummary(d);
          setJobStatus("stopped");
          setSending(false);
          es.close();
          toast("Pipeline halted manually");
        } else if (d.type === "error") {
          toast.error(d.message);
          setJobStatus("error");
          setSending(false);
          es.close();
        }
      };
      es.onerror = () => { es.close(); setSending(false); };
    } catch {
      toast.error("Network disconnect occurred");
      setSending(false);
    }
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
  const currentBody = getBody();
  const filteredDrafts = draftSearch
    ? drafts.filter((d) => d.name.toLowerCase().includes(draftSearch.toLowerCase()) || (d.subject || "").toLowerCase().includes(draftSearch.toLowerCase()))
    : drafts;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader
        title="High-Volume Mail Dispatcher"
        subtitle="Industrial SMTP delivery pipeline with dynamic variable templating and delivery monitors"
      />

      {/* SMTP Configuration Bar */}
      <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: fromEmail && fromPwd ? T.success : T.danger }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: fromEmail && fromPwd ? T.success : T.danger, fontFamily: MONO }}>
              {fromEmail && fromPwd ? "SMTP READY" : "UNCONFIGURED"}
            </span>
          </div>

          <div style={{ flex: "1 1 240px" }}>
            <FieldLabel required>Sender Email Account</FieldLabel>
            <input
              type="email"
              placeholder="e.g. placement@iitg.ac.in"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              style={inpStyle}
            />
          </div>

          <div style={{ flex: "1 1 220px" }}>
            <FieldLabel required>Google App Password / SMTP Token</FieldLabel>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="16-character app token"
                value={fromPwd}
                onChange={(e) => setFromPwd(e.target.value)}
                style={{ ...inpStyle, fontFamily: MONO, paddingRight: 60 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((p) => !p)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, color: T.textSec }}
              >
                {showPwd ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <Btn onClick={() => setAdvOpen((o) => !o)}>
            {advOpen ? "Close Advanced" : "Advanced Settings"}
          </Btn>
        </div>

        {/* CC — always visible below the credential row */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <FieldLabel>CC (comma-separated — leave blank if none)</FieldLabel>
          <input
            type="text"
            placeholder="e.g. fc1ccd@iitg.ac.in, cdo.ccd@iitg.ac.in"
            value={defaultCc}
            onChange={(e) => setDefaultCc(e.target.value)}
            style={inpStyle}
          />
        </div>

        {advOpen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${T.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div>
                <FieldLabel>Display From Name</FieldLabel>
                <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} style={inpStyle} />
              </div>
              <div>
                <FieldLabel>Throttle Delay Per Message (ms)</FieldLabel>
                <input type="number" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} style={inpStyle} />
              </div>
            </div>

            <div style={{ background: T.sunken, border: `1px solid ${T.border}`, padding: 14, borderRadius: 5 }}>
              <FieldLabel>Validate Sender via Test Email</FieldLabel>
              <div style={{ display: "flex", gap: 10, maxWidth: 500 }}>
                <input
                  type="email"
                  placeholder="Target test recipient address"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  style={{ ...inpStyle, flex: 1 }}
                />
                <Btn onClick={sendTest} disabled={testBusy || !fromEmail || !fromPwd}>
                  {testBusy ? "Sending…" : "Send Probe"}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Mail Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 14, alignItems: "start" }}>

        {/* Recipients Sidebar */}
        <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: `2px solid ${T.border}`, background: T.sunken }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Target Recipients</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, marginTop: 2 }}>
              {total > 0 ? `${total} loaded (${pendCount} unsent)` : "Upload candidates dataset"}
            </div>
          </div>
          <div style={{ padding: 12 }}>
            <label style={{ display: "block", marginBottom: 12 }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => { if (e.target.files[0]) { parseFile(e.target.files[0]); e.target.value = ""; } }}
                style={{ display: "none" }}
              />
              <div style={{
                padding: "8px",
                background: T.sunken,
                border: `1.5px dashed ${T.borderHi}`,
                borderRadius: 4,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                cursor: "pointer",
              }}>
                Import CSV / Excel File
              </div>
            </label>

            {columns.length > 0 && (
              <div style={{ marginBottom: 14, padding: "8px 10px", background: T.sunken, borderRadius: 5, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.textSec, marginBottom: 6, letterSpacing: "0.04em" }}>CLICK TO INSERT VARIABLE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {columns.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSubject((s) => s + `{{${c}}}`)}
                      style={{
                        padding: "3px 7px",
                        background: T.elevated,
                        color: T.text,
                        border: `1px solid ${T.borderHi}`,
                        borderRadius: 3,
                        fontSize: 11,
                        fontFamily: MONO,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {`{{${c}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {recipients.map((r, i) => (
                <div
                  key={i}
                  onClick={() => setPreviewIdx(i)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: previewIdx === i ? T.elevated : "transparent",
                    border: `1px solid ${previewIdx === i ? T.borderHi : "transparent"}`,
                  }}
                >
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.borderHi
                  }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: previewIdx === i ? T.text : T.textSec, fontFamily: MONO, fontSize: 11 }}>
                    {r.email || r.Email || r.EMAIL || `Entry #${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compose Window */}
        <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `2px solid ${T.border}`, background: T.sunken, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Mail Template Composer</span>
            <Btn size="sm" onClick={() => { setShowSavePanel((s) => !s); setDraftName(""); }}>
              {showSavePanel ? "Cancel" : "Save as Reusable Draft"}
            </Btn>
          </div>

          {showSavePanel && (
            <div style={{ padding: "12px 16px", background: T.elevated, borderBottom: `2px solid ${T.border}`, display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveDraft()}
                placeholder="Template Title (e.g. Shortlist Announcement Batch 1)"
                style={{ ...inpStyle, flex: 1 }}
              />
              <Btn variant="primary" size="md" onClick={saveDraft}>Save</Btn>
            </div>
          )}

          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <FieldLabel required>Email Subject</FieldLabel>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line with optional {{name}} substitution"
                style={{ ...inpStyle, fontSize: 14, fontWeight: 700 }}
              />
            </div>

            <div>
              <FieldLabel required>HTML Announcement Body</FieldLabel>
              <style>{`
                .wd-industrial .rdw-editor-wrapper {
                  background: ${T.sunken};
                  border-radius: 5px;
                  border: 1.5px solid ${T.border};
                }
                .wd-industrial .rdw-editor-toolbar {
                  background: ${T.surface};
                  border: none;
                  border-bottom: 1.5px solid ${T.border};
                  padding: 8px;
                }
                .wd-industrial .rdw-option-wrapper {
                  background: ${T.elevated};
                  border: 1px solid ${T.border};
                  border-radius: 3px;
                  min-width: 26px;
                  height: 26px;
                }
                .wd-industrial .rdw-option-wrapper:hover {
                  background: ${T.bg};
                  border-color: ${T.borderHi};
                }
                .wd-industrial .rdw-option-active {
                  background: #ffffff !important;
                  border-color: #ffffff !important;
                }
                .wd-industrial .rdw-option-active img {
                  filter: invert(1) !important;
                }
                .wd-industrial .rdw-option-wrapper img {
                  filter: invert(0.8);
                }
                .wd-industrial .rdw-dropdown-wrapper {
                  background: ${T.elevated};
                  border: 1px solid ${T.border};
                  border-radius: 3px;
                  height: 26px;
                }
                .wd-industrial .rdw-dropdown-selectedtext {
                  color: ${T.text};
                  font-family: ${FONT};
                  font-size: 12px;
                  font-weight: 700;
                }
                .wd-industrial .rdw-dropdownoption-default {
                  background: ${T.surface};
                  color: ${T.text};
                  font-family: ${FONT};
                  font-size: 12px;
                  font-weight: 600;
                }
                .wd-industrial .rdw-dropdownoption-default:hover {
                  background: ${T.elevated};
                }
                .wd-industrial .rdw-editor-main {
                  color: ${T.text};
                  font-family: ${FONT};
                  font-size: 14px;
                  min-height: 260px;
                  max-height: 380px;
                  overflow-y: auto;
                  padding: 14px 16px;
                  line-height: 1.6;
                }
                .wd-industrial .DraftEditor-root {
                  color: ${T.text};
                }
                .wd-industrial .public-DraftEditorPlaceholder-root {
                  color: ${T.muted};
                }
                .wd-industrial .rdw-dropdown-carettoopen,
                .wd-industrial .rdw-dropdown-carettoclose {
                  border-top-color: ${T.textSec};
                  border-bottom-color: ${T.textSec};
                }
              `}</style>

              <div className="wd-industrial">
                <Editor
                  editorState={editorState}
                  onEditorStateChange={setEditorState}
                  wrapperStyle={{ margin: 0 }}
                  toolbarStyle={{ margin: 0 }}
                  placeholder="Draft email content here. Use {{column_name}} tokens to inject student parameters dynamically."
                  handlePastedText={handlePastedText}
                  blockRendererFn={blockRendererFn}
                  toolbarCustomButtons={[<HrButton key="hr" />]}
                  toolbar={{
                    options: ["inline", "blockType", "fontSize", "list", "textAlign", "link", "history"],
                    inline: { options: ["bold", "italic", "underline", "strikethrough"] },
                    blockType: { options: ["Normal", "H1", "H2", "H3", "Blockquote"] },
                    fontSize: { options: [12, 13, 14, 16, 18, 22] },
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

        {/* Preview / Dispatch Monitor */}
        <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `2px solid ${T.border}` }}>
            {["preview", "status"].map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  border: "none",
                  background: rightTab === t ? T.surface : T.sunken,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: FONT,
                  color: rightTab === t ? T.text : T.muted,
                  borderBottom: `2px solid ${rightTab === t ? T.primary : "transparent"}`,
                  letterSpacing: "0.02em"
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {rightTab === "preview" && (
            <div style={{ padding: 12 }}>
              {recipients.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <FieldLabel>Sample With Row Target</FieldLabel>
                  <select
                    value={previewIdx}
                    onChange={(e) => setPreviewIdx(Number(e.target.value))}
                    style={{ ...inpStyle, cursor: "pointer" }}
                  >
                    {recipients.map((r, i) => (
                      <option key={i} value={i}>
                        Row {i + 1}: {r.email || r.Email || "No Email"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: T.textSec }}>
                Subject: <span style={{ color: T.text }}>{sub(subject, previewRow) || "—"}</span>
              </div>

              <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 4, overflow: "hidden", height: 320, background: "#ffffff" }}>
                {currentBody ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px;margin:0;font-size:14px;line-height:1.5;color:#111827">${sub(currentBody, previewRow)}</body></html>`}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    title="rendered-preview"
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", fontSize: 13, fontWeight: 600 }}>
                    Type body content to inspect preview
                  </div>
                )}
              </div>
            </div>
          )}

          {rightTab === "status" && (
            <div style={{ padding: 12 }}>
              {jobStatus && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                    <span style={{ color: jobStatus === "done" ? T.success : T.primary }}>
                      {jobStatus === "done" ? "BATCH FINISHED" : jobStatus === "stopped" ? "ABORTED" : "TRANSMITTING…"}
                    </span>
                    <span style={{ fontFamily: MONO }}>{sentCount + failCount} / {total}</span>
                  </div>

                  <div style={{ background: T.sunken, borderRadius: 3, height: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div style={{ height: "100%", background: jobStatus === "done" ? T.success : T.primary, width: `${progress}%`, transition: "width .2s ease" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                    <div style={{ textAlign: "center", padding: "8px 4px", background: T.sunken, borderRadius: 4, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.success, fontFamily: MONO }}>{sentCount}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec }}>SENT</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "8px 4px", background: T.sunken, borderRadius: 4, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.danger, fontFamily: MONO }}>{failCount}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec }}>FAILED</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "8px 4px", background: T.sunken, borderRadius: 4, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.textSec, fontFamily: MONO }}>{pendCount}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec }}>LEFT</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ maxHeight: 270, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                {recipients.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: MONO,
                      fontWeight: 600,
                      background: r._status === "failed" ? T.dangerBg : T.sunken,
                      border: `1px solid ${r._status === "failed" ? T.danger + "44" : T.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text, maxWidth: 180 }}>
                      {r.email || r.Email || `Entry #${i + 1}`}
                    </span>
                    <span style={{
                      fontWeight: 800,
                      color: r._status === "sent" ? T.success : r._status === "failed" ? T.danger : T.muted
                    }}>
                      {r._status ? r._status.toUpperCase() : "QUEUED"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Send Action Bar */}
      <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          {!sending && jobStatus !== "done" && (
            <Btn
              variant="primary"
              size="lg"
              disabled={!total || !subject || !currentBody || !fromEmail || !fromPwd}
              onClick={startSend}
            >
              Dispatch Batch to {pendCount || total} Recipient{(pendCount || total) !== 1 ? "s" : ""}
            </Btn>
          )}
          {sending && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Btn variant="danger" size="lg" onClick={stopSend}>Emergency Abort</Btn>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textSec, fontFamily: MONO }}>
                Transmitting sequence ({sentCount + failCount} / {total})…
              </span>
            </div>
          )}
          {jobStatus === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Btn
                size="lg"
                onClick={() => {
                  setJobId(null);
                  setJobStatus(null);
                  setSummary(null);
                  setRecipients((rs) => rs.map((r) => ({ ...r, _status: "pending", _error: null })));
                }}
              >
                Reset Queue For Next Run
              </Btn>
              {summary && (
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textSec }}>
                  Finished: {summary.sent} successful deliveries, {summary.failed} dropouts.
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>
          Double check active throttle speed and CC list before firing batches.
        </div>
      </div>

      {/* Standard Templates — always available, read-only */}
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>Standard Templates</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textSec, fontWeight: 500 }}>Built-in CCD templates — always available, load to edit and send</p>
        </div>
        <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
          {STANDARD_DRAFTS.map((draft, idx) => (
            <div key={draft.id}
              style={{ padding: "13px 18px", borderBottom: idx < STANDARD_DRAFTS.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{draft.name}</div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 3, padding: "1px 5px", letterSpacing: "0.05em" }}>BUILT-IN</span>
                </div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 3, fontWeight: 500 }}>
                  Subject: {draft.subject}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                  Variables: <code style={{ fontFamily: MONO, fontSize: 10, color: T.accent }}>{"{{contact_name}}"}</code>{" "}
                  <code style={{ fontFamily: MONO, fontSize: 10, color: T.accent }}>{"{{company_name}}"}</code>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" variant="primary" onClick={() => loadDraft(draft)}>Load into Editor</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User-saved Drafts */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>Your Saved Drafts</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: T.textSec, fontWeight: 500 }}>Stored locally — survive page refresh and re-login</p>
          </div>
          {drafts.length > 0 && (
            <input
              type="text"
              placeholder="Search drafts…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              style={{ ...inpStyle, width: 220 }}
            />
          )}
        </div>

        {drafts.length === 0 ? (
          <div style={{ background: T.surface, border: `2px dashed ${T.border}`, borderRadius: 6, padding: "28px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textSec }}>No saved drafts yet</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>Click "Save as Reusable Draft" in the compose panel to store your custom templates here.</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No drafts match "{draftSearch}"
          </div>
        ) : (
          <div style={{ background: T.surface, border: `2px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
            {filteredDrafts.map((draft, idx) => (
              <div
                key={draft.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: idx < filteredDrafts.length - 1 ? `1px solid ${T.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 240px" }}>
                  {editingId === draft.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        autoFocus
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameDraft(draft.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{ ...inpStyle, height: 32, fontSize: 13 }}
                      />
                      <Btn size="sm" variant="primary" onClick={() => renameDraft(draft.id)}>Save</Btn>
                      <Btn size="sm" onClick={() => setEditingId(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{draft.name}</div>
                      <div style={{ fontSize: 12, color: T.textSec, marginTop: 2, fontWeight: 500 }}>
                        Subject: {draft.subject || "—"}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: MONO, color: T.muted, marginTop: 4 }}>
                        Saved: {fmtDate(draft.savedAt)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" onClick={() => loadDraft(draft)}>Load</Btn>
                  <Btn size="sm" onClick={() => updateDraft(draft.id)} title="Overwrite with current subject + body">Update</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => { setEditingId(draft.id); setRenameName(draft.name); }}>Rename</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => duplicateDraft(draft)}>Clone</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { if (window.confirm(`Delete "${draft.name}"?`)) deleteDraft(draft.id); }}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page Shell ────────────────────────────────────────────────────── */
export default function SharePage() {
  useDesignFont();
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState("upload");

  if (!authed) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: T.surface,
              color: T.text,
              border: `2px solid ${T.borderHi}`,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
            }
          }}
        />
        <PasswordGate onAuth={() => setAuthed(true)} />
      </>
    );
  }

  const TABS = [
    { id: "upload", label: "Upload & File Tools" },
    { id: "excel",  label: "Spreadsheet Scratchpad" },
    { id: "files",  label: "File Registry & Links" },
    { id: "mail",   label: "Batch Mail Dispatcher" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: T.surface,
            color: T.text,
            border: `2px solid ${T.borderHi}`,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
          }
        }}
      />

      {/* Top Navigation Bar */}
      <header style={{ padding: "14px 28px", borderBottom: `2px solid ${T.border}`, background: T.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>Share for Care</span>
          <span style={{ height: 16, width: 1.5, background: T.borderHi }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, letterSpacing: "0.04em" }}>CENTRE FOR CAREER DEVELOPMENT • IIT GUWAHATI</span>
        </div>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => {
            sessionStorage.removeItem(TOKEN_KEY);
            setAuthed(false);
          }}
        >
          Sign Out
        </Btn>
      </header>

      {/* Primary Section Switcher */}
      <nav style={{ borderBottom: `2px solid ${T.border}`, padding: "0 28px", background: T.sunken, display: "flex", gap: 4 }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "13px 18px",
                border: "none",
                background: active ? T.surface : "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 800,
                fontFamily: FONT,
                color: active ? T.text : T.muted,
                borderBottom: `2.5px solid ${active ? T.primary : "transparent"}`,
                letterSpacing: "-0.01em",
                transition: "color 0.1s ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Active Work Area */}
      <main style={{ padding: "28px", maxWidth: 1440, margin: "0 auto" }}>
        {tab === "upload" && <UploadToolsTab />}
        {tab === "excel"  && <ExcelCreatorTab />}
        {tab === "files"  && <FilesTab />}
        {tab === "mail"   && <MailTab />}
      </main>
    </div>
  );
}