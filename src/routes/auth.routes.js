import express from "express";
import { login } from "../controllers/auth.controller.js";
import oauthRouter from "./oauth.routes.js";

const router = express.Router();

// Only login (no public register)
router.post("/login", login);

// OAuth routes for Azure & Google
router.use("/oauth", oauthRouter);

export default router;
