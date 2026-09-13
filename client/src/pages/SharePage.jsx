import React, { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_BASE || (
  process.env.NODE_ENV === "production" ? "/dday/api" : "http://localhost:4000/dday/api"
);

// ── Utility helpers ───────────────────────────────────────────────────────────

function fmt(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function typeInfo(mime = "") {
  if (mime.includes("pdf"))                                return { label: "PDF",  color: "#D83B01" };
  if (mime.includes("image"))                              return { label: "IMG",  color: "#107C10" };
  if (mime.includes("zip"))                                return { label: "ZIP",  color: "#8764B8" };
  if (mime.includes("word") || mime.includes("docx"))      return { label: "DOC",  color: "#0078D4" };
  if (mime.includes("sheet") || mime.includes("xlsx"))     return { label: "XLS",  color: "#217346" };
  if (mime.includes("csv"))                                return { label: "CSV",  color: "#217346" };
  if (mime.includes("text"))                               return { label: "TXT",  color: "#767A81" };
  return { label: "FILE", color: "#14213D" };
}

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem("jwt_token");
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
};

// ── Small shared components ───────────────────────────────────────────────────

const DownloadBtn = ({ file, label = "Download", style = {} }) => (
  <a
    href={`${API}/share/file/${file.shareUrl}`}
    download
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 32, padding: "0 16px", fontSize: 13, fontWeight: 600,
      color: "#fff", background: "#14213D", borderRadius: 2, textDecoration: "none",
      transition: "background .15s", ...style,
    }}
    onMouseEnter={e => e.currentTarget.style.background = "#1C2C4F"}
    onMouseLeave={e => e.currentTarget.style.background = "#14213D"}
  >
    <DownloadIco /> {label}
  </a>
);

const SaveBtn = ({ fileId, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handle = async () => {
    setSaving(true);
    const r = await authFetch(`${API}/share/tools/save/${fileId}`, { method: "PATCH" });
    if (r.ok) { setSaved(true); onSaved && onSaved(); }
    setSaving(false);
  };
  if (saved) return <span style={{ fontSize: 12, color: "#107C10", fontWeight: 600 }}>✓ Saved to shared files</span>;
  return (
    <button onClick={handle} disabled={saving}
      style={{ height: 32, padding: "0 14px", fontSize: 13, fontWeight: 600, color: "#14213D",
        background: "#fff", border: "1px solid #D0CCC9", borderRadius: 2, cursor: "pointer" }}
    >{saving ? "Saving…" : "Save permanently"}</button>
  );
};

const ResultBox = ({ result, onSaved }) => (
  <div style={{ marginTop: 14, padding: "12px 14px", background: "#F4F2F1", borderRadius: 2, border: "1px solid #E4E1E0" }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#107C10", marginBottom: 8 }}>
      ✓ {result.message || "Done"}
      {result.reduction && <span style={{ color: "#8D9096", fontWeight: 400, marginLeft: 8 }}>({result.reduction} smaller)</span>}
      {result.count !== undefined && <span style={{ color: "#8D9096", fontWeight: 400, marginLeft: 8 }}>({result.count} students)</span>}
      {result.pageCount !== undefined && <span style={{ color: "#8D9096", fontWeight: 400, marginLeft: 8 }}>({result.pageCount} pages)</span>}
      {result.fileCount !== undefined && <span style={{ color: "#8D9096", fontWeight: 400, marginLeft: 8 }}>({result.fileCount} files)</span>}
    </div>
    <div style={{ fontSize: 12, color: "#8D9096", marginBottom: 10 }}>
      {result.file.originalName} · {fmt(result.file.fileSize)} · expires in 15 min
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <DownloadBtn file={result.file} />
      <SaveBtn fileId={result.file._id} onSaved={onSaved} />
    </div>
    {result.failed?.length > 0 && (
      <div style={{ marginTop: 8, fontSize: 11, color: "#D83B01" }}>
        Failed to download {result.failed.length} URL{result.failed.length > 1 ? "s" : ""}
      </div>
    )}
  </div>
);

// Drop zone component for multi/single file upload
function DropZone({ multiple, accept, value, onChange, label }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const fileList = value ? (multiple ? Array.from(value) : [value]) : [];

  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onChange(multiple ? e.dataTransfer.files : e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? "#14213D" : "#D0CCC9"}`, borderRadius: 2,
        padding: "18px 12px", textAlign: "center", cursor: "pointer",
        background: drag ? "#EDE9E7" : "#FAFAF9", transition: "all .15s", marginBottom: 10,
      }}
    >
      <input ref={ref} type="file" multiple={multiple} accept={accept} style={{ display: "none" }}
        onChange={e => onChange(multiple ? e.target.files : e.target.files[0])} />
      {fileList.length > 0 ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#14213D" }}>
          {multiple ? `${fileList.length} file${fileList.length > 1 ? "s" : ""} selected` : fileList[0].name}
          <div style={{ fontSize: 11, color: "#8D9096", fontWeight: 400, marginTop: 2 }}>
            {multiple ? fileList.map(f => f.name).join(", ") : fmt(fileList[0].size)}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "#8D9096" }}>{label || "Click or drag files here"}</div>
      )}
    </div>
  );
}

const Btn = ({ onClick, disabled, loading, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled || loading}
    style={{
      height: 34, padding: "0 20px", fontSize: 13, fontWeight: 600, color: "#fff",
      background: disabled || loading ? "#8D9096" : "#14213D", border: "none", borderRadius: 2,
      cursor: disabled || loading ? "default" : "pointer", transition: "background .15s", ...style,
    }}
    onMouseEnter={e => !(disabled || loading) && (e.currentTarget.style.background = "#1C2C4F")}
    onMouseLeave={e => !(disabled || loading) && (e.currentTarget.style.background = "#14213D")}
  >{loading ? "Processing…" : children}</button>
);

// ── Tool cards ────────────────────────────────────────────────────────────────

function ToolCard({ title, description, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: "18px 20px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#14213D", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#8D9096", marginBottom: 14 }}>{description}</div>
      {children}
    </div>
  );
}

function ImageCompressorTool() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState("jpeg");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    const fd = new FormData();
    fd.append("image", file); fd.append("quality", quality); fd.append("format", format);
    try {
      const r = await authFetch(`${API}/share/tools/compress-image`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: "Image compressed" }); else setErr(d.message);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="Image Compressor" description="Compress JPEG, PNG or WebP images and reduce file size.">
      <DropZone accept="image/*" value={file} onChange={setFile} label="Click or drag an image here" />
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: "#353B47" }}>
          Quality: <strong>{quality}%</strong>
          <input type="range" min="10" max="100" value={quality} onChange={e => setQuality(+e.target.value)}
            style={{ marginLeft: 8, width: 100, verticalAlign: "middle" }} />
        </label>
        <label style={{ fontSize: 12, color: "#353B47" }}>
          Format:{" "}
          {["jpeg", "webp", "png"].map(f => (
            <label key={f} style={{ marginLeft: 8, cursor: "pointer" }}>
              <input type="radio" checked={format === f} onChange={() => setFormat(f)} style={{ marginRight: 3 }} />
              {f.toUpperCase()}
            </label>
          ))}
        </label>
      </div>
      <Btn onClick={run} disabled={!file} loading={busy}>Compress</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

function PdfMergerTool() {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!files || files.length < 2) return;
    setBusy(true); setErr(null); setResult(null);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("pdfs", f));
    try {
      const r = await authFetch(`${API}/share/tools/merge-pdfs`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: "PDFs merged" }); else setErr(d.message);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="PDF Merger" description="Combine multiple PDFs into a single document. Order matches the upload order.">
      <DropZone accept=".pdf,application/pdf" multiple value={files} onChange={setFiles} label="Click or drag PDF files here (2+)" />
      <Btn onClick={run} disabled={!files || Array.from(files || []).length < 2} loading={busy}>Merge PDFs</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

function FilesZipTool() {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!files || !files.length) return;
    setBusy(true); setErr(null); setResult(null);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    try {
      const r = await authFetch(`${API}/share/tools/compress-files`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: "ZIP created" }); else setErr(d.message);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="Files → ZIP" description="Bundle any mix of files into a single ZIP archive.">
      <DropZone multiple value={files} onChange={setFiles} label="Click or drag files here" />
      <Btn onClick={run} disabled={!files || !files.length} loading={busy}>Create ZIP</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

function CvDownloaderTool() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    const fd = new FormData(); fd.append("excel", file);
    try {
      const r = await authFetch(`${API}/share/tools/cv-downloader`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: `Downloaded ${d.success} CV${d.success !== 1 ? "s" : ""}` });
      else setErr(d.message + (d.availableColumns ? ` — Columns found: ${d.availableColumns.join(", ")}` : ""));
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="CV Bulk Downloader" description="Upload an Excel/CSV with a Resume or CV URL column — downloads all CVs and zips them.">
      <DropZone accept=".xlsx,.xls,.csv" value={file} onChange={setFile} label="Click or drag Excel/CSV here" />
      <div style={{ fontSize: 11, color: "#8D9096", marginBottom: 10 }}>
        Expected column names: <code>Resume</code>, <code>CV</code>, <code>cv</code>, <code>drive_Link</code>
      </div>
      <Btn onClick={run} disabled={!file} loading={busy}>Download CVs</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

function ExcelExportTool() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await authFetch(`${API}/share/tools/export-placements`);
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: `Exported ${d.count} placed student${d.count !== 1 ? "s" : ""}` });
      else setErr(d.message);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="Export Placements" description="Generate an Excel sheet of all currently placed students with company and academic details.">
      <Btn onClick={run} loading={busy}>Generate Excel</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

function SpreadsheetConverterTool() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const isCSV = file && (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv");

  const run = async () => {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await authFetch(`${API}/share/tools/convert-spreadsheet`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) setResult({ ...d, message: isCSV ? "Converted to Excel" : "Converted to CSV" });
      else setErr(d.message);
    } catch { setErr("Network error"); }
    setBusy(false);
  };

  return (
    <ToolCard title="Spreadsheet Converter" description="Convert CSV → Excel (.xlsx) or Excel → CSV — one click.">
      <DropZone accept=".csv,.xlsx,.xls,.ods" value={file} onChange={setFile} label="Click or drag CSV / Excel here" />
      {file && (
        <div style={{ fontSize: 12, color: "#8D9096", marginBottom: 10 }}>
          Will convert to: <strong>{isCSV ? "Excel (.xlsx)" : "CSV (.csv)"}</strong>
        </div>
      )}
      <Btn onClick={run} disabled={!file} loading={busy}>Convert</Btn>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#D83B01" }}>{err}</div>}
      {result && <ResultBox result={result} />}
    </ToolCard>
  );
}

// ── File card (public + admin view) ──────────────────────────────────────────

function FileCard({ file, isAdmin, onDelete }) {
  const { label, color } = typeInfo(file.mimeType);
  const [del, setDel] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return;
    setDel(true);
    const r = await authFetch(`${API}/share/files/${file._id}`, { method: "DELETE" });
    if (r.ok) onDelete(file._id); else { alert("Delete failed"); setDel(false); }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flexShrink: 0, width: 36, height: 36, background: color, borderRadius: 2,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
          {label}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#14213D", lineHeight: 1.3, wordBreak: "break-word" }}>{file.originalName}</div>
          <div style={{ fontSize: 12, color: "#8D9096", marginTop: 3 }}>
            {fmt(file.fileSize)}{file.downloadCount > 0 && ` · ${file.downloadCount} download${file.downloadCount !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <DownloadBtn file={file} style={{ flex: 1 }} />
        {isAdmin && (
          <button onClick={handleDelete} disabled={del} title="Delete"
            style={{ height: 32, width: 32, border: "1px solid #E4E1E0", borderRadius: 2, background: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: del ? "#ccc" : "#D83B01" }}>
            <TrashIco />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Upload panel (admin only) ─────────────────────────────────────────────────

function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [perm, setPerm] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("isPermanent", String(perm));
    try {
      const r = await authFetch(`${API}/share/upload`, { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) { onUploaded(d.file); setFile(null); } else alert(d.message || "Upload failed");
    } catch { alert("Network error"); }
    setBusy(false);
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: "18px 20px", marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D", marginBottom: 12 }}>Upload a file to share publicly</div>
      <DropZone value={file} onChange={setFile} label="Click or drag a file here" />
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        {[{ v: true, l: "Permanent" }, { v: false, l: "Expires in 15 min" }].map(({ v, l }) => (
          <label key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="radio" checked={perm === v} onChange={() => setPerm(v)} /> {l}
          </label>
        ))}
      </div>
      <Btn onClick={run} disabled={!file} loading={busy}>Upload & Share</Btn>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const DownloadIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const TrashIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "files", label: "Shared Files" },
  { id: "tools", label: "Tools", adminOnly: true },
];

export default function SharePage() {
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab]         = useState("files");

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.role === "admin") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/share/public`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setFiles(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F2F1",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: "antialiased" }}>

      {/* Header */}
      <header style={{ background: "#14213D", padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>CCD · IIT Guwahati</span>
          <span style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)",
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Share for Care
          </span>
        </div>
        <a href="/dday/login" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>Portal →</a>
      </header>

      {/* Tab bar — only shown if admin */}
      {isAdmin && visibleTabs.length > 1 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #E4E1E0", padding: "0 24px", display: "flex" }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                height: 44, padding: "0 20px", fontSize: 13, fontWeight: 600, background: "transparent", border: "none",
                borderBottom: `2px solid ${tab === t.id ? "#14213D" : "transparent"}`,
                color: tab === t.id ? "#14213D" : "#8D9096", cursor: "pointer", transition: "color .15s",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px 64px" }}>

        {/* ── Files tab ── */}
        {tab === "files" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#14213D", margin: 0, letterSpacing: "-0.02em" }}>Shared Resources</h1>
              <p style={{ fontSize: 13, color: "#8D9096", marginTop: 6 }}>Files shared by the CCD team — free to download.</p>
            </div>

            {isAdmin && <UploadPanel onUploaded={f => setFiles(prev => [f, ...prev])} />}

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#8D9096", fontSize: 14 }}>Loading…</div>
            ) : error ? (
              <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#D83B01", marginBottom: 6 }}>Could not load files</div>
                <div style={{ fontSize: 13, color: "#8D9096" }}>The server may be unavailable.</div>
              </div>
            ) : files.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: "48px 32px", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#14213D", marginBottom: 6 }}>Nothing shared yet</div>
                <div style={{ fontSize: 13, color: "#8D9096" }}>The CCD team hasn't shared any files publicly yet.</div>
                <div style={{ fontSize: 12, color: "#ABADB3", marginTop: 16 }}>Regards, Avinash and Gaurab</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {files.map(f => (
                  <FileCard key={f._id || f.shareUrl} file={f} isAdmin={isAdmin}
                    onDelete={id => setFiles(prev => prev.filter(x => x._id !== id))} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tools tab (admin only) ── */}
        {tab === "tools" && isAdmin && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#14213D", margin: 0, letterSpacing: "-0.02em" }}>Tools</h1>
              <p style={{ fontSize: 13, color: "#8D9096", marginTop: 6 }}>
                Process files — results expire in 15 min. Use "Save permanently" to add them to the shared files list.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              <ImageCompressorTool />
              <PdfMergerTool />
              <FilesZipTool />
              <CvDownloaderTool />
              <ExcelExportTool />
              <SpreadsheetConverterTool />
            </div>
          </>
        )}
      </main>

      <footer style={{ borderTop: "1px solid #E4E1E0", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, color: "#ABADB3", letterSpacing: "0.03em" }}>
        <span>Center for Career Development · IIT Guwahati</span>
        <a href="/dday/team" style={{ color: "#ABADB3", textDecoration: "none" }}>Meet the team →</a>
      </footer>
    </div>
  );
}
