// backend/src/controllers/oauth.controller.js
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  buildAzureAuthorizeUrl,
  exchangeAzureCodeForToken,
  getAzureProfile
} from "../utils/azure.client.js";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCodeForToken,
  getGoogleProfile
} from "../utils/google.client.js";
import User from "../models/user.model.js";
import { logger } from "../utils/logger.js";

const COOKIE_NAME = process.env.COOKIE_NAME || "placement_token";
const COOKIE_MAX_AGE = parseInt(process.env.COOKIE_MAX_AGE || "3600000", 10);
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const FRONTEND_ROOT = process.env.FRONTEND_ROOT || "http://localhost:3000";

const generateState = () => crypto.randomBytes(16).toString("hex");

export const oauthLoginRedirect = (req, res) => {
  try {
    const provider = req.params.provider;
    if (!provider) return res.status(400).send("Missing provider");

    const state = generateState();
    // set a short-lived httpOnly cookie to verify callback state
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 5 * 60 * 1000,
      sameSite: "lax",
      path: "/"
    });

    let url;
    if (provider === "azure") url = buildAzureAuthorizeUrl({ state });
    else if (provider === "google") url = buildGoogleAuthorizeUrl({ state });
    else return res.status(400).send("Unknown provider");

    return res.redirect(url);
  } catch (err) {
    logger.error("oauthLoginRedirect error", err);
    return res.status(500).send("OAuth login error");
  }
};

export const oauthCallback = async (req, res) => {
  try {
    const provider = req.params.provider;
    const { code, state } = req.query;
    const cookieState = req.cookies?.oauth_state;

    // validate state + code
    if (!provider) return res.status(400).send("Missing provider");
    if (!code) return res.status(400).send("Missing code");
    if (!state || !cookieState || state !== cookieState) {
      logger.warn("OAuth state mismatch or missing", { provider, cookieStatePresent: !!cookieState });
      return res.status(400).send("Invalid state or missing code");
    }

    // exchange authorization code for tokens and fetch profile
    let tokenSet, profile;
    try {
      if (provider === "azure") {
        tokenSet = await exchangeAzureCodeForToken(code);
        profile = await getAzureProfile(tokenSet.access_token);
      } else if (provider === "google") {
        tokenSet = await exchangeGoogleCodeForToken(code);
        profile = await getGoogleProfile(tokenSet.access_token);
      } else {
        return res.status(400).send("Unknown provider");
      }
    } catch (exchangeErr) {
      logger.error("Token exchange / profile fetch failed", {
        provider,
        err: exchangeErr?.response?.data || exchangeErr?.message || exchangeErr
      });
      return res.status(500).send("Failed to exchange token with provider");
    }

    // normalise profile fields
    const email = profile.mail || profile.userPrincipalName || profile.email;
    const providerId = profile.id || profile.sub;
    const displayName = profile.displayName || profile.name || profile.given_name || "User";

    if (!email) {
      logger.warn("Provider did not return email", { provider, providerId });
      return res.status(400).send("No email returned by provider");
    }

    // find user by provider id (linked) or by email (pre-authorized)
    let user = null;
    try {
      user = await User.findOne({ "providers.providerId": providerId, "providers.provider": provider });
      if (!user) {
        user = await User.findOne({ email });
      }
    } catch (dbErr) {
      logger.error("DB lookup error during oauthCallback", dbErr);
      return res.status(500).send("Server error");
    }

    if (!user) {
      logger.info(`OAuth signin attempt for unknown/pre-unregistered email`, { email, provider });
      return res.status(403).send("Account not pre-authorized. Contact admin.");
    }

    if (!user.isAllowed) {
      logger.info("OAuth signin attempt for disallowed user", { email });
      return res.status(403).send("Account not allowed to sign in");
    }

    // link provider if not linked yet
    const hasProvider = (user.providers || []).some(
      (p) => p.provider === provider && String(p.providerId) === String(providerId)
    );
    if (!hasProvider) {
      user.providers = user.providers || [];
      user.providers.push({ provider, providerId });
      try {
        await user.save();
      } catch (saveErr) {
        logger.error("Failed to save provider link", saveErr);
        // not fatal for sign-in, continue
      }
    }

    // ensure JWT secret present
    if (!JWT_SECRET) {
      logger.error("JWT_SECRET is not configured");
      return res.status(500).send("Server configuration error");
    }

    // create JWT for app
    const payload = { sub: user._id.toString(), role: user.role };
    let token;
    try {
      token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (signErr) {
      logger.error("Failed to sign JWT", signErr);
      return res.status(500).send("Server error");
    }

    // clear oauth state cookie
    res.clearCookie("oauth_state", { path: "/" });

    // redirect back to frontend with token in fragment (frontend will read localStorage)
    // redirect to a specific frontend callback route that will consume the token
const redirectUrl = `${FRONTEND_ROOT}/auth/callback#token=${encodeURIComponent(token)}&provider=${encodeURIComponent(provider)}`;
return res.redirect(redirectUrl);
  } catch (err) {
    logger.error("oauthCallback error", err?.response?.data || err);
    return res.status(500).send("OAuth callback error");
  }
};

export const oauthLogout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.redirect(process.env.FRONTEND_ROOT || "/");
};
