import express from "express";
import {
  getAllPhotos,
  addPhoto,
  likePhoto,
  deletePhoto
} from "../controllers/photoController.js";

const router = express.Router();

// Rutas limpias y RESTful
router.get("/", getAllPhotos);           // Obtener todas
router.post("/", addPhoto);              // Agregar una
router.patch("/:id/like", likePhoto);    // Dar like
router.delete("/:id", deletePhoto);      // Borrar

export default router;