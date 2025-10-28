import express from "express";
import multer from "multer";
import { addPhoto, getAllPhotos, likePhoto, deletePhoto, getHighlightedPhotos } from "../controllers/photoController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", getAllPhotos);
router.post("/add", upload.array("photos", 1), addPhoto);
router.post("/:id/like", likePhoto);
router.delete("/:id", deletePhoto);
router.get("/highlighted", getHighlightedPhotos);

export default router;
