import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import EmailEntry from "../models/EmailEntry.js";
import cloudinary, { cloudinaryUploadOptions } from "../config/cloudinary.js";
import Photo from "../models/photo.js";
import { Readable } from "stream";
import { getPngUrl } from "./cloudinaryUrls.js";

dotenv.config();

export const completeRegistration = async (req, res) => {
  try {
    const { email, name, age, country, story, year, title } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Falta el correo electrónico." });
    }

    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "Debes subir al menos una fotografía." });
    }

    const parsedYear =
      year === null || year === "" || year === undefined
        ? undefined
        : Number(year);
    const currentYear = new Date().getFullYear();

    if (
      parsedYear !== undefined &&
      (Number.isNaN(parsedYear) ||
        parsedYear < 1882 ||
        parsedYear > currentYear)
    ) {
      return res.status(400).json({ message: "El año no es válido" });
    }

    const normalizedCountry =
      typeof country === "string" && country.trim()
        ? country.trim().toUpperCase()
        : "";

    const existing = await EmailEntry.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Este correo ya completó el registro." });
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          cloudinaryUploadOptions,
          (error, result) => {
            if (error) reject(error);
            else
              resolve({
                url: getPngUrl(result.public_id),
                publicId: result.public_id,
              });
          }
        );

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(stream);
      });
    });

    const uploadedAssets = await Promise.all(uploadPromises);
    const uploadedUrls = uploadedAssets.map((asset) => asset.url);

    const newUser = new EmailEntry({
      email,
      name,
      age,
      country: normalizedCountry,
      story,
      year: parsedYear,
      photos: uploadedUrls,
      subscribedAt: new Date(),
    });

    await newUser.save();

    const normalizedTitle = title?.trim() || "Fotografía del Proyecto Amarillo";
    const normalizedDescription = story?.trim() || "";
    const normalizedYear = parsedYear;

    const photoDocs = uploadedAssets.map((asset, index) => ({
      title:
        uploadedAssets.length > 1
          ? `${normalizedTitle} #${index + 1}`
          : normalizedTitle,
      description: normalizedDescription,
      owner: newUser._id,
      imageUrl: asset.url,
      publicId: asset.publicId,
      year: normalizedYear,
      country: normalizedCountry || null,
    }));

    await Photo.insertMany(photoDocs);

    const token = jwt.sign(
      { userId: newUser._id.toString(), email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Registro completado con éxito.",
      colaboradorNum: await EmailEntry.countDocuments(),
      token,
      user: {
        _id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        country: newUser.country,
      },
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
    const users = await EmailEntry.find().lean();

    const enriched = users.map((u) => ({
      ...u,
      photosCount: Array.isArray(u.photos) ? u.photos.length : 0,
    }));

    return res.status(200).json(enriched);
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

export const updateEmailEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { country } = req.body;

    const user = await EmailEntry.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (
      !country ||
      typeof country !== "string" ||
      country.trim().length === 0
    ) {
      return res.status(400).json({ message: "El país es obligatorio." });
    }

    const countryCode = country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return res
        .status(400)
        .json({ message: "El país debe ser un código ISO de 2 letras." });
    }

    user.country = countryCode;
    await user.save();

    return res.status(200).json({
      message: "Usuario actualizado correctamente.",
      user,
    });
  } catch (error) {
    console.error("❌ Error en updateEmailEntry:", error);
    return res.status(500).json({
      message: "Error al actualizar el usuario.",
      error: error.message,
    });
  }
};

export const getUserPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await EmailEntry.findById(id).lean();

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    let photos = await Photo.find({ owner: user._id }).lean();
    if (!photos.length) {
      photos = await Photo.find({ owner: user.email }).lean();
    }

    let formatted;
    if (photos.length) {
      formatted = photos.map((photo) => ({
        _id: photo._id,
        id: photo._id.toString(),
        url: photo.imageUrl,
        imageUrl: photo.imageUrl,
        title: photo.title,
        description: photo.description,
        hidden: Boolean(photo.hidden),
        likes: photo.likes,
        createdAt: photo.createdAt,
        country: photo.country ?? user.country ?? null,
      }));
    } else {
      // Fallback legacy data
      const legacyPhotos = Array.isArray(user.photos) ? user.photos : [];
      const hiddenLegacy = Array.isArray(user.hiddenPhotos)
        ? user.hiddenPhotos
        : [];
      formatted = legacyPhotos.map((url, index) => ({
        _id: `${id}-${index}`,
        id: `${id}-${index}`,
        url,
        imageUrl: url,
        title: "",
        description: "",
        hidden: hiddenLegacy.includes(url),
        likes: 0,
        country: user.country ?? null,
      }));
    }

    return res.status(200).json({
      email: user.email,
      photos: formatted,
    });
  } catch (error) {
    console.error("❌ Error al obtener fotos del usuario:", error);
    return res.status(500).json({
      message: "Error al obtener fotos del usuario.",
      error: error.message,
    });
  }
};

export const getUserPhotosByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email requerido" });
    }

    const user = await EmailEntry.findOne({ email }).lean();

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const photos = await Photo.find({ owner: user._id })
      .select("imageUrl title description likes year country")
      .lean();

    return res.status(200).json({
      email: user.email,
      name: user.name, // ✅ AQUÍ
      photos, // ✅ likes incluidos
    });
  } catch (error) {
    console.error("❌ Error getUserPhotosByEmail:", error);
    res.status(500).json({ message: "Error interno" });
  }
};
