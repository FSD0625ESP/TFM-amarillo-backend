import Photo from "../models/photo.js";

// 📸 Obtener todas las fotos
export const getAllPhotos = async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.status(200).json(photos);
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
      likes,
    });

    res.status(201).json(newPhoto);
  } catch (error) {
    console.error("Error al agregar la foto:", error);
    res.status(500).json({ message: "Error al agregar la foto", error });
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
    const mostLiked = await Photo.findOne().sort({ likes: -1 });
    const oldestByYear = await Photo.findOne({ year: { $ne: null } }).sort({ year: 1 });
    const newestUploaded = await Photo.findOne().sort({ createdAt: -1 });

    res.json({
      mostLiked,
      oldestByYear,
      newestUploaded
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener fotos destacadas", error });
  }
};
