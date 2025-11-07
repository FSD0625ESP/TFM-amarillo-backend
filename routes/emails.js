import express from "express";
import multer from "multer";
import { completeRegistration, getEmail, deleteEmail } from "../controllers/emailController.js";
import { sendMagicLink } from "../controllers/magic-link.js";
import { verifyToken } from "../controllers/verify-token.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post("/send-magic-link", sendMagicLink);
router.get("/verify-token", verifyToken);
router.post("/complete", upload.array("photos"), completeRegistration);
router.get("/", getEmail);
router.delete("/:id", deleteEmail);

export default router;
