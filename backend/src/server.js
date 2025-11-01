// dev branch
import "./config/env.js"; 

import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import { connectDB } from "./config/db.js";
import { initializeSocket } from "./config/socket.js";
import { setupAdminJS } from "./config/adminjs.config.js";
// import authRoutes from "./routes/auth.route.js";
import authRoutes from './routes/auth.routes.js'
import adminRoutes from "./routes/admin.route.js";
import companyRoutes from "./routes/company.routes.js";
import pocRoutes from "./routes/poc.routes.js";
import studentRoutes from "./routes/student.routes.js";
import { logger } from "./utils/logger.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { whoami } from "./controllers/me.controller.js";


const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
// BASE_PATH example: '/dday' - when set, APIs and admin UI will be mounted under this path
const BASE_PATH = process.env.BASE_PATH || "/dday"; // should start with '/'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);

// Connect DB
await connectDB(MONGO_URI);

// Initialize Socket.IO
initializeSocket(server);

// Morgan logger for development
app.use(morgan('dev'));

// basic middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_ROOT || "http://localhost:3000",
  credentials: true
}));

// Setup AdminJS (after basic middleware, but before helmet to avoid CSP issues)
const { adminJs, adminRouter } = setupAdminJS();
// Mount AdminJS router at its rootPath (respect BASE_PATH if provided)
const adminMountPath = BASE_PATH ? `${BASE_PATH}${adminJs.options.rootPath}` : adminJs.options.rootPath;
app.use(adminMountPath, adminRouter);

// Helmet for security (after AdminJS to avoid CSP blocking AdminJS assets)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for AdminJS to work
}));

// mount API routes under /api (respect BASE_PATH)
const prefixed = (p) => (BASE_PATH ? `${BASE_PATH}${p}` : p);
app.use(prefixed('/api/auth'), authRoutes);

// health
app.get(prefixed('/api/health'), (req, res) => res.json({ ok: true }));
app.use(prefixed('/api/admin'), adminRoutes);
app.use(prefixed('/api/admin'), companyRoutes);
app.use(prefixed('/api/poc'), pocRoutes);
app.use(prefixed('/api/student'), studentRoutes);
app.get(prefixed('/api/users/me'), authMiddleware, whoami);

// =======================================================
// Dev reverse proxy behavior: proxy everything not under /api to CRA dev server
// Production behavior: serve client/build statically
// =======================================================
const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Proxy non-API requests to CRA dev server at http://localhost:3000
  const proxyTarget = process.env.FRONTEND_ROOT || "http://localhost:3000";
  app.use(
    (req, res, next) => {
      // Let prefixed API and admin paths go to backend
      const apiPrefix = prefixed('/api');
      const adminPrefix = adminMountPath;
      if (req.path.startsWith(apiPrefix) || req.path.startsWith(adminPrefix)) return next();

      // Otherwise proxy to client dev server. If BASE_PATH is set, strip it when forwarding to CRA
      const proxyOptions = {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        logLevel: 'silent'
      };
      if (BASE_PATH) {
        proxyOptions.pathRewrite = {};
        proxyOptions.pathRewrite[`^${BASE_PATH}`] = '';
      }
      createProxyMiddleware(proxyOptions)(req, res, next);
    }
  );
  logger.info("Development proxy enabled -> forwarding non-backend requests to CRA dev server");
} else {
  // production: serve built React from client/build
  const staticPath = path.join(__dirname, "..", "client", "build");
  if (BASE_PATH) {
    // Serve the built client under BASE_PATH
    app.use(BASE_PATH, express.static(staticPath));
    app.get(`${BASE_PATH}/*`, (req, res) => {
      // if it's an api path return 404
      if (req.path.startsWith(prefixed('/api'))) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  } else {
    app.use(express.static(staticPath));
    // All other non-API routes serve index.html
    app.get('*', (req, res) => {
      if (req.path.startsWith(prefixed('/api'))) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }
  logger.info("Production static serving enabled from client/build");
}

// global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ message: "Server error" });
});

server.listen(PORT, () => {
  const baseInfo = BASE_PATH ? `${BASE_PATH}` : '';
  logger.info(`Server listening on http://localhost:${PORT}${baseInfo} (NODE_ENV=${process.env.NODE_ENV})`);
});
