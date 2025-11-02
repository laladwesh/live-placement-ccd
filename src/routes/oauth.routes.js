import express from "express";
import {
  oauthLoginRedirect,
  oauthCallback,
  oauthLogout
} from "../controllers/oauth.controller.js";

const router = express.Router();

// Provider param must be 'azure' or 'google'
router.get("/:provider/login", (req, res) => oauthLoginRedirect(req, res));
router.get("/:provider/callback", (req, res) => oauthCallback(req, res));
router.get("/:provider/logout", oauthLogout);

export default router;
