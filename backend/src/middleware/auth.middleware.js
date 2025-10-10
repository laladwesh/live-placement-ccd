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
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch (err) {
    console.error("authMiddleware error:", err?.message || err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * permit(...allowedRoles)
 * Usage: router.get("/admin", authMiddleware, permit("admin","superadmin"), handler)
 */
export const permit = (...allowedRoles) => (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  } catch (err) {
    console.error("permit error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
};
