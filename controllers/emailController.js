
import dotenv from "dotenv";
import EmailEntry from "../models/EmailEntry.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

dotenv.config();

export const completeRegistration = async (req, res) => {
  try {
    const { email, name, age, country, story, photoYear } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Falta el correo electrónico." });
    }

    
    const existing = await EmailEntry.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Este correo ya completó el registro." });
    }

    
    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "proyecto_amarillo" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(stream);
      });
    });

    const uploadedUrls = await Promise.all(uploadPromises);

   
    const newUser = new EmailEntry({
      email,
      name,
      age,
      country,
      story,
      photoYear,
      photos: uploadedUrls,
      subscribedAt: new Date(),
    });

    await newUser.save();

    return res.status(200).json({
      message: "Registro completado con éxito.",
      colaboradorNum: await EmailEntry.countDocuments(),
    });
  } catch (error) {
    console.error("❌ Error en completeRegistration:", error);
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

    return res.status(200).json({
      message: "Correo eliminado correctamente.",
      deleted,
    });
  } catch (error) {
    console.error("❌ Error en deleteEmail:", error);
    return res.status(500).json({
      message: "Error al eliminar el correo.",
      error: error.message,
    });
  }
};
