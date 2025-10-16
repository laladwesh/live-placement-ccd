// backend/src/middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";

/**
 * authMiddleware
 * Expects Authorization: Bearer <token>
 * Verifies token and attaches user document to req.user
 */
export const authMiddleware = async (req, res, next) => {
  try {
    console.log("🔑 AUTH CHECK:", req.method, req.path);
    
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("   ❌ No Bearer token");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub) {
      console.log("   ❌ Invalid token payload");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      console.log("   ❌ User not found:", payload.sub);
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("   ✅ User authenticated:", user.emailId, "| Role:", user.role);
    req.user = user;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err?.message || err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * permit(...allowedRoles)
 * Usage: router.get("/admin", authMiddleware, permit("admin"), handler)
 */
export const permit = (...allowedRoles) => (req, res, next) => {
  try {
    console.log("🔒 PERMIT CHECK:");
    console.log("   Path:", req.path);
    console.log("   Method:", req.method);
    console.log("   User:", req.user ? req.user.emailId : "NO USER");
    console.log("   User Role:", req.user ? req.user.role : "NO ROLE");
    console.log("   Allowed Roles:", allowedRoles);
    
    if (!req.user) {
      console.log("   ❌ REJECTED: No user attached");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      console.log("   ❌ FORBIDDEN: User role not in allowed roles");
      return res.status(403).json({ message: "Forbidden" });
    }
    
    console.log("   ✅ ALLOWED");
    next();
  } catch (err) {
    console.error("permit error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
};
