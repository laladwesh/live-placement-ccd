import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const COOKIE_NAME = process.env.COOKIE_NAME || "placement_token";
const COOKIE_MAX_AGE = parseInt(process.env.COOKIE_MAX_AGE || "3600000", 10);
const SYNC_KEY = process.env.DDAY_SYNC_KEY || "";
const FRONTEND_ROOT = process.env.FRONTEND_ROOT || "http://localhost:3000";

export const login = async (req, res) => {
  try {
    const { emailId, password } = req.body;
    if (!emailId || !password) return res.status(400).json({ message: "Missing fields" });

    const user = await User.findOne({ emailId: emailId });
    if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isAllowed) return res.status(403).json({ message: "Account not allowed to sign in" });

    const payload = { sub: user._id.toString(), role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // --- return token in JSON instead of cookie
    return res.json({
      token,
      user: { id: user._id, name: user.name, emailId: user.emailId, role: user.role }
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/sso?token=...
// Handoff endpoint for the Placement Portal: a coordinator already logged in
// there can land here already-authenticated, without re-entering credentials.
// The incoming token only vouches for the email — it is NEVER trusted for role
// or authorization. DDay always decides access from its own User record (role,
// isAllowed), exactly like the local-login and OAuth paths above.
export const ssoLogin = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${FRONTEND_ROOT}/login?ssoError=missing_token`);
    if (!SYNC_KEY) {
      logger.error("DDAY_SYNC_KEY is not configured — cannot verify SSO handoff token");
      return res.redirect(`${FRONTEND_ROOT}/login?ssoError=server_config`);
    }

    let payload;
    try {
      payload = jwt.verify(token, SYNC_KEY);
      if (payload.purpose !== "placement-sso") throw new Error("unexpected token purpose");
    } catch (err) {
      logger.warn("SSO handoff token rejected", { message: err.message });
      return res.redirect(`${FRONTEND_ROOT}/login?ssoError=invalid_token`);
    }

    const email = String(payload.email || "").toLowerCase();
    if (!email) return res.redirect(`${FRONTEND_ROOT}/login?ssoError=invalid_token`);

    const user = await User.findOne({ emailId: email });
    if (!user || !user.isAllowed) {
      logger.info("SSO handoff attempt for unknown/disallowed user", { email });
      return res.redirect(`${FRONTEND_ROOT}/login?ssoError=not_authorized`);
    }

    const realPayload = { sub: user._id.toString(), role: user.role };
    const realToken = jwt.sign(realPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const redirectUrl = `${FRONTEND_ROOT}/auth/callback#token=${encodeURIComponent(realToken)}&provider=sso`;
    return res.redirect(redirectUrl);
  } catch (err) {
    logger.error("ssoLogin error", err);
    return res.redirect(`${FRONTEND_ROOT}/login?ssoError=server_error`);
  }
};