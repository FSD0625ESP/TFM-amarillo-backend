import mongoose from "mongoose";
import Photo from "../models/photo.js";
import EmailEntry from "../models/EmailEntry.js";

export const getPublicStats = async (req, res) => {
  try {
    // 1) Fotos visibles
    const photos = await Photo.countDocuments({ hidden: false });

    // 2) Colaboradores = owners únicos con al menos 1 foto visible
    const owners = await Photo.distinct("owner", {
      hidden: false,
      owner: { $ne: null },
    });

    const validOwnerIds = owners.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    // Filtrar owners que realmente existen en EmailEntry
    const existingOwners = await EmailEntry.find(
      { _id: { $in: validOwnerIds } },
      { _id: 1, country: 1 }
    );

    const collaborators = existingOwners.length;

    // 3) Países participantes = países de esos owners existentes
    const countries = new Set(existingOwners.map((entry) => entry.country)).size;

    res.json({ photos, collaborators, countries });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json({ message: "Error obteniendo estadísticas" });
  }
};

export const getTopCountries = async (_req, res) => {
  try {
    const pipeline = [
      { $match: { hidden: false, owner: { $ne: null } } },
      { $group: { _id: "$owner" } }, // owners únicos
      { $match: { _id: { $type: "objectId" } } }, // filtrar IDs válidos
      {
        $lookup: {
          from: "emailentries",
          localField: "_id",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: "$owner" },
      { $match: { "owner.country": { $ne: null } } },
      {
        $group: {
          _id: { $toUpper: "$owner.country" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, country: "$_id", count: 1 } },
    ];

    const topCountries = await Photo.aggregate(pipeline);
    res.json({ topCountries });
  } catch (error) {
    console.error("Error obteniendo top países:", error);
    res.status(500).json({ message: "Error obteniendo top países" });
  }
};
