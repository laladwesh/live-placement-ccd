import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getInternMasterData, updateInternPlacement } from "../controllers/intern-master.controller.js";

const router = express.Router();

router.get("/intern-master", authMiddleware, permit("viewer", "admin"), getInternMasterData);
router.patch("/intern-master/:id/placement", authMiddleware, permit("admin"), updateInternPlacement);

export default router;
