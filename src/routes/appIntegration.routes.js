/**
 * App Integration router — read-only reporting layer for the CCD mobile app.
 * All routes are guarded by shared-secret (appAuth); no JWT/session required.
 * No writes. All queries use .lean().
 *
 * Routes:
 *   GET /app-integration/pocs                       — all POCs with linked company (current season)
 *   GET /app-integration/pocs/:companyId            — POCs for one company
 *   GET /app-integration/students                   — all students: name/roll/email + shortlist/presence/placement
 *                                                     optional ?limit=<n>&page=<n>
 *   GET /app-integration/students/:rollNumberOrEmail — single student by roll number OR email
 */

import express from "express";
import appAuth from "../middleware/appAuth.js";
import {
  listPOCs,
  listPOCsByCompany,
  listStudents,
  getStudent,
} from "../controllers/appIntegration.controller.js";

const router = express.Router();

router.use(appAuth);

router.get("/pocs",                        listPOCs);
router.get("/pocs/:companyId",             listPOCsByCompany);
router.get("/students",                    listStudents);
router.get("/students/:rollNumberOrEmail", getStudent);

export default router;
