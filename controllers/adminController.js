// controllers/adminController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Admin from "../models/admins.js";

dotenv.config();

export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username y contraseña requeridos." });

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ message: "Admin no encontrado." });
    }

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match)
      return res.status(401).json({ message: "Contraseña incorrecta." });

    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      username: admin.username,
    });
  } catch (error) {
    console.error("❌ Error en loginAdmin:", error);
    return res.status(500).json({
      message: "Error interno del servidor.",
      error: error.message,
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({}, "username passwordHash role"); // o los campos que quieras mostrar
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ error: "Error fetching admins" });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username y password requeridos." });

    const passwordHash = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({ username, passwordHash });
    await newAdmin.save();

    return res.status(201).json({ message: "Admin creado con éxito." });
  } catch (error) {
    console.error("❌ Error al crear admin:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};
