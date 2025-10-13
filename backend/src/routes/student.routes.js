// src/routes/student.routes.js
import express from "express";
import * as studentController from "../controllers/student.controller.js";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require authentication and student role (or admin/superadmin)
router.use(authMiddleware);
router.use(permit("student", "admin", "superadmin"));

// GET /api/student/shortlists - Get all shortlists for logged-in student
router.get("/shortlists", studentController.getMyShortlists);

// GET /api/student/shortlists/:shortlistId - Get detailed info about a shortlist
router.get("/shortlists/:shortlistId", studentController.getShortlistDetails);

// GET /api/student/offers - Get all offers for logged-in student
router.get("/offers", studentController.getMyOffers);

// GET /api/student/profile - Get student's own profile
router.get("/profile", studentController.getMyProfile);

export default router;
