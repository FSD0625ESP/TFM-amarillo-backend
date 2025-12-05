import mongoose from "mongoose";
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
    .select("email name")
    .lean();

  return owners.reduce((map, owner) => {
    map.set(owner._id.toString(), owner);
    return map;
  }, new Map());
};

const formatPhotoResponse = (photoDoc, ownerLookup) => {
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

  return {
    ...photo,
    owner: ownerInfo,
    ownerEmail: ownerInfo?.email ?? null,
  };
};

const enrichPhotosWithOwners = async (photoDocs) => {
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
  const format = (doc) => (doc ? formatPhotoResponse(doc, ownerLookup) : null);

  if (Array.isArray(photoDocs)) {
    return docsArray.map(format);
  }

  return format(docsArray[0]);
};

// 📸 Obtener todas las fotos
export const getAllPhotos = async (req, res) => {
  try {
    const photos = await Photo.find({ hidden: false })
      .sort({ createdAt: -1 })
      .lean();
    const formattedPhotos = await enrichPhotosWithOwners(photos);
    res.status(200).json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las fotos", error });
  }
};

// ➕ Subir una nueva foto
export const addPhoto = async (req, res) => {
  try {
    const { title, description, imageUrl, publicId, year, owner, likes } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const newPhoto = await Photo.create({
      title,
      description,
      imageUrl,
      publicId,
      year,
      owner,
      likes: likes || 0,
      hidden: false,
      hideReason: "",
    });

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
      if (year === null || year === "") {
        photo.year = undefined;
      } else {
        const parsedYear = Number(year);
        if (!Number.isNaN(parsedYear)) {
          photo.year = parsedYear;
        }
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
    const photo = await Photo.findById(id);
    if (!photo) return res.status(404).json({ message: "Foto no encontrada" });

    photo.likes += 1;
    await photo.save();
    res.status(200).json({ message: "Like agregado", likes: photo.likes });
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
