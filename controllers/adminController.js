// controllers/adminController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Admin from "../models/admins.js";
import EmailEntry from "../models/EmailEntry.js";

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

export const verifyAdminToken = (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Token requerido." });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ message: "Token válido." });
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
};

export const getAdminUsers = async (_req, res) => {
  try {
    const users = await EmailEntry.find().sort({ subscribedAt: -1 });

    const formatted = users.map((user) => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      country: user.country,
      story: user.story,
      subscribedAt: user.subscribedAt,
      photos: (user.photos || []).map((photoUrl) => ({
        url: photoUrl,
        hidden: user.hiddenPhotos?.includes(photoUrl) || false,
      })),
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener usuarios.", error: error.message });
  }
};

export const setPhotoVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl, hidden } = req.body;

    if (!photoUrl) {
      return res
        .status(400)
        .json({ message: "photoUrl es requerido para actualizar visibilidad." });
    }

    const updateOperation = hidden
      ? { $addToSet: { hiddenPhotos: photoUrl } }
      : { $pull: { hiddenPhotos: photoUrl } };

    const updatedUser = await EmailEntry.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    return res.status(200).json({
      message: "Visibilidad de la foto actualizada.",
      userId: id,
      photoUrl,
      hidden,
    });
  } catch (error) {
    console.error("❌ Error al actualizar visibilidad:", error);
    return res.status(500).json({
      message: "Error al actualizar la visibilidad.",
      error: error.message,
    });
  }
};
