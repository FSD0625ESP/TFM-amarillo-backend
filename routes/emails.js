import express from "express";
import multer from "multer";
import {authUser} from "../middleware/authUser.js";
import Photo from "../models/photo.js";
import EmailEntry from "../models/EmailEntry.js";

import {
  completeRegistration,
  getEmail,
  deleteEmail,
  getUserPhotos,
  updateEmailEntry,
  getUserPhotosByEmail,
  addPhotosToUser
} from "../controllers/emailController.js";

import { sendSmartMagicLink } from "../controllers/magic-link.js";
import { verifyToken } from "../controllers/verify-token.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// 🔑 Magic link inteligente (registro o edición)
router.post("/send-smart-link", sendSmartMagicLink);

// 🔐 Verificar token
router.get("/verify-token", verifyToken);

// 📸 Registro
router.post("/complete", upload.array("photos"), completeRegistration);

// 👤 Emails
router.get("/", getEmail);
router.put("/:id", updateEmailEntry);
router.delete("/:id", deleteEmail);
router.get("/me/photos", authUser, async (req, res) => {
  const photos = await Photo.find({ owner: req.user.userId }).lean();
  res.json({ photos });
});
router.get("/:id/photos", getUserPhotos);
router.post("/add-photos", upload.array("photos"), addPhotosToUser);

router.get("/me", authUser, async (req, res) => {
  const user = await EmailEntry.findById(req.user.userId).lean();

  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  return res.json({
    email: user.email,
    name: user.name,
    age: user.age,
    country: user.country,
  });
});

export default router;
