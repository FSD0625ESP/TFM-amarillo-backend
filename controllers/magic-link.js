import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendMagicLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: "El correo es requerido." });

    
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    
    const link = `http://localhost:5173/register?token=${token}`;

    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

   
    await transporter.sendMail({
      from: `"Equipo Amarillo 💛" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Tu enlace mágico de registro",
      html: `
        <p>Hola 👋</p>
        <p>Haz clic en el siguiente enlace para completar tu registro:</p>
        <a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>
        <p>Este enlace expirará en 2 horas.</p>
      `,
    });

    return res.status(200).json({
      message: "Enlace mágico enviado al correo.",
    });
  } catch (error) {
    console.error("❌ Error en sendMagicLink:", error);
    return res.status(500).json({
      message: "Error al enviar el enlace mágico.",
      error: error.message,
    });
  }
};
