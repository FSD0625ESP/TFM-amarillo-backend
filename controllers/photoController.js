import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Photo from "../models/photo.js";
import EmailEntry from "../models/EmailEntry.js";

const extractOwnerId = (ownerValue) => {
  if (!ownerValue) return null;

  if (typeof ownerValue === "string") {
    return mongoose.Types.ObjectId.isValid(ownerValue) ? ownerValue : null;
  }

  if (ownerValue instanceof mongoose.Types.ObjectId) {
    return ownerValue.toString();
  }

  if (typeof ownerValue === "object" && ownerValue._id) {
    const possibleId = ownerValue._id;
    if (typeof possibleId === "string") {
      return mongoose.Types.ObjectId.isValid(possibleId) ? possibleId : null;
    }
    if (possibleId instanceof mongoose.Types.ObjectId) {
      return possibleId.toString();
    }
  }

  return null;
};

const buildOwnerLookup = async (photoDocs) => {
  const ownerIds = [
    ...new Set(
      photoDocs
        .map((photo) => extractOwnerId(photo?.owner))
        .filter(Boolean)
    ),
  ];

  if (!ownerIds.length) return new Map();

  const owners = await EmailEntry.find({ _id: { $in: ownerIds } })
    .select("email name country")
    .lean();

  return owners.reduce((map, owner) => {
    map.set(owner._id.toString(), owner);
    return map;
  }, new Map());
};

const formatPhotoResponse = (photoDoc, ownerLookup, currentUserId = null) => {
  if (!photoDoc) return photoDoc;
  const photo = photoDoc.toObject ? photoDoc.toObject() : photoDoc;
  const ownerValue = photo.owner;

  let ownerInfo = null;
  const ownerId = extractOwnerId(ownerValue);

  if (ownerId && ownerLookup.has(ownerId)) {
    ownerInfo = ownerLookup.get(ownerId);
  } else if (ownerValue && typeof ownerValue === "object" && ownerValue.email) {
    ownerInfo = ownerValue;
  } else if (typeof ownerValue === "string" && ownerValue.trim()) {
    ownerInfo = { email: ownerValue.trim() };
  }

  const ownerCountry = ownerInfo?.country ?? null;

  const likedByUser =
    currentUserId && Array.isArray(photo.likedBy)
      ? photo.likedBy.some((id) => id?.toString() === currentUserId)
      : false;

  return {
    ...photo,
    owner: ownerInfo,
    ownerEmail: ownerInfo?.email ?? null,
    country: photo?.country ?? ownerCountry,
    likedByUser,
  };
};

const enrichPhotosWithOwners = async (photoDocs, currentUserId = null) => {
  const docsArray = Array.isArray(photoDocs)
    ? photoDocs
    : photoDocs
    ? [photoDocs]
    : [];

  if (!docsArray.length) {
    return Array.isArray(photoDocs) ? [] : null;
  }

  const validDocs = docsArray.filter(Boolean);
  const ownerLookup = validDocs.length ? await buildOwnerLookup(validDocs) : new Map();
  const format = (doc) =>
    doc ? formatPhotoResponse(doc, ownerLookup, currentUserId) : null;

  if (Array.isArray(photoDocs)) {
    return docsArray.map(format);
  }

  return format(docsArray[0]);
};

const getOptionalUserId = (req) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.userId;
    return mongoose.Types.ObjectId.isValid(userId) ? userId : null;
  } catch {
    return null;
  }
};

// 📸 Obtener todas las fotos
export const getAllPhotos = async (req, res) => {
  try {
    const { country, year, sortBy } = req.query;
    const currentUserId = getOptionalUserId(req);

    const filter = { hidden: false };

    if (country) {
      const normalizedCountry = country.toString().trim();
      const countryRegex = new RegExp(`^${normalizedCountry}$`, "i");
      const owners = await EmailEntry.find({ country: countryRegex })
        .select("_id")
        .lean();
      const ownerIds = owners.map((owner) => owner._id);

      filter.$or = [
        { country: countryRegex },
        ...(ownerIds.length ? [{ owner: { $in: ownerIds } }] : []),
      ];
    }

    if (year) {
      const parsedYear = Number(year);
      if (!Number.isNaN(parsedYear)) {
        filter.year = parsedYear;
      }
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "likes") sortOptions = { likes: -1 };
    if (sortBy === "oldest") sortOptions = { createdAt: 1 };

    const photos = await Photo.find(filter).sort(sortOptions).lean();
    const formattedPhotos = await enrichPhotosWithOwners(photos, currentUserId);
    res.status(200).json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las fotos", error });
  }
};

// ➕ Subir una nueva foto
export const addPhoto = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      publicId,
      year,
      owner,
      likes,
      dominantColor,
    } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const parsedYear =
      year === null || year === "" || year === undefined ? undefined : Number(year);
    const currentYear = new Date().getFullYear();

    if (
      parsedYear !== undefined &&
      (Number.isNaN(parsedYear) || parsedYear < 1882 || parsedYear > currentYear)
    ) {
      return res.status(400).json({ message: "El año no es válido" });
    }

    let ownerCountry = null;
    if (owner) {
      const userOwner = await EmailEntry.findById(owner);
      if (userOwner && userOwner.country) {
        ownerCountry = userOwner.country;
      }
    }

    const newPhotoData = {
      title,
      description,
      imageUrl,
      publicId,
      owner,
      likes: likes || 0,
      hidden: false,
      hideReason: "",
      country: ownerCountry,
    };

    if (Array.isArray(dominantColor)) {
      newPhotoData.dominantColor = dominantColor;
    }

    if (parsedYear !== undefined) {
      newPhotoData.year = parsedYear;
    }

    const newPhoto = await Photo.create(newPhotoData);

    res.status(201).json(newPhoto);
  } catch (error) {
    console.error("Error al agregar la foto:", error);
    res.status(500).json({ message: "Error al agregar la foto", error });
  }
};

export const updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, year, hidden, hideReason } = req.body;

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ message: "Foto no encontrada" });
    }

    if (title !== undefined) {
      photo.title = title;
    }

    if (description !== undefined) {
      photo.description = description;
    }

    if (year !== undefined) {
      const parsedYear =
        year === null || year === "" ? undefined : Number(year);
      const currentYear = new Date().getFullYear();

      if (
        parsedYear !== undefined &&
        (Number.isNaN(parsedYear) || parsedYear < 1882 || parsedYear > currentYear)
      ) {
        return res.status(400).json({ message: "El año no es válido" });
      }

      if (parsedYear === undefined) {
        photo.year = undefined;
      } else {
        photo.year = parsedYear;
      }
    }

    if (hidden !== undefined) {
      photo.hidden = Boolean(hidden);
      photo.hideReason = hidden
        ? hideReason || "Ocultada por un administrador"
        : null;
    }

    const savedPhoto = await photo.save();
    const formatted = await enrichPhotosWithOwners(savedPhoto);
    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error al actualizar la foto:", error);
    res.status(500).json({ message: "Error al actualizar la foto", error });
  }
};

// Dar like (simple)
export const likePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autorizado." });
    }

    const userExists = await EmailEntry.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const likedPhoto = await Photo.findOneAndUpdate(
      { _id: id, likedBy: { $ne: userId } },
      { $addToSet: { likedBy: userId }, $inc: { likes: 1 } },
      { new: true }
    );

    if (likedPhoto) {
      return res
        .status(200)
        .json({ message: "Like agregado", likes: likedPhoto.likes, liked: true });
    }

    const unlikedPhoto = await Photo.findOneAndUpdate(
      { _id: id, likedBy: userId },
      { $pull: { likedBy: userId }, $inc: { likes: -1 } },
      { new: true }
    );

    if (unlikedPhoto) {
      return res
        .status(200)
        .json({ message: "Like eliminado", likes: unlikedPhoto.likes, liked: false });
    }

    return res.status(404).json({ message: "Foto no encontrada" });
  } catch (error) {
    res.status(500).json({ message: "Error al dar like", error });
  }
};

// Eliminar foto
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Photo.findById(id);
    if (!photo) return res.status(404).json({ message: "Foto no encontrada" });

    await Photo.findByIdAndDelete(id);
    res.status(200).json({ message: "Foto eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar la foto", error });
  }
};


// 📊 Obtener la más vieja, más nueva y más likeada
export const getHighlightedPhotos = async (req, res) => {
   try {
    const [mostLiked, oldestByYear, newestUploaded] = await Promise.all([
      Photo.findOne({ hidden: false }).sort({ likes: -1 }).lean(),
      Photo.findOne({ year: { $ne: null }, hidden: false }).sort({ year: 1 }).lean(),
      Photo.findOne({ hidden: false }).sort({ createdAt: -1 }).lean(),
    ]);

    const [formattedMostLiked, formattedOldest, formattedNewest] =
      await enrichPhotosWithOwners([mostLiked, oldestByYear, newestUploaded]);

    res.json({
      mostLiked: formattedMostLiked,
      oldestByYear: formattedOldest,
      newestUploaded: formattedNewest
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener fotos destacadas", error });
  }
};

export const hidePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { hideReason } = req.body;

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ message: "Foto no encontrada" });
    }

    photo.hidden = true;
    photo.hideReason = hideReason || "Ocultada por un administrador";
    await photo.save();

    res.status(200).json({ message: "Foto ocultada correctamente", photo });
  } catch (error) {
    res.status(500).json({ message: "Error al ocultar la foto", error });
  }
};

export const unhidePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ message: "Foto no encontrada" });
    }

    photo.hidden = false;
    photo.hideReason = null;
    await photo.save();

    res.status(200).json({ message: "Foto restaurada correctamente", photo });
  } catch (error) {
    res.status(500).json({ message: "Error al restaurar la foto", error });
  }
};

// 📸 Obtener todas las fotos de un usuario
export const getPhotosByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    let photos = await Photo.find({ owner: userId }).lean();

    if (!photos.length) {
      const user = await EmailEntry.findById(userId);
      if (user?.email) {
        photos = await Photo.find({ owner: user.email }).lean();
      }
    }

    const formattedPhotos = await enrichPhotosWithOwners(photos);
    res.status(200).json(formattedPhotos);
  } catch (error) {
    console.error("Error al obtener fotos del usuario:", error);
    res.status(500).json({ message: "Error al obtener fotos del usuario", error });
  }
};

export const getAllPhotosAdmin = async (req, res) => {
  try {
    const photos = await Photo.find()
      .sort({ createdAt: -1 })
      .lean();
    const formattedPhotos = await enrichPhotosWithOwners(photos);
    res.status(200).json(formattedPhotos);
  } catch (err) {
    console.error("Error al obtener todas las fotos:", err);
    res.status(500).json({ error: "Error al obtener fotos" });
  }
};
