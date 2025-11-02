// backend/src/routes/poc.routes.js
import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import {
  getPOCCompanies,
  getPOCCompanyStudents,
  updateInterviewStage,
  createOffer,
  addWalkInStudent,
  markProcessCompleted
} from "../controllers/poc.controller.js";

const router = express.Router();

// All routes require authentication and POC/admin role
router.use(authMiddleware);
router.use(permit("poc", "admin"));

// Get POC's assigned companies
router.get("/companies", getPOCCompanies);

// Get students for a specific company
router.get("/companies/:companyId/students", getPOCCompanyStudents);

// Update interview stage
router.patch("/shortlist/:shortlistId/stage", updateInterviewStage);

// Create offer for student
router.post("/shortlist/:shortlistId/offer", createOffer);

// Add walk-in student
router.post("/companies/:companyId/walkin", addWalkInStudent);

// Mark company process as completed
router.post("/companies/:companyId/complete", markProcessCompleted);

export default router;
