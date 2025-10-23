// controllers/adminController.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const loginAdmin = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password)
      return res.status(400).json({ message: "Contraseña requerida." });

    console.log("🔐 Password recibido:", password);
    console.log("🔐 Hash en .env:", process.env.ADMIN_PASSWORD_HASH);

    const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    console.log("✅ Coincide:", match);

    if (!match)
      return res.status(401).json({ message: "Contraseña incorrecta." });

    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
    });
  } catch (error) {
    console.error("❌ Error en loginAdmin:", error);
    return res.status(500).json({
      message: "Error interno del servidor.",
      error: error.message,
    });
  }
};
