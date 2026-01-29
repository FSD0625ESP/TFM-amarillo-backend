import { Router } from "express";
import {
  getCountries,
  getPhotoYears,
  getPublicStats,
  getTopCountries,
  getUsablePhotosCount,
} from "../controllers/statController.js";

const router = Router();

// Público (o poné auth si querés)
router.get("/public", getPublicStats);
router.get("/top-countries", getTopCountries);
router.get("/countries", getCountries);
router.get("/years", getPhotoYears);
router.get("/usable-photos", getUsablePhotosCount);

export default router;
