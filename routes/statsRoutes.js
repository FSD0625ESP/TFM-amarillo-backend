import { Router } from "express";
import { getPublicStats, getTopCountries } from "../controllers/statController.js";

const router = Router();

// Público (o poné auth si querés)
router.get("/public", getPublicStats);
router.get("/top-countries", getTopCountries);

export default router;
