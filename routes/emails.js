import express from "express";
import multer from "multer";

import {
  completeRegistration,
  getEmail,
  deleteEmail,
  getUserPhotos,
  updateEmailEntry
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
router.get("/:id/photos", getUserPhotos);
router.delete("/:id", deleteEmail);

export default router;
