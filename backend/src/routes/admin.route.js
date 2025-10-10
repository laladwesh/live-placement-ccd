import express from "express";
import { createUser } from "../controllers/admin.controller.js";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";

const router = express.Router();

// Admin creates users — only admins/superadmin
router.post("/users", authMiddleware, permit("admin", "superadmin"), createUser);

export default router;
