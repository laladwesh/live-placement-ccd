import React, { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "react-draft-wysiwyg";
import { EditorState, convertToRaw, ContentState } from "draft-js";
import draftToHtml from "draftjs-to-html";
import htmlToDraft from "html-to-draftjs";
import * as XLSX from "xlsx";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

const API = process.env.REACT_APP_API_BASE || (
  process.env.NODE_ENV === "production" ? "/dday/api" : "http://localhost:4000/dday/api"
);

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem("jwt_token");
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
};

// ── CCD default template ──────────────────────────────────────────────────────
const CCD_TEMPLATE_HTML = `<p>Dear Team,</p>
<p><i><b><span style="color:#4e9eff;">Greetings from the Centre for Career Development, IIT Guwahati.</span></b></i></p>
<p>We are delighted to invite <b>{{company_name}}</b> to participate in the Internship Recruitment Drive 2026-27 at IIT Guwahati and engage with one of the country's most talented pools of students across engineering, sciences, design, and interdisciplinary domains.</p>
<p>As we are progressing through the internship season, we request you to submit your Job Application Form (JAF) through the internship portal as early as possible.</p>
<p>Internship JAF Portal:<br><a href="https://www.iitg.ac.in/intern/auth/login/recruiter" style="color:#4e9eff;">https://www.iitg.ac.in/intern/auth/login/recruiter</a></p>
<p>We look forward to partnering with <b>{{company_name}}</b> and facilitating a successful internship hiring process at IIT Guwahati.</p>
<p>For any queries, please feel free to reach out to the undersigned.</p>
<p>Warm regards,</p>
<p><b>{{contact_name}}</b><br>{{contact_title}}<br>Centre for Career Development<br>Indian Institute of Technology Guwahati<br>Contact: {{contact_phone}}</p>`;

const DEFAULT_SUBJECT = "Internship Recruitment Drive 2026-27 - IIT Guwahati - {{company_name}}";

// ── Helpers ───────────────────────────────────────────────────────────────────

function substituteVars(template, row = {}) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
    String(row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? `{{${key}}}`)
  );
}

function htmlToEditorState(html) {
  const { contentBlocks, entityMap } = htmlToDraft(html);
  return EditorState.createWithContent(ContentState.createFromBlockArray(contentBlocks, entityMap));
}

function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        const normalized = rows.map(r => {
          const out = {};
          Object.keys(r).forEach(k => { out[k.trim().toLowerCase().replace(/\s+/g, "_")] = String(r[k]).trim(); });
          return out;
        });
        resolve(normalized);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VarChip({ name, onClick, title }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onClick(`{{${name}}}`)}
      title={title || `Insert {{${name}}}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px",
        fontSize: 11, fontWeight: 600, fontFamily: "monospace",
        background: hover ? "#14213D" : "#EDE9E7", color: hover ? "#fff" : "#14213D",
        border: "1px solid #D0CCC9", borderRadius: 2, cursor: "pointer", transition: "all .12s",
        whiteSpace: "nowrap",
      }}
    >{`{{${name}}}`}</button>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:  { bg: "#F4F2F1", color: "#8D9096", label: "Pending" },
    sent:     { bg: "#DFF6DD", color: "#107C10", label: "Sent ✓" },
    failed:   { bg: "#FDE7E9", color: "#D83B01", label: "Failed ✗" },
    skipped:  { bg: "#FFF4CE", color: "#7A6A0A", label: "Skipped" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 2,
      background: s.bg, color: s.color }}>{s.label}</span>
  );
}

// ── SMTP Config ───────────────────────────────────────────────────────────────

function SmtpConfig({ cfg, onChange }) {
  const [advOpen, setAdvOpen] = useState(false);
  const [showPwd, setShowPwd]  = useState(false);
  const [testing, setTesting]  = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => onChange({ ...cfg, [k]: v });
  const configured = cfg.email && cfg.password;

  const testConnection = async () => {
    if (!cfg.testTo) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await authFetch(`${API}/mail/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpEmail: cfg.email, smtpPassword: cfg.password, fromName: cfg.fromName,
          toEmail: cfg.testTo, subject: "CCD Mail Sender — Connection Test",
          htmlBody: "<p>Test email from CCD Mail Sender GUI. SMTP is working correctly ✓</p>",
        }),
      });
      const d = await r.json();
      setTestResult(r.ok ? { ok: true, msg: "Test email sent ✓" } : { ok: false, msg: d.message });
    } catch { setTestResult({ ok: false, msg: "Network error" }); }
    setTesting(false);
  };

  return (
    <div style={{ background: "#fff", borderBottom: "2px solid #E4E1E0", flexShrink: 0 }}>

      {/* ── Primary bar — email + password always visible ── */}
      <div style={{ padding: "12px 24px", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>

        {/* Status dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexShrink: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: configured ? "#107C10" : "#D83B01",
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: configured ? "#107C10" : "#D83B01",
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {configured ? "Ready" : "Setup required"}
          </span>
        </div>

        {/* From email */}
        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#14213D", display: "block",
            marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            From (IITG email) <span style={{ color: "#D83B01" }}>*</span>
          </label>
          <input
            type="email"
            placeholder="internship@iitg.ac.in"
            value={cfg.email || ""}
            onChange={e => set("email", e.target.value)}
            style={{
              width: "100%", height: 36, padding: "0 12px", fontSize: 14, fontWeight: 500,
              border: `1.5px solid ${cfg.email ? "#107C10" : "#D83B01"}`,
              borderRadius: 2, fontFamily: "inherit", boxSizing: "border-box",
              outline: "none", background: cfg.email ? "#F8FFF8" : "#FFF8F8",
              transition: "border-color .15s, background .15s",
            }}
          />
        </div>

        {/* Password */}
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#14213D", display: "block",
            marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            App Password <span style={{ color: "#D83B01" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Office 365 app password"
              value={cfg.password || ""}
              onChange={e => set("password", e.target.value)}
              style={{
                width: "100%", height: 36, padding: "0 36px 0 12px", fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${cfg.password ? "#107C10" : "#D83B01"}`,
                borderRadius: 2, fontFamily: "monospace", boxSizing: "border-box",
                outline: "none", background: cfg.password ? "#F8FFF8" : "#FFF8F8",
                transition: "border-color .15s, background .15s",
              }}
            />
            <button
              onClick={() => setShowPwd(p => !p)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 2,
                color: "#8D9096", fontSize: 13, lineHeight: 1,
              }}
              title={showPwd ? "Hide password" : "Show password"}
            >{showPwd ? "🙈" : "👁"}</button>
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setAdvOpen(o => !o)}
          style={{
            height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600,
            background: advOpen ? "#14213D" : "#F4F2F1", color: advOpen ? "#fff" : "#353B47",
            border: "1px solid #D0CCC9", borderRadius: 2, cursor: "pointer",
            transition: "all .15s", whiteSpace: "nowrap", alignSelf: "flex-end",
          }}
        >
          {advOpen ? "▲ Less" : "▼ More settings"}
        </button>
      </div>

      {/* ── Advanced settings drawer ── */}
      {advOpen && (
        <div style={{ padding: "0 24px 16px", borderTop: "1px dashed #E4E1E0",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          {[
            { label: "From Name",          key: "fromName",  type: "text",   placeholder: "Centre for Career Development" },
            { label: "Default CC (comma-sep)", key: "defaultCc", type: "text", placeholder: "fc2ccd@iitg.ac.in, cdo.ccd@iitg.ac.in" },
            { label: "Delay between emails (ms)", key: "delayMs", type: "number", placeholder: "600" },
            { label: "Send test email to", key: "testTo",    type: "email",  placeholder: "your@email.com" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#8D9096", display: "block",
                marginBottom: 3, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {label}
              </label>
              <input type={type} placeholder={placeholder} value={cfg[key] || ""}
                onChange={e => set(key, e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 10px", fontSize: 13,
                  border: "1px solid #D0CCC9", borderRadius: 2, fontFamily: "inherit",
                  boxSizing: "border-box", outline: "none" }} />
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={testConnection}
              disabled={testing || !cfg.testTo || !cfg.email || !cfg.password}
              style={{ height: 32, padding: "0 16px", fontSize: 12, fontWeight: 600,
                background: "#14213D", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer",
                opacity: !cfg.testTo || !cfg.email || !cfg.password ? 0.35 : 1 }}>
              {testing ? "Sending…" : "Send Test Email"}
            </button>
            {testResult && (
              <span style={{ fontSize: 12, fontWeight: 600, color: testResult.ok ? "#107C10" : "#D83B01" }}>
                {testResult.msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recipients panel ──────────────────────────────────────────────────────────

function RecipientsPanel({ recipients, columns, onLoad }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const rows = await parseSpreadsheet(file);
      onLoad(rows);
    } catch { alert("Could not parse file. Use Excel or CSV."); }
  }, [onLoad]);

  const pendingCount = recipients.filter(r => r._status === "pending").length;
  const sentCount    = recipients.filter(r => r._status === "sent").length;
  const failedCount  = recipients.filter(r => r._status === "failed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D" }}>Recipients</div>

      {/* Upload zone */}
      <div
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        style={{ border: `2px dashed ${drag ? "#14213D" : "#D0CCC9"}`, borderRadius: 2, padding: "14px 10px",
          textAlign: "center", cursor: "pointer", background: drag ? "#EDE9E7" : "#FAFAF9", transition: "all .15s" }}>
        <input ref={ref} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])} />
        <div style={{ fontSize: 12, color: "#8D9096" }}>
          {recipients.length > 0 ? "Drop to replace" : "CSV or Excel"}<br />
          <span style={{ fontSize: 11 }}>company_name, email, [cc]</span>
        </div>
      </div>

      {/* Stats row */}
      {recipients.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 2,
            background: "#F4F2F1", color: "#14213D" }}>{recipients.length} total</span>
          {sentCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 2,
            background: "#DFF6DD", color: "#107C10" }}>{sentCount} sent</span>}
          {failedCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 2,
            background: "#FDE7E9", color: "#D83B01" }}>{failedCount} failed</span>}
        </div>
      )}

      {/* Available variables */}
      {columns.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#8D9096", textTransform: "uppercase",
            letterSpacing: "0.04em", marginBottom: 5 }}>Available variables</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {columns.map(c => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                padding: "2px 6px", background: "#EDE9E7", borderRadius: 2, color: "#14213D" }}>
                {`{{${c}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recipient list */}
      {recipients.length > 0 && (
        <div style={{ flex: 1, overflowY: "auto", borderRadius: 2, border: "1px solid #E4E1E0", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#EDEEF0", position: "sticky", top: 0 }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Name / Company</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F0EDEB" }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.company_name || r.name || r.Name || "—"}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8D9096" }}>
                    {r.email || r.Email || "—"}
                  </td>
                  <td style={tdStyle}><StatusBadge status={r._status || "pending"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: "7px 8px", textAlign: "left", fontSize: 11, fontWeight: 600,
  color: "#353B47", borderRight: "1px solid #E4E1E0" };
const tdStyle = { padding: "6px 8px", color: "#494D57", verticalAlign: "middle" };

// ── Compose panel ─────────────────────────────────────────────────────────────

function ComposePanel({ subject, onSubjectChange, editorState, onEditorChange, columns }) {
  const subjectRef = useRef();

  const insertIntoSubject = (variable) => {
    const el = subjectRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const newVal = subject.slice(0, start) + variable + subject.slice(end);
    onSubjectChange(newVal);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + variable.length, start + variable.length); }, 0);
  };

  const loadCCDTemplate = () => {
    if (window.confirm("Load the CCD template? This will replace the current content.")) {
      onEditorChange(htmlToEditorState(CCD_TEMPLATE_HTML));
      onSubjectChange(DEFAULT_SUBJECT);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D" }}>Compose</div>
        <button onClick={loadCCDTemplate}
          style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#F4F2F1",
            border: "1px solid #D0CCC9", borderRadius: 2, cursor: "pointer", color: "#353B47" }}>
          Load CCD Template
        </button>
      </div>

      {/* Subject */}
      <div>
        <label style={labelStyle}>Subject</label>
        <input ref={subjectRef} type="text" value={subject} onChange={e => onSubjectChange(e.target.value)}
          style={{ width: "100%", height: 34, padding: "0 10px", fontSize: 13, border: "1px solid #D0CCC9",
            borderRadius: 2, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
        {columns.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
            {columns.slice(0, 8).map(c => (
              <VarChip key={c} name={c} onClick={insertIntoSubject} />
            ))}
          </div>
        )}
      </div>

      {/* WYSIWYG editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={labelStyle}>Email Body</label>
          {columns.length > 0 && (
            <div style={{ fontSize: 11, color: "#8D9096" }}>Type {"{{variable}}"} directly in the editor</div>
          )}
        </div>
        <div style={{ flex: 1, border: "1px solid #D0CCC9", borderRadius: 2, overflow: "hidden",
          display: "flex", flexDirection: "column", background: "#fff" }}>
          <Editor
            editorState={editorState}
            onEditorStateChange={onEditorChange}
            wrapperStyle={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}
            toolbarStyle={{ borderBottom: "1px solid #E4E1E0", margin: 0, background: "#FAFAF9",
              borderRadius: 0, padding: "4px 6px", flexShrink: 0 }}
            editorStyle={{ flex: 1, padding: "8px 12px", fontSize: 14, overflowY: "auto",
              minHeight: 200, fontFamily: "Arial, sans-serif" }}
            toolbar={{
              options: ["inline", "blockType", "fontSize", "colorPicker", "list", "textAlign", "link", "history"],
              inline: { options: ["bold", "italic", "underline", "strikethrough"], inDropdown: false },
              blockType: { options: ["Normal", "H1", "H2", "H3", "Blockquote"], inDropdown: true },
              fontSize: { options: [10, 11, 12, 14, 16, 18, 20, 24], inDropdown: true },
              list: { options: ["unordered", "ordered"], inDropdown: false },
              textAlign: { options: ["left", "center", "right"], inDropdown: true },
              colorPicker: { inDropdown: false },
              link: { inDropdown: false, defaultTargetOption: "_blank" },
              history: { inDropdown: false },
            }}
          />
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: "#8D9096", display: "block",
  marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" };

// ── Preview panel ─────────────────────────────────────────────────────────────

function PreviewPanel({ recipients, editorState, subject, smtpConfig }) {
  const [idx, setIdx] = useState(0);
  const row = recipients[Math.min(idx, recipients.length - 1)] || {};

  const rawHtml = draftToHtml(convertToRaw(editorState.getCurrentContent()));
  const resolvedBody    = substituteVars(rawHtml, row);
  const resolvedSubject = substituteVars(subject, row);

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#000;padding:16px;margin:0}a{color:#4e9eff}</style>
</head><body>${resolvedBody}</body></html>`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D" }}>Preview</div>

      {recipients.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#8D9096", fontSize: 13, textAlign: "center", border: "1px solid #E4E1E0", borderRadius: 2 }}>
          Load recipients to see a preview
        </div>
      ) : (
        <>
          {/* Recipient selector */}
          <div>
            <label style={labelStyle}>Preview as recipient</label>
            <select value={idx} onChange={e => setIdx(+e.target.value)}
              style={{ width: "100%", height: 32, padding: "0 8px", fontSize: 13,
                border: "1px solid #D0CCC9", borderRadius: 2, fontFamily: "inherit", boxSizing: "border-box" }}>
              {recipients.map((r, i) => (
                <option key={i} value={i}>
                  #{i + 1} — {r.company_name || r.name || r.email || `Row ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Resolved subject */}
          <div style={{ background: "#F4F2F1", borderRadius: 2, padding: "6px 10px" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#8D9096", textTransform: "uppercase", letterSpacing: "0.04em" }}>Subject: </span>
            <span style={{ fontSize: 13, color: "#14213D" }}>{resolvedSubject}</span>
          </div>

          {/* Email preview iframe */}
          <div style={{ flex: 1, border: "1px solid #E4E1E0", borderRadius: 2, overflow: "hidden", minHeight: 200 }}>
            <iframe
              srcDoc={fullHtml}
              title="Email Preview"
              style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              sandbox="allow-same-origin"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Sending status panel ──────────────────────────────────────────────────────

function StatusPanel({ recipients, summary, jobStatus }) {
  const sentCount    = recipients.filter(r => r._status === "sent").length;
  const failedCount  = recipients.filter(r => r._status === "failed").length;
  const pendingCount = recipients.filter(r => r._status === "pending").length;
  const progress     = recipients.length > 0 ? Math.round(((sentCount + failedCount) / recipients.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#14213D" }}>Sending Status</div>

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#8D9096" }}>
          <span>{jobStatus === "done" ? "Complete" : jobStatus === "stopped" ? "Stopped" : "Sending…"}</span>
          <span>{sentCount + failedCount} / {recipients.length}</span>
        </div>
        <div style={{ height: 6, background: "#E4E1E0", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", background: failedCount > 0 ? "#D83B01" : "#107C10",
            width: `${progress}%`, transition: "width .3s", borderRadius: 3 }} />
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: `${sentCount} sent`,    bg: "#DFF6DD", color: "#107C10" },
          { label: `${failedCount} failed`, bg: "#FDE7E9", color: "#D83B01" },
          { label: `${pendingCount} pending`, bg: "#F4F2F1", color: "#8D9096" },
        ].map(({ label, bg, color }) => (
          <span key={label} style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 2, background: bg, color }}>{label}</span>
        ))}
      </div>

      {summary && (
        <div style={{ padding: "10px 12px", background: summary.failed > 0 ? "#FDE7E9" : "#DFF6DD",
          borderRadius: 2, fontSize: 13, fontWeight: 600, color: summary.failed > 0 ? "#D83B01" : "#107C10" }}>
          {summary.failed > 0
            ? `Done with errors — ${summary.sent} sent, ${summary.failed} failed`
            : `All ${summary.sent} emails sent successfully!`}
        </div>
      )}

      {/* Scrollable log */}
      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #E4E1E0", borderRadius: 2, minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#EDEEF0", position: "sticky", top: 0 }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Company / Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EDEB",
                background: r._status === "failed" ? "#FFF8F8" : r._status === "sent" ? "#F8FFF8" : "transparent" }}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={{ ...tdStyle, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.company_name || r.name || "—"}
                </td>
                <td style={{ ...tdStyle, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8D9096" }}>
                  {r.email || "—"}
                </td>
                <td style={tdStyle}>
                  <div><StatusBadge status={r._status || "pending"} /></div>
                  {r._error && <div style={{ fontSize: 10, color: "#D83B01", marginTop: 2, maxWidth: 160, wordBreak: "break-word" }}>{r._error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SMTP_DEFAULTS = {
  email: "internship@iitg.ac.in", password: "", fromName: "Centre for Career Development",
  defaultCc: "fc2ccd@iitg.ac.in, cdo.ccd@iitg.ac.in", delayMs: "600", testTo: "",
};

export default function MailSenderPage() {
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [authChecked,  setAuthChecked]  = useState(false);

  const [smtpCfg,      setSmtpCfg]      = useState(SMTP_DEFAULTS);
  const [recipients,   setRecipients]   = useState([]);
  const [columns,      setColumns]      = useState([]);
  const [subject,      setSubject]      = useState(DEFAULT_SUBJECT);
  const [editorState,  setEditorState]  = useState(EditorState.createEmpty());

  const [rightTab,     setRightTab]     = useState("preview"); // "preview" | "status"
  const [jobId,        setJobId]        = useState(null);
  const [jobStatus,    setJobStatus]    = useState(null); // null | "running" | "done" | "stopped" | "error"
  const [summary,      setSummary]      = useState(null);
  const [sending,      setSending]      = useState(false);
  const esRef = useRef(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) { setAuthChecked(true); return; }
    fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.role === "admin") setIsAdmin(true); setAuthChecked(true); })
      .catch(() => setAuthChecked(true));
  }, []);

  const handleRecipientLoad = useCallback((rows) => {
    const cols = rows.length > 0 ? Object.keys(rows[0]).filter(k => !k.startsWith("_")) : [];
    setColumns(cols);
    setRecipients(rows.map(r => ({ ...r, _status: "pending", _error: null })));
    setSummary(null); setJobStatus(null); setJobId(null);
  }, []);

  const startSending = async () => {
    if (!smtpCfg.email || !smtpCfg.password) { alert("Configure SMTP email and password first."); return; }
    if (recipients.length === 0) { alert("Load recipients first."); return; }

    const htmlBody = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    if (!htmlBody.replace(/<[^>]+>/g, "").trim()) { alert("Email body is empty."); return; }

    setSending(true); setRightTab("status"); setSummary(null);
    setRecipients(prev => prev.map(r => ({ ...r, _status: "pending", _error: null })));

    try {
      const r = await authFetch(`${API}/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpEmail: smtpCfg.email, smtpPassword: smtpCfg.password,
          fromName: smtpCfg.fromName, defaultCc: smtpCfg.defaultCc,
          delayMs: parseInt(smtpCfg.delayMs) || 600,
          subject, htmlBody,
          recipients: recipients.map(({ _status, _error, ...rest }) => rest),
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.message || "Failed to start"); setSending(false); return; }

      setJobId(d.jobId); setJobStatus("running");
      connectSSE(d.jobId);
    } catch { alert("Network error"); setSending(false); }
  };

  const connectSSE = (jid) => {
    if (esRef.current) esRef.current.close();
    const token = localStorage.getItem("jwt_token");
    const es = new EventSource(`${API}/mail/progress/${jid}?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "snapshot") {
        setJobStatus(data.jobStatus);
        setRecipients(prev => prev.map((r, i) => ({ ...r, _status: data.rows[i]?._status || "pending", _error: data.rows[i]?._error || null })));
        if (data.summary) setSummary(data.summary);
        return;
      }

      if (data.type === "update") {
        setRecipients(prev => prev.map((r, i) =>
          i === data.index ? { ...r, _status: data.status, _error: data.error || null } : r
        ));
        return;
      }

      if (data.type === "done" || data.type === "stopped") {
        setSummary(data);
        setJobStatus(data.type === "done" ? "done" : "stopped");
        setSending(false);
        es.close();
        return;
      }

      if (data.type === "error") {
        alert("SMTP error: " + data.message);
        setJobStatus("error");
        setSending(false);
        es.close();
      }
    };

    es.onerror = () => { setSending(false); es.close(); };
  };

  const stopSending = async () => {
    if (!jobId) return;
    await authFetch(`${API}/mail/stop/${jobId}`, { method: "POST" });
    setJobStatus("stopped");
    setSending(false);
    if (esRef.current) esRef.current.close();
  };

  const resetJob = () => {
    setJobId(null); setJobStatus(null); setSummary(null); setSending(false);
    setRecipients(prev => prev.map(r => ({ ...r, _status: "pending", _error: null })));
    setRightTab("preview");
  };

  if (!authChecked) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
      fontFamily: "Inter, sans-serif", color: "#8D9096" }}>Loading…</div>
  );

  if (!isAdmin) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh",
      fontFamily: "Inter, sans-serif", gap: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#14213D" }}>Access denied</div>
      <div style={{ fontSize: 13, color: "#8D9096" }}>This page is for CCD admins only.</div>
      <a href="/dday/login" style={{ fontSize: 13, color: "#14213D", fontWeight: 600 }}>Go to Login →</a>
    </div>
  );

  const canSend = smtpCfg.email && smtpCfg.password && recipients.length > 0 && !sending;
  const sentCount   = recipients.filter(r => r._status === "sent").length;
  const failedCount = recipients.filter(r => r._status === "failed").length;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F2F1",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ background: "#14213D", padding: "0 24px", height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>CCD · IIT Guwahati</span>
          <span style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)",
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Mail Sender
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/dday/s" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textDecoration: "none" }}>Share ←</a>
          <a href="/dday/login" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textDecoration: "none" }}>Portal →</a>
        </div>
      </header>

      {/* SMTP config */}
      <SmtpConfig cfg={smtpCfg} onChange={setSmtpCfg} />

      {/* Three-panel main area */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr 340px",
        gap: 0, overflow: "hidden", minHeight: 0 }}>

        {/* Left: Recipients */}
        <div style={{ padding: "16px", borderRight: "1px solid #E4E1E0", overflowY: "auto", background: "#fff" }}>
          <RecipientsPanel recipients={recipients} columns={columns} onLoad={handleRecipientLoad} />
        </div>

        {/* Middle: Compose */}
        <div style={{ padding: "16px", overflowY: "auto", background: "#FAFAF9", borderRight: "1px solid #E4E1E0" }}>
          <ComposePanel
            subject={subject} onSubjectChange={setSubject}
            editorState={editorState} onEditorChange={setEditorState}
            columns={columns}
          />
        </div>

        {/* Right: Preview / Status */}
        <div style={{ display: "flex", flexDirection: "column", background: "#fff", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #E4E1E0", flexShrink: 0 }}>
            {[{ id: "preview", label: "Preview" }, { id: "status", label: `Status${sending || jobStatus ? ` (${sentCount + failedCount}/${recipients.length})` : ""}` }].map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)}
                style={{ flex: 1, height: 40, fontSize: 12, fontWeight: 600, background: "transparent",
                  border: "none", borderBottom: `2px solid ${rightTab === t.id ? "#14213D" : "transparent"}`,
                  color: rightTab === t.id ? "#14213D" : "#8D9096", cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, padding: "14px", overflow: "hidden" }}>
            {rightTab === "preview"
              ? <PreviewPanel recipients={recipients} editorState={editorState} subject={subject} smtpConfig={smtpCfg} />
              : <StatusPanel recipients={recipients} summary={summary} jobStatus={jobStatus} />
            }
          </div>
        </div>
      </div>

      {/* Bottom send bar */}
      <div style={{ flexShrink: 0, background: "#fff", borderTop: "2px solid #E4E1E0",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        {!sending && !jobStatus && (
          <button onClick={startSending} disabled={!canSend}
            style={{ height: 38, padding: "0 28px", fontSize: 14, fontWeight: 700,
              background: canSend ? "#14213D" : "#8D9096", color: "#fff", border: "none", borderRadius: 2,
              cursor: canSend ? "pointer" : "default", transition: "background .15s" }}
            onMouseEnter={e => canSend && (e.currentTarget.style.background = "#1C2C4F")}
            onMouseLeave={e => canSend && (e.currentTarget.style.background = "#14213D")}>
            Send to {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
          </button>
        )}

        {sending && (
          <>
            <div style={{ fontSize: 13, color: "#8D9096", fontWeight: 600 }}>
              Sending… {sentCount + failedCount}/{recipients.length}
            </div>
            <button onClick={stopSending}
              style={{ height: 34, padding: "0 18px", fontSize: 13, fontWeight: 600,
                background: "#D83B01", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer" }}>
              Stop
            </button>
          </>
        )}

        {!sending && (jobStatus === "done" || jobStatus === "stopped") && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: jobStatus === "done" && failedCount === 0 ? "#107C10" : "#D83B01" }}>
              {jobStatus === "done" ? `Done — ${sentCount} sent` + (failedCount ? `, ${failedCount} failed` : "") : `Stopped — ${sentCount} sent`}
            </div>
            <button onClick={resetJob}
              style={{ height: 34, padding: "0 18px", fontSize: 13, fontWeight: 600,
                background: "#F4F2F1", color: "#14213D", border: "1px solid #D0CCC9", borderRadius: 2, cursor: "pointer" }}>
              Send again
            </button>
          </>
        )}

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#ABADB3" }}>
          {smtpCfg.email || "No SMTP configured"} · {parseInt(smtpCfg.delayMs) || 600}ms delay
        </div>
      </div>
    </div>
  );
}
