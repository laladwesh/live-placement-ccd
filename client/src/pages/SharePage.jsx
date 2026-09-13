import React, { useState, useEffect, useRef } from "react";

// Always talks to the live-placement backend (same origin in prod, port 4000 in dev)
const API_BASE = process.env.REACT_APP_API_BASE || (
  process.env.NODE_ENV === "production"
    ? "/dday/api"
    : "http://localhost:4000/dday/api"
);

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function typeInfo(mimeType = "") {
  if (mimeType.includes("pdf"))                              return { label: "PDF",  color: "#D83B01" };
  if (mimeType.includes("image"))                            return { label: "IMG",  color: "#107C10" };
  if (mimeType.includes("zip") || mimeType.includes("x-zip")) return { label: "ZIP",  color: "#8764B8" };
  if (mimeType.includes("word") || mimeType.includes("docx")) return { label: "DOC",  color: "#0078D4" };
  if (mimeType.includes("sheet") || mimeType.includes("xlsx") || mimeType.includes("csv")) return { label: "XLS", color: "#217346" };
  if (mimeType.includes("text"))                             return { label: "TXT",  color: "#767A81" };
  return { label: "FILE", color: "#14213D" };
}

function FileCard({ file, onDelete, isAdmin }) {
  const { label, color } = typeInfo(file.mimeType);
  const downloadUrl = `${API_BASE}/share/file/${file.shareUrl}`;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return;
    setDeleting(true);
    const token = localStorage.getItem("jwt_token");
    const r = await fetch(`${API_BASE}/share/files/${file._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) onDelete(file._id);
    else { alert("Delete failed"); setDeleting(false); }
  };

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E4E1E0",
      borderRadius: 2,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 36, height: 36, background: color, borderRadius: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em",
        }}>
          {label}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#14213D", lineHeight: 1.3, wordBreak: "break-word" }}>
            {file.originalName}
          </div>
          <div style={{ fontSize: 12, color: "#8D9096", marginTop: 3 }}>
            {formatBytes(file.fileSize)}
            {file.downloadCount > 0 && (
              <span style={{ marginLeft: 8 }}>· {file.downloadCount} download{file.downloadCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <a
          href={downloadUrl}
          download
          style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 32, padding: "0 16px", fontSize: 13, fontWeight: 600,
            color: "#fff", background: "#14213D", border: "none", borderRadius: 2,
            textDecoration: "none", cursor: "pointer", boxSizing: "border-box", transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#1C2C4F"}
          onMouseLeave={e => e.currentTarget.style.background = "#14213D"}
        >
          <DownloadIcon />
          Download
        </a>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              height: 32, width: 32, border: "1px solid #E4E1E0", borderRadius: 2, background: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: deleting ? "#ccc" : "#D83B01", transition: "background 0.15s",
            }}
            onMouseEnter={e => !deleting && (e.currentTarget.style.background = "#FFF4F0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            title="Delete"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [permanent, setPermanent] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const token = localStorage.getItem("jwt_token");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("isPermanent", String(permanent));
    try {
      const r = await fetch(`${API_BASE}/share/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (r.ok) { onUploaded(data.file); setFile(null); }
      else alert(data.message || "Upload failed");
    } catch { alert("Network error"); }
    setUploading(false);
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: "18px 20px", marginBottom: 24,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#14213D", marginBottom: 12, letterSpacing: "0.02em" }}>
        Upload a file to share
      </div>

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${drag ? "#14213D" : "#D0CCC9"}`,
          borderRadius: 2, padding: "24px 16px", textAlign: "center", cursor: "pointer",
          background: drag ? "#F4F2F1" : "#FAFAF9", marginBottom: 12, transition: "all 0.15s",
        }}
      >
        <input ref={inputRef} type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
        {file ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#14213D" }}>{file.name} — {formatBytes(file.size)}</div>
        ) : (
          <div style={{ fontSize: 13, color: "#8D9096" }}>
            Click or drag a file here
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#353B47", cursor: "pointer" }}>
          <input type="radio" checked={permanent} onChange={() => setPermanent(true)} /> Permanent
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#353B47", cursor: "pointer" }}>
          <input type="radio" checked={!permanent} onChange={() => setPermanent(false)} /> Expires in 15 min
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          height: 32, padding: "0 20px", fontSize: 13, fontWeight: 600,
          color: "#fff", background: !file || uploading ? "#8D9096" : "#14213D",
          border: "none", borderRadius: 2, cursor: !file || uploading ? "default" : "pointer",
          transition: "background 0.15s",
        }}
      >
        {uploading ? "Uploading…" : "Upload & Share"}
      </button>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SharePage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if logged-in admin
  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    fetch(`${API_BASE}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user?.role === "admin") setIsAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/share/public`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setFiles(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const handleUploaded = (newFile) => {
    if (newFile.isPermanent) setFiles(prev => [newFile, ...prev]);
  };

  const handleDelete = (id) => {
    setFiles(prev => prev.filter(f => f._id !== id));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F4F2F1",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* Header */}
      <header style={{
        background: "#14213D",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
            CCD · IIT Guwahati
          </span>
          <span style={{
            background: "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 11, fontWeight: 600,
            padding: "2px 8px", borderRadius: 2,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Shared Resources
          </span>
        </div>
        <a
          href="/dday/login"
          style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500, textDecoration: "none" }}
        >
          Portal →
        </a>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#14213D", margin: 0, letterSpacing: "-0.02em" }}>
            Shared Resources
          </h1>
          <p style={{ fontSize: 13, color: "#8D9096", marginTop: 6 }}>
            Files shared by the CCD team — free to download.
          </p>
        </div>

        {/* Admin upload panel */}
        {isAdmin && <UploadPanel onUploaded={handleUploaded} />}

        {/* File grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#8D9096", fontSize: 14 }}>Loading…</div>
        ) : error ? (
          <div style={{
            background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2, padding: 32, textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#D83B01", marginBottom: 6 }}>Could not load files</div>
            <div style={{ fontSize: 13, color: "#8D9096" }}>The server may be unavailable. Try again later.</div>
          </div>
        ) : files.length === 0 ? (
          <div style={{
            background: "#fff", border: "1px solid #E4E1E0", borderRadius: 2,
            padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#14213D", marginBottom: 6 }}>Nothing shared yet</div>
            <div style={{ fontSize: 13, color: "#8D9096" }}>The CCD team hasn't shared any files publicly yet.</div>
            <div style={{ fontSize: 12, color: "#ABADB3", marginTop: 16 }}>Regards, Avinash and Gaurab</div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}>
            {files.map(f => (
              <FileCard key={f._id || f.shareUrl} file={f} isAdmin={isAdmin} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #E4E1E0", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11, color: "#ABADB3", letterSpacing: "0.03em",
      }}>
        <span>Center for Career Development · IIT Guwahati</span>
        <a href="/dday/team" style={{ color: "#ABADB3", textDecoration: "none" }}>Meet the team →</a>
      </footer>
    </div>
  );
}
