import express from "express";
import multer from "multer";
import {
  generateMainImageTiles,
  listTiles,
  matchTilesToPhotos,
  renderMosaic,
  listMosaicSnapshots,
  getLatestMosaicSnapshot,
  deleteMosaicSnapshot,
  getMosaicConfig,
  updateMosaicConfig,
  uploadMainImage,
} from "../controllers/mosaicController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/tiles/generate", generateMainImageTiles);
router.post("/tiles/match", matchTilesToPhotos);
router.get("/tiles", listTiles);
router.post("/render", renderMosaic);
router.get("/snapshots", listMosaicSnapshots);
router.get("/snapshots/latest", getLatestMosaicSnapshot);
router.delete("/snapshots/:id", deleteMosaicSnapshot);
router.get("/config", getMosaicConfig);
router.put("/config", updateMosaicConfig);
router.post("/main-image", upload.single("image"), uploadMainImage);

export default router;
