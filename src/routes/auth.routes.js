import express from "express";
import { login, ssoLogin } from "../controllers/auth.controller.js";
import oauthRouter from "./oauth.routes.js";

const router = express.Router();

// Only login (no public register)
router.post("/login", login);

// OAuth routes for Azure & Google
router.use("/oauth", oauthRouter);

// SSO handoff from the Placement Portal — signed-token verified, not session-gated
router.get("/sso", ssoLogin);

export default router;
