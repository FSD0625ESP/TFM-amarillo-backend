// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import React from "react";
// import { render } from "@react-email/render";
// import brevo from "../config/brevo.js";
// import EditPhotosEmail from "../models/emails/EmailEdition.js";
// import EmailEntry from "../models/EmailEntry.js";

// dotenv.config();

// export const sendEditMagicLink = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) {
//       return res.status(400).json({ message: "El email es requerido." });
//     }

//     // 🔍 Verificar que el correo exista en la BD
//     const existingEntry = await EmailEntry.findOne({ email });
//     if (!existingEntry) {
//       return res.status(404).json({
//         message: "Este correo aún no tiene fotos registradas en el mosaico.",
//       });
//     }

//     // 🔑 Token especial para editar
//     const token = jwt.sign(
//       { email, action: "edit" },
//       process.env.JWT_SECRET,
//       { expiresIn: "2h" }
//     );

//     const link = `http://localhost:5173/userPage?token=${encodeURIComponent(
//       token
//     )}`;

//     // 📨 Renderizar HTML con React Email
//     const html = render(
//       React.createElement(EditPhotosEmail, { link })
//     );

//     // 🚀 Enviar correo con Brevo API (SIN SMTP)
//     await brevo.sendTransacEmail({
//       sender: {
//         name: "Equipo Amarillo",
//         email: process.env.EMAIL_FROM,
//       },
//       to: [{ email }],
//       subject: "Enlace para ver y editar tus fotos",
//       htmlContent: html,
//     });

//     return res.status(200).json({
//       message: "Te hemos enviado un enlace para ver y editar tus fotos.",
//     });
//   } catch (error) {
//     console.error("❌ Error en sendEditMagicLink (Brevo):", error);
//     return res.status(500).json({ message: "Error interno." });
//   }
// };
