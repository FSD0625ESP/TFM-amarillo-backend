import express from "express";
import {
  createAdmin,
  loginAdmin,
  getAllAdmins,
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/", createAdmin);
router.post("/login", loginAdmin);
router.get("/", getAllAdmins);

export default router;
