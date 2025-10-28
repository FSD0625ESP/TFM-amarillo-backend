import Photo from "../models/photo.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// 📸 Obtener todas las fotos
export const getAllPhotos = async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las fotos", error });
  }
};

// ➕ Subir una nueva foto (con subida a Cloudinary)
export const addPhoto = async (req, res) => {
  try {
    const { title, description, year, email } = req.body; // 👈 aquí llega el email

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Debe adjuntar al menos una imagen." });
    }

    const file = req.files[0];
    const uploadStream = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "proyecto_amarillo", resource_type: "image" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(stream);
      });

    const result = await uploadStream();

    const newPhoto = await Photo.create({
      title,
      description,
      imageUrl: result.secure_url,
      publicId: result.public_id,
      year,
      owner: email, // 👈 se guarda automáticamente el correo
      likes: 0,
    });

    res.status(201).json({
      message: "📸 Foto subida correctamente",
      photo: newPhoto,
    });
  } catch (error) {
    console.error("Error al agregar la foto:", error);
    res.status(500).json({ message: "Error al agregar la foto", error });
  }
};


// ❤️ Dar like (simple)
export const likePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Photo.findById(id);
    if (!photo) return res.status(404).json({ message: "Foto no encontrada" });

    photo.likes += 1;
    await photo.save();
    res.status(200).json({ message: "Like agregado", likes: photo.likes });
  } catch (error) {
    res.status(500).json({ message: "Error al dar like", error });
  }
};

// ❌ Eliminar foto
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Photo.findById(id);
    if (!photo) return res.status(404).json({ message: "Foto no encontrada" });

    // Eliminar también de Cloudinary
    await cloudinary.uploader.destroy(photo.publicId);

    await Photo.findByIdAndDelete(id);
    res.status(200).json({ message: "Foto eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la foto", error });
  }
};

// 📊 Obtener destacadas
export const getHighlightedPhotos = async (req, res) => {
  try {
    const mostLiked = await Photo.findOne().sort({ likes: -1 });
    const oldestByYear = await Photo.findOne({ year: { $ne: null } }).sort({ year: 1 });
    const newestUploaded = await Photo.findOne().sort({ createdAt: -1 });

    res.json({ mostLiked, oldestByYear, newestUploaded });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener fotos destacadas", error });
  }
};
