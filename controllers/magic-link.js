// controllers/magic-link.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import React from "react";
import { render } from "@react-email/render";

import EmailEntry from "../models/EmailEntry.js";
import VerificationEmail from "../models/emails/VerificationEmail.js";
import EditPhotosEmail from "../models/emails/EmailEdition.js";
import { sendBrevoEmail } from "../services/brevo.js"; // 👈 importante

dotenv.config();

export const sendSmartMagicLink = async (req, res) => {
  try {
    const frontendBaseUrl = (process.env.FRONTEND || "http://localhost:5173")
      .replace(/\/+$/, "");

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "El email es requerido." });
    }

    const normalizedEmail = email.toLowerCase();

    const existingEntry = await EmailEntry.findOne({
      email: normalizedEmail,
    });

    // 🔵 NO existe → REGISTRO
    if (!existingEntry) {
      const token = jwt.sign(
        { email: normalizedEmail, action: "register" },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      const link = `${frontendBaseUrl}/register?token=${encodeURIComponent(
        token

      // const link = `https://gilded-vacherin-e79d5a.netlify.app/register?token=${encodeURIComponent(
      //   token
      )}`;

      const html = await render(
        React.createElement(VerificationEmail, {
          verificationLink: link,
        })
      );

      await sendBrevoEmail({
        to: normalizedEmail,
        subject: "Completa tu registro",
        html,
      });

      return res.status(200).json({
        message: "Te enviamos un enlace para completar tu registro.",
        mode: "register",
      });
    }

    // 🟢 YA existe → EDICIÓN
    const token = jwt.sign(
      { email: normalizedEmail, action: "edit" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    const link = `${frontendBaseUrl}/auth-redirect?token=${encodeURIComponent(
      token
    )}`;

    const html = await render(
      React.createElement(EditPhotosEmail, { link })
    );

    await sendBrevoEmail({
      to: normalizedEmail,
      subject: "Accede a tus fotos",
      html,
    });

    return res.status(200).json({
      message: "Te enviamos un enlace para ver y editar tus fotos.",
      mode: "edit",
    });
  } catch (error) {
    console.error("❌ Error en sendSmartMagicLink:", error);
    return res.status(500).json({ message: "Error interno." });
  }
};
