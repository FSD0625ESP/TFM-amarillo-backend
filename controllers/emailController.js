import { validationResult } from "express-validator";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
import EmailEntry from "../models/EmailEntry.js";

dotenv.config();


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});



export const sendEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, age, country } = req.body;

    

    const existingEmail = await EmailEntry.findOne({ email });
    if (existingEmail) {
      return res
        .status(400)
        .json({ message: "Este correo ya está registrado." });
    }

    

    const verificationCode = crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

    

    const newEntry = new EmailEntry({
      email,
      name,
      age,
      country,
      verificationCode,
    });

    await newEntry.save();

    

    const mailOptions = {
      from: `"Equipo Amarillo 💛" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código de verificación",
      text: `Hola ${name}, tu código de verificación es: ${verificationCode}`,
      html: `<p>Hola <b>${name}</b>,</p><p>Tu código de verificación es: <b>${verificationCode}</b></p>`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Correo enviado correctamente y usuario guardado en la base de datos.",
      email: newEntry.email,
    });
  } catch (error) {
    console.error("❌ Error en sendEmail:", error);
    return res.status(500).json({
      message: "Error interno del servidor.",
      error: error.message,
    });
  }
};



export const getEmail = async (req, res) => {
  try {
    const emails = await EmailEntry.find().sort({ subscribedAt: -1 });
    return res.status(200).json(emails);
  } catch (error) {
    console.error("❌ Error en getEmail:", error);
    return res.status(500).json({
      message: "Error al obtener los registros.",
      error: error.message,
    });
  }
};



export const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await EmailEntry.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Correo no encontrado." });
    }

    return res
      .status(200)
      .json({ message: "Correo eliminado correctamente.", deleted });
  } catch (error) {
    console.error("❌ Error en deleteEmail:", error);
    return res.status(500).json({
      message: "Error al eliminar el correo.",
      error: error.message,
    });
  }
};



export const verificationCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "Email y código de verificación son requeridos." });
    }

    const user = await EmailEntry.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Correo no encontrado." });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Código de verificación inválido." });
    }

    user.isVerified = true;
    await user.save();

    return res.status(200).json({ message: "Correo verificado correctamente." });
  } catch (error) {
    console.error("❌ Error en verificationCode:", error);
    return res.status(500).json({
      message: "Error al verificar el código.",
      error: error.message,
    });
  }
};
