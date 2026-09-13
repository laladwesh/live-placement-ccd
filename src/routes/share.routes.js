import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";
import SharedFile from "../models/shared-file.model.js";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";

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

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

const router = express.Router();

const generateShareUrl = async (originalName) => {
  const base = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/--+/g, "-")
    .toLowerCase()
    .substring(0, 50);
  let url = base;
  let n = 1;
  while (await SharedFile.findOne({ shareUrl: url })) {
    url = `${base}-${n++}`;
  }
  return url;
};

// ── Public routes (no auth) ───────────────────────────────────────────────────

// List permanently shared files
router.get("/public", async (req, res) => {
  try {
    const files = await SharedFile.find({ isPermanent: true })
      .select("originalName shareUrl fileSize mimeType createdAt downloadCount")
      .sort({ createdAt: -1 });
    res.json(files);
  } catch {
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

// Download a shared file by shareUrl slug
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
  } catch {
    res.status(500).json({ message: "Failed to download file" });
  }
});

// ── Admin routes (auth + admin role required) ─────────────────────────────────

// List all files (permanent + temporary, filter expired)
router.get("/files", authMiddleware, permit("admin"), async (req, res) => {
  try {
    const { search, permanent } = req.query;
    const query = {};
    if (search) query.originalName = { $regex: search, $options: "i" };
    if (permanent !== undefined) query.isPermanent = permanent === "true";

    const files = await SharedFile.find(query).sort({ createdAt: -1 });
    const valid = files.filter(f => f.isPermanent || new Date() < new Date(f.expiresAt));
    res.json(valid);
  } catch {
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

// Upload a file
router.post("/upload", authMiddleware, permit("admin"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  try {
    const permanent = req.body.isPermanent === "true" || req.body.isPermanent === true;
    const expiresAt = permanent ? null : new Date(Date.now() + 15 * 60 * 1000);
    const shareUrl = await generateShareUrl(req.file.originalname);

    const doc = await SharedFile.create({
      originalName:  req.file.originalname,
      fileName:      req.file.filename,
      fileSize:      req.file.size,
      mimeType:      req.file.mimetype,
      isPermanent:   permanent,
      expiresAt,
      shareUrl,
      uploadedBy:    req.user?.emailId || "admin",
    });

    res.status(201).json({ message: "Uploaded", file: doc });
  } catch {
    // clean up disk file on DB error
    fs.existsSync(path.join(UPLOAD_DIR, req.file.filename)) &&
      fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename));
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete a file
router.delete("/files/:id", authMiddleware, permit("admin"), async (req, res) => {
  try {
    const file = await SharedFile.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    const filePath = path.join(UPLOAD_DIR, file.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await SharedFile.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
