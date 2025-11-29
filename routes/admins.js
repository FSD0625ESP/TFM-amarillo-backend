import express from "express";
import {
  createAdmin,
  loginAdmin,
  getAllAdmins,
  verifyAdminToken,
  getAdminUsers,
  setPhotoVisibility,
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/", createAdmin);
router.post("/login", loginAdmin);
router.post("/verify-token", verifyAdminToken);
router.get("/", getAllAdmins);
router.get("/users", getAdminUsers);
router.patch("/users/:id/photos/visibility", setPhotoVisibility);

export default router;