import express from "express";
import {
  generateMainImageTiles,
  listTiles,
  matchTilesToPhotos,
  renderMosaic,
  listMosaicSnapshots,
} from "../controllers/mosaicController.js";

const router = express.Router();

router.post("/tiles/generate", generateMainImageTiles);
router.post("/tiles/match", matchTilesToPhotos);
router.get("/tiles", listTiles);
router.post("/render", renderMosaic);
router.get("/snapshots", listMosaicSnapshots);

export default router;
