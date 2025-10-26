import express from "express";
import multer from "multer";
import { 
  createUser, 
  getPendingOffers, 
  getConfirmedOffers, 
  approveOffer, 
  rejectOffer 
} from "../controllers/admin.controller.js";
import {
  uploadStudentsCSV,
  getAllStudents,
  addStudentManually
} from "../controllers/student-upload.controller.js";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";

// Multer configuration for file upload (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

// Admin creates users — only admins
router.post("/users", authMiddleware, permit("admin"), createUser);

// Student CSV upload
router.post("/students/upload", authMiddleware, permit("admin"), upload.single("file"), uploadStudentsCSV);
router.get("/students", authMiddleware, permit("admin"), getAllStudents);
router.post("/students", authMiddleware, permit("admin"), addStudentManually);

// Offer approval routes
router.get("/offers/pending", authMiddleware, permit("admin"), getPendingOffers);
router.get("/offers/confirmed", authMiddleware, permit("admin"), getConfirmedOffers);
router.post("/offers/:offerId/approve", authMiddleware, permit("admin"), approveOffer);
router.post("/offers/:offerId/reject", authMiddleware, permit("admin"), rejectOffer);

export default router;
