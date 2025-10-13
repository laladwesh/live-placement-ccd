import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import { connectDB } from "./config/db.js";
import { initializeSocket } from "./config/socket.js";
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);

// Connect DB
await connectDB(MONGO_URI);

// Initialize Socket.IO
initializeSocket(server);

// basic middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_ROOT || "http://localhost:3000",
  credentials: true
}));

// mount API routes under /api
app.use("/api/auth", authRoutes);

// health
app.get("/api/health", (req, res) => res.json({ ok: true }));
// app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", companyRoutes);
app.use("/api/poc", pocRoutes);
app.use("/api/student", studentRoutes);
app.get("/api/users/me", authMiddleware, whoami);

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
      // let /api/* go to backend
      if (req.path.startsWith("/api")) return next();
      // otherwise proxy to client dev server
      createProxyMiddleware({
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        logLevel: "silent"
      })(req, res, next);
    }
  );
  logger.info("Development proxy enabled -> forwarding non-/api requests to CRA dev server");
} else {
  // production: serve built React from client/build
  const staticPath = path.join(__dirname, "..", "client", "build");
  app.use(express.static(staticPath));
  // All other non-API routes serve index.html
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ message: "Not found" });
    res.sendFile(path.join(staticPath, "index.html"));
  });
  logger.info("Production static serving enabled from client/build");
}

// global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ message: "Server error" });
});

server.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV})`);
});
