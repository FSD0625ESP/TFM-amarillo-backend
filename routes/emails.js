import express from "express";
import multer from "multer";
import {
  completeRegistration,
  getEmail,
  deleteEmail,
  getUserPhotos,
} from "../controllers/emailController.js";

import { sendMagicLink } from "../controllers/magic-link.js";
import { verifyToken } from "../controllers/verify-token.js";
import { sendEditMagicLink } from "../controllers/sendEditMagicLink.js";
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();



router.post("/send-magic-link", sendMagicLink);
router.post("/send-edit-link", sendEditMagicLink);
router.get("/verify-token", verifyToken);
router.post("/complete", upload.array("photos"), completeRegistration);
router.get("/", getEmail);
router.get("/:id/photos", getUserPhotos);
router.delete("/:id", deleteEmail);


export default router;
