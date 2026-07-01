import express from "express";
import { authMiddleware, permit } from "../middleware/auth.middleware.js";
import { getArchivedSeasons, getPrevCompanies, getPrevOffers, getPrevPendingOffers, placeStudentDirect, exportStudentsForYear } from "../controllers/prev-placement.controller.js";

const router = express.Router();

router.get("/prev-placement/seasons",        authMiddleware, permit("admin"), getArchivedSeasons);
router.get("/prev-placement/companies",      authMiddleware, permit("admin"), getPrevCompanies);
router.get("/prev-placement/offers",         authMiddleware, permit("admin"), getPrevOffers);
router.get("/prev-placement/pending",        authMiddleware, permit("admin"), getPrevPendingOffers);
router.get("/prev-placement/export",         authMiddleware, permit("admin"), exportStudentsForYear);
router.post("/prev-placement/place-student", authMiddleware, permit("admin"), placeStudentDirect);

export default router;
