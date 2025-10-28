// src/config/socket.js
import { Server } from "socket.io";
import { logger } from "../utils/logger.js";

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 */
export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ROOT || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"]
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Handle client joining a company room (for POCs and admins viewing company)
    socket.on("join:company", (companyId) => {
      socket.join(`company:${companyId}`);
      logger.info(`Socket ${socket.id} joined company room: ${companyId}`);
    });

    // Handle client leaving a company room
    socket.on("leave:company", (companyId) => {
      socket.leave(`company:${companyId}`);
      logger.info(`Socket ${socket.id} left company room: ${companyId}`);
    });

    // Handle student joining their personal room (for receiving offers/updates)
    socket.on("join:student", (studentId) => {
      socket.join(`student:${studentId}`);
      logger.info(`Socket ${socket.id} joined student room: ${studentId}`);
    });

    // Handle student leaving their personal room
    socket.on("leave:student", (studentId) => {
      socket.leave(`student:${studentId}`);
      logger.info(`Socket ${socket.id} left student room: ${studentId}`);
    });

    // Handle admin joining admin room (for company updates)
    socket.on("join:admin", () => {
      socket.join("admin");
      logger.info(`Socket ${socket.id} joined admin room`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info("Socket.IO initialized successfully");
  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {Server} Socket.IO server instance
 */
export function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket first.");
  }
  return io;
}

/**
 * Emit shortlist update event to relevant rooms
 * @param {string} companyId - Company ID
 * @param {string} studentId - Student ID
 * @param {object} data - Update data
 */
export function emitShortlistUpdate(companyId, studentId, data) {
  if (io) {
    // Emit to company room (POCs viewing this company)
    io.to(`company:${companyId}`).emit("shortlist:update", data);
    
    // Emit to student's personal room
    io.to(`student:${studentId}`).emit("shortlist:update", data);
    
    logger.info(`Emitted shortlist update for company ${companyId}, student ${studentId}`);
  }
}

/**
 * Emit offer created event to relevant rooms
 * @param {string} companyId - Company ID
 * @param {string} studentId - Student ID
 * @param {object} data - Offer data
 */
export function emitOfferCreated(companyId, studentId, data) {
  if (io) {
    // Emit to company room
    io.to(`company:${companyId}`).emit("offer:created", data);
    
    // Emit to student's personal room
    io.to(`student:${studentId}`).emit("offer:created", data);
    
    // Emit to admin room (for pending offers dashboard)
    io.to("admin").emit("offer:created", data);
    
    logger.info(`Emitted offer created for company ${companyId}, student ${studentId}`);
  }
}

/**
 * Emit company update event to admin room
 * @param {string} action - Action type (created, updated, deleted)
 * @param {object} data - Company data
 */
export function emitCompanyUpdate(action, data) {
  if (io) {
    io.to("admin").emit("company:update", { action, data });
    logger.info(`Emitted company ${action} event`);
  }
}

/**
 * Emit student added to shortlist event
 * @param {string} companyId - Company ID
 * @param {object} data - Shortlist data
 */
export function emitStudentAdded(companyId, data) {
  if (io) {
    // Emit to company room (POCs viewing this company)
    io.to(`company:${companyId}`).emit("student:added", data);
    
    // Emit to student's personal room
    io.to(`student:${data.student}`).emit("student:added", data);
    
    logger.info(`Emitted student added for company ${companyId}`);
  }
}

/**
 * Emit student removed from shortlist event
 * @param {string} companyId - Company ID
 * @param {string} studentId - Student ID
 */
export function emitStudentRemoved(companyId, studentId) {
  if (io) {
    io.to(`company:${companyId}`).emit("student:removed", { studentId });
    io.to(`student:${studentId}`).emit("student:removed", { companyId });
    logger.info(`Emitted student removed for company ${companyId}`);
  }
}

/**
 * Emit offer approved event (admin approved, sent to student)
 * @param {string} studentId - Student ID
 * @param {string} companyId - Company ID
 * @param {object} data - Offer data
 */
export function emitOfferApproved(studentId, companyId, data) {
  if (io) {
    // Emit to student's personal room
    io.to(`student:${studentId}`).emit("offer:approved", data);
    
    // Emit to admin room for confirmation
    io.to("admin").emit("offer:approved", data);
    
    // Emit to company room (POCs)
    io.to(`company:${companyId}`).emit("offer:approved", data);
    
    logger.info(`Emitted offer approved for student ${studentId}`);
  }
}

/**
 * Emit offer rejected event (admin rejected)
 * @param {string} studentId - Student ID
 * @param {string} companyId - Company ID
 * @param {object} data - Offer data
 */
export function emitOfferRejected(studentId, companyId, data) {
  if (io) {
    // Emit to student's personal room
    io.to(`student:${studentId}`).emit("offer:rejected", data);
    
    // Emit to admin room
    io.to("admin").emit("offer:rejected", data);
    
    // Emit to company room (POCs)
    io.to(`company:${companyId}`).emit("offer:rejected", data);
    
    logger.info(`Emitted offer rejected for student ${studentId}`);
  }
}

/**
 * Emit offer status update (for real-time updates on all dashboards)
 * @param {object} data - Offer data with status
 */
export function emitOfferStatusUpdate(data) {
  if (io) {
    // Emit to admin room (for pending offers dashboard)
    io.to("admin").emit("offer:status-update", data);
    
    // Emit to student's personal room
    if (data.studentId) {
      io.to(`student:${data.studentId}`).emit("offer:status-update", data);
    }
    
    // Emit to company room (POCs)
    if (data.companyId) {
      io.to(`company:${data.companyId}`).emit("offer:status-update", data);
    }
    
    logger.info(`Emitted offer status update for offer ${data.offerId}`);
  }
}

/**
 * Emit student placed notification to ALL companies where student is shortlisted
 * This notifies POCs in real-time when a student gets placed elsewhere
 * @param {string} studentId - Student ID who got placed
 * @param {string} placedCompanyId - Company ID where student got placed
 * @param {string} placedCompanyName - Company name where student got placed
 * @param {Array} shortlistedCompanyIds - Array of company IDs where student is shortlisted
 */
export function emitStudentPlaced(studentId, placedCompanyId, placedCompanyName, shortlistedCompanyIds) {
  if (io) {
    // Notify all companies where this student is shortlisted (except the placed company)
    shortlistedCompanyIds.forEach((companyId) => {
      const companyIdStr = companyId.toString();
      if (companyIdStr !== placedCompanyId.toString()) {
        io.to(`company:${companyIdStr}`).emit("student:placed", {
          studentId,
          placedCompanyId,
          placedCompanyName,
          message: `Student has been placed at ${placedCompanyName}`
        });
        logger.info(`Notified company ${companyIdStr} that student ${studentId} was placed at ${placedCompanyName}`);
      }
    });
    
    logger.info(`Emitted student placement notification for student ${studentId} to ${shortlistedCompanyIds.length} companies`);
  }
}

