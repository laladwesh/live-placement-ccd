// backend/src/routes/company.routes.js
import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getAllPOCs
} from "../controllers/company.controller.js";
import {
  uploadShortlistCSV,
  addStudentToShortlist,
  getCompanyShortlist,
  removeStudentFromShortlist,
  uploadMiddleware
} from "../controllers/shortlist.controller.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(permit("admin"));

// Company CRUD
router.post("/companies", createCompany);
router.get("/companies", getAllCompanies);
router.get("/companies/:id", getCompanyById);
router.patch("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);

// Shortlist management
router.post("/companies/:companyId/shortlist/upload", uploadMiddleware, uploadShortlistCSV);
router.post("/companies/:companyId/shortlist", addStudentToShortlist);
router.get("/companies/:companyId/shortlist", getCompanyShortlist);
router.delete("/companies/:companyId/shortlist/:shortlistId", removeStudentFromShortlist);

// Get all POCs for assignment
router.get("/pocs", getAllPOCs);

export default router;
