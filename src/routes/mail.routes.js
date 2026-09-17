import express from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname_  = dirname(fileURLToPath(import.meta.url));

// Logo path — works in both dev (client/src/assets) and production (src/assets copied by Dockerfile)
const LOGO_PATH = (() => {
  const candidates = [
    join(__dirname_, "../assets/iitg_logo.png"),                       // production
    join(__dirname_, "../../client/src/assets/iitg_logo.png"),         // dev
  ];
  return candidates.find(p => existsSync(p)) || null;
})();

const JWT_SECRET = process.env.JWT_SECRET || "ccd-dev-secret";

function shareMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ message: "Authentication required" });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.role !== "share" && decoded.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

const router = express.Router();

const mailJobs = new Map();

function makeId() { return crypto.randomBytes(8).toString("hex"); }

function substituteVars(template, row) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? "";
    return String(val);
  });
}

function broadcast(job, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  job.clients.forEach(c => { try { c.write(payload); } catch {} });
}

// Determine portal URL from sender address
function getPortalUrl(fromEmail) {
  const e = (fromEmail || "").toLowerCase();
  if (e.includes("placement@iitg.ac.in"))   return "https://iitg.ac.in/placements/auth/login/recruiter";
  if (e.includes("internship@iitg.ac.in"))  return "https://iitg.ac.in/intern/auth/login/recruiter";
  return "https://iitg.ac.in/dday/login";
}

// CCD footer HTML — logo embedded via CID attachment
function buildFooterHtml(fromEmail) {
  const portalUrl = getPortalUrl(fromEmail);
  const logoTag = LOGO_PATH
    ? `<img src="cid:iitg_logo" width="56" height="56" alt="IIT Guwahati" style="display:block;">`
    : "";
  return `
<br>
<hr style="border:none;border-top:1px solid #cccccc;margin:24px 0 14px 0;">
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;line-height:1.7;">
  <tr>
    ${LOGO_PATH ? `<td style="padding-right:14px;vertical-align:middle;">${logoTag}</td>` : ""}
    <td style="vertical-align:middle;">
      Visit us at <a href="https://www.iitg.ac.in/ccd" style="color:#6b21a8;text-decoration:none;">www.iitg.ac.in/ccd</a><br>
      <a href="https://www.linkedin.com/school/iit-guwahati/" style="color:#6b21a8;text-decoration:none;">LinkedIn</a>
      &nbsp;|&nbsp;
      <a href="${portalUrl}" style="color:#6b21a8;text-decoration:none;">Portal</a><br>
      <strong>Centre for Career Development</strong><br>
      IIT Guwahati
    </td>
  </tr>
</table>`;
}

// Nodemailer attachment for the logo (if available)
function logoAttachment() {
  if (!LOGO_PATH) return [];
  return [{ filename: "iitg_logo.png", path: LOGO_PATH, cid: "iitg_logo" }];
}

// POST /mail/send
router.post("/send", shareMiddleware, async (req, res) => {
  const { smtpEmail, smtpPassword, fromName, defaultCc, subject, htmlBody, recipients, delayMs = 600 } = req.body;

  if (!smtpEmail || !smtpPassword)
    return res.status(400).json({ message: "SMTP email and password are required" });
  if (!subject || !htmlBody)
    return res.status(400).json({ message: "Subject and email body are required" });
  if (!Array.isArray(recipients) || recipients.length === 0)
    return res.status(400).json({ message: "No recipients provided" });

  const footer = buildFooterHtml(smtpEmail);
  const attachments = logoAttachment();

  const jobId = makeId();
  const jobRows = recipients.map(r => ({ ...r, _status: "pending", _error: null }));
  const job = { status: "running", rows: jobRows, clients: [], summary: null };
  mailJobs.set(jobId, job);

  res.json({ jobId, total: jobRows.length });

  (async () => {
    let sent = 0, failed = 0, skipped = 0;
    let transporter;

    try {
      transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: { user: smtpEmail, pass: smtpPassword },
        tls: { ciphers: "SSLv3" },
      });
      await transporter.verify();
    } catch (err) {
      job.status = "error";
      broadcast(job, { type: "error", message: `SMTP connection failed: ${err.message}` });
      return;
    }

    const ccBase = (defaultCc || "").split(",").map(e => e.trim()).filter(Boolean);

    for (let i = 0; i < jobRows.length; i++) {
      if (job.status === "stopped") {
        broadcast(job, { type: "stopped", sent, failed, skipped });
        break;
      }

      const row = jobRows[i];
      const email = (row.email || row.Email || row.EMAIL || "").trim();

      if (!email) {
        row._status = "skipped";
        skipped++;
        broadcast(job, { type: "update", index: i, status: "skipped" });
        continue;
      }

      try {
        const resolvedSubject = substituteVars(subject, row);
        const resolvedBody    = substituteVars(htmlBody, row) + footer;

        const rowCc = (row.cc || row.CC || "").split(",").map(e => e.trim()).filter(Boolean);
        const allCc = [...new Set([...ccBase, ...rowCc])];

        await transporter.sendMail({
          from: `"${fromName || "Centre for Career Development"}" <${smtpEmail}>`,
          to: email,
          subject: resolvedSubject,
          html: resolvedBody,
          attachments,
          ...(allCc.length && { cc: allCc.join(", ") }),
        });

        row._status = "sent";
        sent++;
        broadcast(job, { type: "update", index: i, status: "sent" });
      } catch (err) {
        row._status = "failed";
        row._error  = err.message;
        failed++;
        broadcast(job, { type: "update", index: i, status: "failed", error: err.message });
      }

      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    if (job.status === "running") {
      job.status  = "done";
      job.summary = { sent, failed, skipped, total: jobRows.length };
      broadcast(job, { type: "done", ...job.summary });
    }

    setTimeout(() => mailJobs.delete(jobId), 30 * 60 * 1000);
  })();
});

// GET /mail/progress/:jobId — SSE
router.get("/progress/:jobId", (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, shareMiddleware, (req, res) => {
  const job = mailJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "snapshot", rows: job.rows, jobStatus: job.status, summary: job.summary })}\n\n`);

  if (job.status === "done" || job.status === "stopped" || job.status === "error") {
    res.end();
    return;
  }

  job.clients.push(res);
  req.on("close", () => {
    job.clients = job.clients.filter(c => c !== res);
  });
});

// POST /mail/stop/:jobId
router.post("/stop/:jobId", shareMiddleware, (req, res) => {
  const job = mailJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Job not found" });
  job.status = "stopped";
  res.json({ message: "Job will stop after current email" });
});

// POST /mail/test
router.post("/test", shareMiddleware, async (req, res) => {
  const { smtpEmail, smtpPassword, fromName, toEmail, subject, htmlBody } = req.body;
  if (!smtpEmail || !smtpPassword || !toEmail)
    return res.status(400).json({ message: "smtpEmail, smtpPassword and toEmail are required" });

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com", port: 587, secure: false,
      auth: { user: smtpEmail, pass: smtpPassword },
      tls: { ciphers: "SSLv3" },
    });
    const footer = buildFooterHtml(smtpEmail);
    await transporter.sendMail({
      from: `"${fromName || "CCD IITG"}" <${smtpEmail}>`,
      to: toEmail,
      subject: subject || "(Test) " + new Date().toLocaleTimeString(),
      html: (htmlBody || "<p>This is a test email from the CCD Mail Sender.</p>") + footer,
      attachments: logoAttachment(),
    });
    res.json({ message: "Test email sent" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send test email", error: err.message });
  }
});

export default router;
