import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getPlacementStatsByRoll } from "../controllers/placement-stats.controller.js";

const router = express.Router();

router.get("/placement-stats/:rollNumber", authMiddleware, permit("viewer", "admin"), getPlacementStatsByRoll);

export default router;
