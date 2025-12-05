import express from "express";
import { addFact, getRandomFact, getAllFacts, updateFact, deleteFact } from "../controllers/factController.js";

const router = express.Router();


router.post("/", addFact);
router.get('/random', getRandomFact);
router.get('/', getAllFacts);
router.put('/:id', updateFact);
router.delete('/:id', deleteFact);

export default router;
