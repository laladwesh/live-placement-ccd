import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getInternStats, getInternStatsByRoll } from "../controllers/intern-stats.controller.js";

const router = express.Router();

router.get("/intern-stats", authMiddleware, permit("viewer", "admin"), getInternStats);
router.get("/intern-stats/:rollNumber", authMiddleware, permit("viewer", "admin"), getInternStatsByRoll);

export default router;
