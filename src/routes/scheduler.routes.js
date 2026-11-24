// src/routes/scheduler.routes.js
import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import {
  getSchedulerCompanies,
  getSchedulerShortlist,
  reorderShortlist,
} from "../controllers/scheduler.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(permit("scheduler", "admin"));

router.get("/companies",                        getSchedulerCompanies);
router.get("/companies/:companyId/shortlist",   getSchedulerShortlist);
router.patch("/companies/:companyId/reorder",   reorderShortlist);

export default router;
