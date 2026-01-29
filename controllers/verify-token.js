import jwt from "jsonwebtoken";
import EmailEntry from "../models/EmailEntry.js";

export const verifyToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Token requerido" });
    }

    // 🔓 Verificar magic link
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await EmailEntry.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const authToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      email: user.email,
      name: user.name,
      action: decoded.action,
      token: authToken, 
    });
  } catch (err) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};
