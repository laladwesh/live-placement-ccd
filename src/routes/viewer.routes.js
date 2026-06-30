import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getConfirmedForViewer, getStudentDetailsForViewer, getSeasonsForViewer } from "../controllers/viewer.controller.js";

const router = express.Router();

// Protected: viewer (and admin/official) can access
router.get('/confirmed', authMiddleware, permit('viewer', 'admin'), getConfirmedForViewer);
router.get('/seasons',   authMiddleware, permit('viewer', 'admin'), getSeasonsForViewer);
router.get('/student/:studentId/details', authMiddleware, permit('viewer', 'admin'), getStudentDetailsForViewer);

export default router;
