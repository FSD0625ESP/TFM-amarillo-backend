import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { transporter } from "../config/nodemailer.js";
import { render } from "@react-email/render";
import React from "react";
import VerificationEmail from "../models/emails/TokenEmail.js";

dotenv.config();

export const sendMagicLink = async (req, res) => {
  try {
    
    const { email } = req.body;

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    const link = `http://localhost:5173/register?token=${encodeURIComponent(token)}`;

    // ⚠️ AQUÍ ES DONDE DEBE USARSE createElement:
    const html = await render(
      React.createElement(VerificationEmail, { verificationLink: link })
    );

    await transporter.sendMail({
      from: `"Equipo Amarillo 💛" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Tu enlace mágico de registro",
      html,
    });

    return res.status(200).json({ message: "Enlace mágico enviado." });

  } catch (error) {
    console.error("❌ Error en sendMagicLink:", error);
    return res.status(500).json({ message: "Error interno." });
  }
};
