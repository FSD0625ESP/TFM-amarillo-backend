import express from "express";
import { addFact, getRandomFact } from "../controllers/factController.js";

const router = express.Router();


router.post("/", addFact);
router.get('/random', getRandomFact);

export default router;
