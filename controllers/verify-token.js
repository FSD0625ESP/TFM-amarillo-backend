import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const verifyToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.status(400).json({ message: "Token requerido." });

    console.log("📥 Token recibido (sin decodificar):", token);
    const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    console.log("✅ Token verificado correctamente:", decoded);

    return res.status(200).json({
      message: "Token válido.",
      email: decoded.email,
    });
  } catch (error) {
    console.error("❌ Error en verifyToken:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "El enlace ha expirado." });
    }

    return res.status(401).json({ message: "El enlace no es válido." });
  }
};
