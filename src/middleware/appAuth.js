import { logger } from "../utils/logger.js";

/**
 * Server-to-server shared-secret middleware for the CCD mobile app integration.
 *
 * Checks header  x-app-key  (or query param ?app_key=) against env var APP_INTEGRATION_KEY.
 * - 503 if APP_INTEGRATION_KEY is not configured on this server
 * - 401 if the key is missing or wrong
 * - Reads x-app-source into req.appCaller for logging; no enforcement on it.
 *
 * Mirrors the exact pattern used in the main Placement Portal (backend/middlewares/appAuth.js).
 */
export const appAuth = (req, res, next) => {
  const expected = (process.env.APP_INTEGRATION_KEY || "").trim();

  if (!expected) {
    logger.error("[appAuth] APP_INTEGRATION_KEY is not configured — refusing app-integration request");
    return res.status(503).json({
      status: "error",
      msg: "App integration is not configured on this server.",
    });
  }

  const provided = String(
    req.headers["x-app-key"] || req.query.app_key || ""
  ).trim();

  if (!provided || provided !== expected) {
    return res.status(401).json({
      status: "error",
      msg: "Invalid or missing app integration key.",
    });
  }

  req.appCaller = {
    kind: "app",
    source: req.headers["x-app-source"] || "unknown",
  };

  logger.info(`[appAuth] request from source="${req.appCaller.source}" → ${req.method} ${req.originalUrl}`);
  return next();
};

export default appAuth;
