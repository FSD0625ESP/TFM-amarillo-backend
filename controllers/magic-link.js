import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { transporter } from "../config/nodemailer.js";
import { render } from "@react-email/render";
import React from "react";
import VerificationEmail from "../models/emails/TokenEmail.js";
import EmailEntry from "../models/EmailEntry.js";

dotenv.config();

export const sendMagicLink = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "El correo es requerido." });
    }

    // 🔍 1️⃣ VERIFICAR PRIMERO si el correo ya existe
    const existing = await EmailEntry.findOne({ email });

    if (existing) {
      return res.status(409).json({
        message: "Este correo ya está registrado.",
        alreadyRegistered: true,
      });
    }

    // 🔑 2️⃣ Generar token SOLO si no existe
    const token = jwt.sign(
      { email, action: "register" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    const link = `http://localhost:5173/register?token=${encodeURIComponent(
      token
    )}`;

    // 📧 3️⃣ Renderizar email
    const html = await render(
      React.createElement(VerificationEmail, { verificationLink: link })
    );

    // 📬 4️⃣ Enviar correo
    await transporter.sendMail({
      from: `"Equipo Amarillo 💛" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Tu enlace mágico de registro",
      html,
    });

    return res.status(200).json({
      message: "Enlace mágico enviado.",
    });
  } catch (error) {
    console.error("❌ Error en sendMagicLink:", error);
    return res.status(500).json({ message: "Error interno." });
  }
};
