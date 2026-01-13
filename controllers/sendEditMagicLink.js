import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import React from "react";
import { render } from "@react-email/render";
import { transporter } from "../config/nodemailer.js";
import EditPhotosEmail from "../models/emails/EmailEdition.js";
import EmailEntry from "../models/EmailEntry.js";

dotenv.config();

export const sendEditMagicLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "El email es requerido." });
    }

    // 🔍 Verificar que el correo exista en la BD
    const existingEntry = await EmailEntry.findOne({ email });
    if (!existingEntry) {
      return res.status(404).json({
        message: "Este correo aún no tiene fotos registradas en el mosaico.",
      });
    }

    // 🔑 Token especial para editar
    const token = jwt.sign(
      { email, action: "edit" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    const link = `http://localhost:5173/userPage?token=${encodeURIComponent(
      token
    )}`;

    // 📨 Generar HTML con React Email
    const html = await render(
      React.createElement(EditPhotosEmail, { link })
    );

    await transporter.sendMail({
      from: `"Equipo Amarillo 💛" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Enlace para ver y editar tus fotos",
      html,
    });

    return res.status(200).json({
      message: "Te hemos enviado un enlace para ver y editar tus fotos.",
    });
  } catch (error) {
    console.error("❌ Error en sendEditMagicLink:", error);
    return res.status(500).json({ message: "Error interno." });
  }
};
