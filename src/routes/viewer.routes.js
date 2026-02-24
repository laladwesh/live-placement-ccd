import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getConfirmedForViewer } from "../controllers/viewer.controller.js";

const router = express.Router();

// Protected: viewer (and admin/official) can access
router.get('/confirmed', authMiddleware, permit('viewer', 'admin'), getConfirmedForViewer);

export default router;
