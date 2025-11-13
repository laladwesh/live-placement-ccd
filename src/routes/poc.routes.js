// backend/src/routes/poc.routes.js
import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import {
  getPOCCompanies,
  getPOCCompanyStudents,
  updateInterviewStage,
  updateShortlistStatus,
  createOffer,
  revertOffer,
  undoRejection,
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

// Update shortlist status (shortlisted/waitlisted)
router.patch("/shortlist/:shortlistId/status", updateShortlistStatus);

// Create offer for student
router.post("/shortlist/:shortlistId/offer", createOffer);

// Revert offer (undo)
router.delete("/shortlist/:shortlistId/offer", revertOffer);

// Undo rejection
router.patch("/shortlist/:shortlistId/undo-rejection", undoRejection);

// Add walk-in student
router.post("/companies/:companyId/walkin", addWalkInStudent);

// Mark company process as completed
router.post("/companies/:companyId/complete", markProcessCompleted);

export default router;
