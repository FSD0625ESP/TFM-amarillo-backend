import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import EmailEntry from "../models/EmailEntry.js";

dotenv.config();

export const verifyToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.status(400).json({ message: "Token requerido." });

    console.log("📥 Token recibido (sin decodificar):", token);
    const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
    console.log("✅ Token verificado correctamente:", decoded);

    const email = decoded.email;
    let authToken = null;
    let userId = null;

    if (email) {
      const user = await EmailEntry.findOne({ email })
        .select("_id email country")
        .lean();
      if (user?._id) {
        userId = user._id.toString();
        authToken = jwt.sign(
          { userId, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
      }
    }

    return res.status(200).json({
      message: "Token válido.",
      email,
      token: authToken,
      userId,
      country: userId ? user?.country ?? null : null,
    });
  } catch (error) {
    console.error("❌ Error en verifyToken:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "El enlace ha expirado." });
    }

    return res.status(401).json({ message: "El enlace no es válido." });
  }
};
