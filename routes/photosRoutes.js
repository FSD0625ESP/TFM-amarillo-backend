import express from "express";
import {
  getAllPhotos,
  addPhoto,
  likePhoto,
  deletePhoto,
  getHighlightedPhotos,
  hidePhoto,
  unhidePhoto,
  getPhotosByUser,
  getAllPhotosAdmin,
  updatePhoto,
} from "../controllers/photoController.js";

const router = express.Router();

// ⭐️ Mover esta línea arriba
router.get("/highlighted", getHighlightedPhotos);
router.get("/user/:userId", getPhotosByUser);

// Rutas limpias y RESTful
router.get("/", getAllPhotos);           // Obtener todas
router.post("/", addPhoto);              // Agregar una

// Rutas específicas deben declararse antes de /:id
router.put("/:id/hide", hidePhoto);
router.put("/:id/unhide", unhidePhoto);

router.put("/:id", updatePhoto);         // Actualizar datos
router.patch("/:id/like", likePhoto);    // Dar like
router.delete("/:id", deletePhoto);      // Borrar

router.get("/all", getAllPhotosAdmin);

export default router;
