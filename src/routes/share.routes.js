import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { PDFDocument } from "pdf-lib";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import XLSX from "xlsx";
import axios from "axios";
import SharedFile from "../models/shared-file.model.js";
import Student from "../models/student.model.js";
import User from "../models/user.model.js";
import Company from "../models/company.model.js";

const SHARE_PASSWORD = process.env.SHARE_PASSWORD || "awie";
const JWT_SECRET = process.env.JWT_SECRET || "ccd-dev-secret";

// Accepts share token (role:"share") OR admin JWT (role:"admin")
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "shared-files");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateShareUrl = async (originalName) => {
  const base = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "-").replace(/--+/g, "-").toLowerCase().substring(0, 50);
  let url = base, n = 1;
  while (await SharedFile.findOne({ shareUrl: url })) url = `${base}-${n++}`;
  return url;
};

const saveTempFile = async (fileName, originalName, fileSize, mimeType, uploaderEmail) => {
  const shareUrl = await generateShareUrl(originalName);
  return SharedFile.create({
    originalName, fileName, fileSize, mimeType,
    isPermanent: false, expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    shareUrl, uploadedBy: uploaderEmail || "admin",
  });
};

const cleanupFiles = (...paths) => {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
};

const cleanupDir = (dir) => {
  try { if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true }); } catch {}
};

// ── Share login (no auth required) ───────────────────────────────────────────

router.post("/login", (req, res) => {
  if (!req.body?.password || req.body.password !== SHARE_PASSWORD)
    return res.status(401).json({ message: "Incorrect password" });
  const token = jwt.sign({ role: "share", sub: "share-access" }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
});

// ── Public routes (no auth) ───────────────────────────────────────────────────

router.get("/public", async (req, res) => {
  try {
    const files = await SharedFile.find({ isPermanent: true })
      .select("originalName shareUrl fileSize mimeType createdAt downloadCount")
      .sort({ createdAt: -1 });
    res.json(files);
  } catch { res.status(500).json({ message: "Failed to fetch files" }); }
});

router.get("/file/:shareUrl", async (req, res) => {
  try {
    const file = await SharedFile.findOne({ shareUrl: req.params.shareUrl });
    if (!file) return res.status(404).json({ message: "File not found" });
    if (!file.isPermanent && new Date() > new Date(file.expiresAt))
      return res.status(410).json({ message: "File has expired" });
    const filePath = path.join(UPLOAD_DIR, file.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on disk" });
    file.downloadCount += 1;
    await file.save();
    res.download(filePath, file.originalName);
  } catch { res.status(500).json({ message: "Failed to download file" }); }
});

// ── Admin: file management ────────────────────────────────────────────────────

router.get("/files", shareMiddleware, async (req, res) => {
  try {
    const { search, permanent } = req.query;
    const query = {};
    if (search) query.originalName = { $regex: search, $options: "i" };
    if (permanent !== undefined) query.isPermanent = permanent === "true";
    const files = await SharedFile.find(query).sort({ createdAt: -1 });
    const valid = files.filter(f => f.isPermanent || new Date() < new Date(f.expiresAt));
    res.json(valid);
  } catch { res.status(500).json({ message: "Failed to fetch files" }); }
});

router.post("/upload", shareMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  try {
    const permanent = req.body.isPermanent === "true" || req.body.isPermanent === true;
    const shareUrl = await generateShareUrl(req.file.originalname);
    const doc = await SharedFile.create({
      originalName: req.file.originalname, fileName: req.file.filename,
      fileSize: req.file.size, mimeType: req.file.mimetype,
      isPermanent: permanent,
      expiresAt: permanent ? null : new Date(Date.now() + 15 * 60 * 1000),
      shareUrl, uploadedBy: req.user?.emailId || "admin",
    });
    res.status(201).json({ message: "Uploaded", file: doc });
  } catch {
    cleanupFiles(path.join(UPLOAD_DIR, req.file.filename));
    res.status(500).json({ message: "Upload failed" });
  }
});

router.delete("/files/:id", shareMiddleware, async (req, res) => {
  try {
    const file = await SharedFile.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    cleanupFiles(path.join(UPLOAD_DIR, file.fileName));
    await SharedFile.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch { res.status(500).json({ message: "Delete failed" }); }
});

// Make a temp file permanent
router.patch("/files/:id/permanent", shareMiddleware, async (req, res) => {
  try {
    const file = await SharedFile.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    file.isPermanent = true;
    file.expiresAt = undefined;
    await file.save();
    res.json({ message: "File is now permanent", file });
  } catch { res.status(500).json({ message: "Failed to update" }); }
});

// ── Tools ─────────────────────────────────────────────────────────────────────

// 1. Compress Image
router.post("/tools/compress-image", shareMiddleware, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image uploaded" });
  const inputPath = req.file.path;
  try {
    const { default: sharp } = await import("sharp");
    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 75));
    const format = req.body.format || "jpeg"; // jpeg | webp | png
    const ext = format === "png" ? ".png" : format === "webp" ? ".webp" : ".jpg";
    const outName = `compressed-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const outPath = path.join(UPLOAD_DIR, outName);

    let pipeline = sharp(inputPath);
    if (format === "jpeg") pipeline = pipeline.jpeg({ quality });
    else if (format === "webp") pipeline = pipeline.webp({ quality });
    else pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) });
    await pipeline.toFile(outPath);

    cleanupFiles(inputPath);
    const stats = fs.statSync(outPath);
    const originalName = `compressed-${req.file.originalname.replace(/\.[^.]+$/, "")}${ext}`;
    const doc = await saveTempFile(outName, originalName, stats.size, `image/${format}`, req.user?.emailId);
    res.json({ file: doc, originalSize: req.file.size, compressedSize: stats.size,
      reduction: ((1 - stats.size / req.file.size) * 100).toFixed(1) + "%" });
  } catch (err) {
    cleanupFiles(inputPath);
    res.status(500).json({ message: "Compression failed", error: err.message });
  }
});

// 2. Merge PDFs
router.post("/tools/merge-pdfs", shareMiddleware, upload.array("pdfs", 20), async (req, res) => {
  if (!req.files || req.files.length < 2)
    return res.status(400).json({ message: "Upload at least 2 PDF files" });
  const paths = req.files.map(f => f.path);
  try {
    const merged = await PDFDocument.create();
    for (const p of paths) {
      const bytes = fs.readFileSync(p);
      const pdf = await PDFDocument.load(bytes);
      const copied = await merged.copyPages(pdf, pdf.getPageIndices());
      copied.forEach(pg => merged.addPage(pg));
    }
    const outName = `merged-${Date.now()}.pdf`;
    const outPath = path.join(UPLOAD_DIR, outName);
    fs.writeFileSync(outPath, await merged.save());
    cleanupFiles(...paths);
    const stats = fs.statSync(outPath);
    const doc = await saveTempFile(outName, "merged.pdf", stats.size, "application/pdf", req.user?.emailId);
    res.json({ file: doc, pageCount: merged.getPageCount() });
  } catch (err) {
    cleanupFiles(...paths);
    res.status(500).json({ message: "PDF merge failed", error: err.message });
  }
});

// 3. Compress Files to ZIP
router.post("/tools/compress-files", shareMiddleware, upload.array("files", 30), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ message: "No files uploaded" });
  const outName = `archive-${Date.now()}.zip`;
  const outPath = path.join(UPLOAD_DIR, outName);
  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outPath);
      const arc = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      arc.on("error", reject);
      arc.pipe(output);
      req.files.forEach(f => arc.file(f.path, { name: f.originalname }));
      arc.finalize();
    });
    cleanupFiles(...req.files.map(f => f.path));
    const stats = fs.statSync(outPath);
    const doc = await saveTempFile(outName, "archive.zip", stats.size, "application/zip", req.user?.emailId);
    res.json({ file: doc, fileCount: req.files.length });
  } catch (err) {
    cleanupFiles(outPath, ...req.files.map(f => f.path));
    res.status(500).json({ message: "Compression failed", error: err.message });
  }
});

// 4. CV Downloader — reads Excel/CSV with a Resume/CV column, downloads each CV, returns ZIP
router.post("/tools/cv-downloader", shareMiddleware, upload.single("excel"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No Excel file uploaded" });
  const excelPath = req.file.path;
  const tempDir = path.join(UPLOAD_DIR, `cvs-${Date.now()}`);
  const outName = `cvs-${Date.now()}.zip`;
  const outPath = path.join(UPLOAD_DIR, outName);
  try {
    const wb = XLSX.readFile(excelPath);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    cleanupFiles(excelPath);
    if (!data.length) return res.status(400).json({ message: "Excel file is empty" });

    const cvCols = ["Resume", "resume", "CV", "cv", "Cv", "cv_url", "drive_Link", "portfolio_Link"];
    const col = cvCols.find(c => data[0].hasOwnProperty(c));
    if (!col) return res.status(400).json({ message: "No CV column found", availableColumns: Object.keys(data[0]) });

    const urls = data.map(r => r[col]).filter(u => u && typeof u === "string" && u.trim());
    if (!urls.length) return res.status(400).json({ message: "No CV URLs found" });

    fs.mkdirSync(tempDir, { recursive: true });

    const results = await Promise.all(urls.map(async (url, i) => {
      try {
        const resp = await axios({ method: "GET", url, responseType: "arraybuffer",
          timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } });
        let fn = url.split("/").pop().split("?")[0];
        if (!fn.includes(".")) fn = `cv-${i + 1}.pdf`;
        fn = fn.replace(/[^a-zA-Z0-9._-]/g, "_");
        fs.writeFileSync(path.join(tempDir, fn), resp.data);
        return { ok: true, fn };
      } catch (e) { return { ok: false, url, error: e.message }; }
    }));

    const success = results.filter(r => r.ok).length;
    if (!success) { cleanupDir(tempDir); return res.status(500).json({ message: "Failed to download any CVs" }); }

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(outPath);
      const arc = archiver("zip", { zlib: { level: 9 } });
      out.on("close", resolve); arc.on("error", reject);
      arc.pipe(out);
      fs.readdirSync(tempDir).forEach(f => arc.file(path.join(tempDir, f), { name: f }));
      arc.finalize();
    });
    cleanupDir(tempDir);
    const stats = fs.statSync(outPath);
    const doc = await saveTempFile(outName, "cvs.zip", stats.size, "application/zip", req.user?.emailId);
    res.json({ file: doc, success, failed: results.filter(r => !r.ok).map(r => r.url) });
  } catch (err) {
    cleanupFiles(excelPath, outPath); cleanupDir(tempDir);
    res.status(500).json({ message: "CV download failed", error: err.message });
  }
});

// 5. Export Placements as Excel — generates from DB
router.get("/tools/export-placements", shareMiddleware, async (req, res) => {
  try {
    const students = await Student.find({ isPlaced: true, placementYear: null })
      .populate("userId", "name emailId department programme cpi")
      .populate("placedCompany", "name venue");

    const rows = students.map((s, i) => ({
      "#": i + 1,
      "Roll Number": s.rollNumber || "",
      "Name": s.userId?.name || "",
      "Email": s.userId?.emailId || "",
      "Department": s.userId?.department || "",
      "Programme": s.userId?.programme || "",
      "CPI": s.userId?.cpi ?? "",
      "Company": s.placedCompany?.name || "",
      "Venue": s.placedCompany?.venue || "",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Placed Students");

    const outName = `placements-${Date.now()}.xlsx`;
    const outPath = path.join(UPLOAD_DIR, outName);
    XLSX.writeFile(wb, outPath);

    const stats = fs.statSync(outPath);
    const doc = await saveTempFile(outName, `placements-${new Date().toISOString().slice(0,10)}.xlsx`,
      stats.size, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", req.user?.emailId);
    res.json({ file: doc, count: rows.length });
  } catch (err) {
    res.status(500).json({ message: "Export failed", error: err.message });
  }
});

// 6. CSV ↔ Excel converter
router.post("/tools/convert-spreadsheet", shareMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const inputPath = req.file.path;
  const isCSV = req.file.originalname.toLowerCase().endsWith(".csv") || req.file.mimetype === "text/csv";
  try {
    const wb = XLSX.readFile(inputPath);
    let outName, outOriginal, outMime;
    if (isCSV) {
      // CSV → Excel
      outName = `${Date.now()}-converted.xlsx`;
      outOriginal = req.file.originalname.replace(/\.csv$/i, ".xlsx");
      outMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      // Excel → CSV
      outName = `${Date.now()}-converted.csv`;
      outOriginal = req.file.originalname.replace(/\.(xlsx?|ods)$/i, ".csv");
      outMime = "text/csv";
    }
    const outPath = path.join(UPLOAD_DIR, outName);
    XLSX.writeFile(wb, outPath, { bookType: isCSV ? "xlsx" : "csv" });
    cleanupFiles(inputPath);
    const stats = fs.statSync(outPath);
    const doc = await saveTempFile(outName, outOriginal, stats.size, outMime, req.user?.emailId);
    res.json({ file: doc });
  } catch (err) {
    cleanupFiles(inputPath);
    res.status(500).json({ message: "Conversion failed", error: err.message });
  }
});

// 7. Make any tool output permanent (save to shared files list)
router.patch("/tools/save/:id", shareMiddleware, async (req, res) => {
  try {
    const file = await SharedFile.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    file.isPermanent = true;
    file.expiresAt = undefined;
    await file.save();
    res.json({ message: "Saved to shared files", file });
  } catch { res.status(500).json({ message: "Failed" }); }
});

export default router;
