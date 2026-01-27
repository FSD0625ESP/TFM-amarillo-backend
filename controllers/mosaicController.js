import sharp from "sharp";
import Tile from "../models/Tile.js";
import Photo from "../models/photo.js";
import MosaicSnapshot from "../models/MosaicSnapshot.js";
import MosaicConfig from "../models/MosaicConfig.js";
import cloudinary from "../config/cloudinary.js";
import { extractColors } from "../utils/extractColors.js";

async function fetchImageBuffer(url) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API no disponible en este entorno.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const uploadToCloudinary = (buffer, { folder, publicId, format }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        format,
        fetch_format: "auto",
        transformation: [{ quality: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

const createSolidTile = (color, width, height) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: color[0], g: color[1], b: color[2] },
    },
  })
    .png()
    .toBuffer();

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results.filter(Boolean);
};

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const generateMainImageTilesInternal = async ({
  mainImageUrl,
  tileWidth = 10,
  tileHeight = 10,
  mosaicKey = "default",
  overwrite = true,
}) => {
  if (!mainImageUrl) {
    throw createHttpError("mainImageUrl es requerido.", 400);
  }

  if (tileWidth <= 0 || tileHeight <= 0) {
    throw createHttpError("tileWidth/tileHeight inválidos.", 400);
  }

  if (overwrite) {
    await Tile.deleteMany({ mosaicKey });
  }

  const imageBuffer = await fetchImageBuffer(mainImageUrl);
  const mainImage = sharp(imageBuffer);
  const metadata = await mainImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw createHttpError("No se pudo leer el tamaño de la imagen.", 400);
  }

  const mainWidth = metadata.width;
  const mainHeight = metadata.height;
  const cols = Math.ceil(mainWidth / tileWidth);
  const rows = Math.ceil(mainHeight / tileHeight);

  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = col * tileWidth;
      const top = row * tileHeight;
      const width = Math.min(tileWidth, mainWidth - left);
      const height = Math.min(tileHeight, mainHeight - top);

      const tileBuffer = await mainImage
        .clone()
        .extract({ left, top, width, height })
        .toBuffer();

      const tileColors = await extractColors(tileBuffer, 1);
      const dominantColor = tileColors[0] || [128, 128, 128];

      tiles.push({
        mosaicKey,
        row,
        col,
        left,
        top,
        width,
        height,
        color: dominantColor,
        matchedUrl: "",
      });
    }
  }

  if (tiles.length) {
    await Tile.insertMany(tiles);
  }

  return { rows, cols, count: tiles.length };
};

const matchTilesInternal = async ({ mosaicKey = "default", allowReuse = true }) => {
  const tiles = await Tile.find({ mosaicKey }).lean();
  if (!tiles.length) {
    throw createHttpError("No hay tiles para ese mosaicKey.", 404);
  }

  const photos = await Photo.find({
    hidden: false,
    dominantColor: { $size: 3 },
  }).lean();

  if (!photos.length) {
    throw createHttpError("No hay fotos con dominantColor.", 404);
  }

  const availablePhotos = allowReuse ? photos : [...photos];
  const bulkOps = [];

  for (const tile of tiles) {
    let bestPhoto = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const tileColor =
      Array.isArray(tile.color) && tile.color.length === 3
        ? tile.color
        : [128, 128, 128];

    for (const photo of availablePhotos) {
      if (!Array.isArray(photo.dominantColor) || photo.dominantColor.length !== 3) {
        continue;
      }
      const distance = colorDistance(tileColor, photo.dominantColor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPhoto = photo;
      }
    }

    if (bestPhoto) {
      bulkOps.push({
        updateOne: {
          filter: { _id: tile._id },
          update: {
            matchedPhoto: bestPhoto._id,
            matchedUrl: bestPhoto.imageUrl,
          },
        },
      });

      if (!allowReuse) {
        const index = availablePhotos.findIndex(
          (photo) => photo._id.toString() === bestPhoto._id.toString()
        );
        if (index >= 0) {
          availablePhotos.splice(index, 1);
        }
      }
    }
  }

  if (bulkOps.length) {
    await Tile.bulkWrite(bulkOps);
  }

  return { matched: bulkOps.length, allowReuse };
};

const renderMosaicInternal = async ({
  mosaicKey = "default",
  outputWidth,
  outputHeight,
  folder = "Mosaic/renders",
  publicIdPrefix = "mosaic",
  format = "jpg",
  concurrency = 6,
}) => {
  const tiles = await Tile.find({ mosaicKey }).lean();
  if (!tiles.length) {
    throw createHttpError("No hay tiles para ese mosaicKey.", 404);
  }

  const baseWidth = tiles.reduce(
    (maxWidth, tile) => Math.max(maxWidth, tile.left + tile.width),
    0
  );
  const baseHeight = tiles.reduce(
    (maxHeight, tile) => Math.max(maxHeight, tile.top + tile.height),
    0
  );

  const targetWidth = outputWidth ? Number(outputWidth) : baseWidth;
  const targetHeight = outputHeight ? Number(outputHeight) : baseHeight;

  if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) {
    throw createHttpError("outputWidth/outputHeight inválidos.", 400);
  }

  const scaleX = targetWidth / baseWidth;
  const scaleY = targetHeight / baseHeight;

  const compositeInputs = await mapWithConcurrency(
    tiles,
    Math.max(1, Math.min(16, Number(concurrency) || 6)),
    async (tile) => {
      const color = Array.isArray(tile.color) ? tile.color : [128, 128, 128];
      const [r, g, b] = color;
      const width = Math.max(1, Math.round(tile.width * scaleX));
      const height = Math.max(1, Math.round(tile.height * scaleY));
      const left = Math.round(tile.left * scaleX);
      const top = Math.round(tile.top * scaleY);

      let inputBuffer;
      if (tile.matchedUrl) {
        try {
          const imgBuffer = await fetchImageBuffer(tile.matchedUrl);
          inputBuffer = await sharp(imgBuffer)
            .resize(width, height, { fit: "cover" })
            .toBuffer();
        } catch (error) {
          console.error("Error cargando imagen tile:", error);
          inputBuffer = await createSolidTile([r, g, b], width, height);
        }
      } else {
        inputBuffer = await createSolidTile([r, g, b], width, height);
      }

      return { input: inputBuffer, left, top };
    }
  );

  const mosaicBuffer = await sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(compositeInputs)
    .toFormat(format)
    .toBuffer();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const publicId = `${publicIdPrefix}-${mosaicKey}-${timestamp}`;
  const uploadResult = await uploadToCloudinary(mosaicBuffer, {
    folder,
    publicId,
    format,
  });

  const snapshot = await MosaicSnapshot.create({
    mosaicKey,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    width: targetWidth,
    height: targetHeight,
    tilesCount: tiles.length,
    format,
  });

  return snapshot;
};

export const generateMainImageTiles = async (req, res) => {
  try {
    const {
      mainImageUrl,
      tileWidth = 10,
      tileHeight = 10,
      mosaicKey = "default",
      overwrite = true,
    } = req.body;

    const { rows, cols, count } = await generateMainImageTilesInternal({
      mainImageUrl,
      tileWidth,
      tileHeight,
      mosaicKey,
      overwrite,
    });

    return res.status(200).json({
      message: "Tiles generados correctamente.",
      mosaicKey,
      rows,
      cols,
      count,
    });
  } catch (error) {
    console.error("Error al generar tiles:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Error al generar tiles." });
  }
};

export const listTiles = async (req, res) => {
  try {
    const { mosaicKey = "default" } = req.query;
    const tiles = await Tile.find({ mosaicKey }).lean();
    return res.status(200).json(tiles);
  } catch (error) {
    console.error("Error al listar tiles:", error);
    return res.status(500).json({ message: "Error al listar tiles." });
  }
};

export const renderMosaic = async (req, res) => {
  try {
    const {
      mosaicKey = "default",
      outputWidth,
      outputHeight,
      folder = "Mosaic/renders",
      publicIdPrefix = "mosaic",
      format = "jpg",
      concurrency = 6,
    } = req.body;

    const snapshot = await renderMosaicInternal({
      mosaicKey,
      outputWidth,
      outputHeight,
      folder,
      publicIdPrefix,
      format,
      concurrency,
    });

    return res.status(200).json({
      message: "Mosaico generado y guardado en Cloudinary.",
      snapshot,
    });
  } catch (error) {
    console.error("Error al renderizar mosaico:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Error al renderizar mosaico." });
  }
};

export const listMosaicSnapshots = async (req, res) => {
  try {
    const { mosaicKey } = req.query;
    const filter = mosaicKey ? { mosaicKey } : {};
    const snapshots = await MosaicSnapshot.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(snapshots);
  } catch (error) {
    console.error("Error listando mosaicos:", error);
    return res.status(500).json({ message: "Error listando mosaicos." });
  }
};

export const getLatestMosaicSnapshot = async (req, res) => {
  try {
    const { mosaicKey = "default" } = req.query;
    const snapshot = await MosaicSnapshot.findOne({ mosaicKey })
      .sort({ createdAt: -1 })
      .lean();
    if (!snapshot) {
      return res.status(404).json({ message: "No hay mosaicos publicados." });
    }
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error("Error obteniendo mosaico más reciente:", error);
    return res
      .status(500)
      .json({ message: "Error obteniendo mosaico más reciente." });
  }
};

export const getMosaicConfig = async (req, res) => {
  try {
    const config = await MosaicConfig.findOne().lean();
    return res.status(200).json(config || { enabled: false });
  } catch (error) {
    console.error("Error obteniendo config de mosaico:", error);
    return res.status(500).json({ message: "Error obteniendo config de mosaico." });
  }
};

export const updateMosaicConfig = async (req, res) => {
  try {
    const {
      enabled = false,
      mainImageUrl = "",
      tileWidth = 20,
      tileHeight = 20,
      mosaicKey = "default",
      mosaicSize = 2000,
      allowReuse = true,
      intervalHours = 24,
    } = req.body;

    if (enabled && !mainImageUrl) {
      return res.status(400).json({
        message: "mainImageUrl es requerido para activar el modo automático.",
      });
    }

    const update = {
      enabled: Boolean(enabled),
      mainImageUrl,
      tileWidth: Number(tileWidth) || 20,
      tileHeight: Number(tileHeight) || 20,
      mosaicKey: mosaicKey || "default",
      mosaicSize: Number(mosaicSize) || 2000,
      allowReuse: Boolean(allowReuse),
      intervalHours: Math.max(1, Number(intervalHours) || 24),
      updatedAt: new Date(),
    };

    const config = await MosaicConfig.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    return res.status(200).json(config);
  } catch (error) {
    console.error("Error actualizando config de mosaico:", error);
    return res.status(500).json({ message: "Error actualizando config de mosaico." });
  }
};

export const deleteMosaicSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID requerido." });
    }

    const snapshot = await MosaicSnapshot.findById(id);
    if (!snapshot) {
      return res.status(404).json({ message: "Mosaico no encontrado." });
    }

    if (snapshot.publicId) {
      const destroyResult = await cloudinary.uploader.destroy(snapshot.publicId, {
        resource_type: "image",
      });
      const result = destroyResult?.result;
      if (result && result !== "ok" && result !== "not found") {
        return res.status(502).json({
          message: "No se pudo eliminar el mosaico en Cloudinary.",
          result,
        });
      }
    }

    await MosaicSnapshot.deleteOne({ _id: id });

    return res.status(200).json({ message: "Mosaico eliminado.", id });
  } catch (error) {
    console.error("Error eliminando mosaico:", error);
    return res.status(500).json({ message: "Error eliminando mosaico." });
  }
};

export const uploadMainImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Archivo requerido." });
    }

    const { folder = "Mosaic/main" } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const publicId = `main-image-${timestamp}`;

    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder,
      publicId,
      format: "jpg",
    });

    return res.status(200).json({
      message: "Imagen principal subida correctamente.",
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
    });
  } catch (error) {
    console.error("Error subiendo imagen principal:", error);
    return res
      .status(500)
      .json({ message: "Error subiendo imagen principal." });
  }
};

export const runMosaicPipelineFromConfig = async (configDoc) => {
  const config = configDoc instanceof MosaicConfig ? configDoc : null;
  if (!config) {
    throw new Error("Config inválida.");
  }

  const {
    mainImageUrl,
    tileWidth,
    tileHeight,
    mosaicKey,
    mosaicSize,
    allowReuse,
  } = config;

  await generateMainImageTilesInternal({
    mainImageUrl,
    tileWidth,
    tileHeight,
    mosaicKey,
    overwrite: true,
  });

  await matchTilesInternal({ mosaicKey, allowReuse });

  const snapshot = await renderMosaicInternal({
    mosaicKey,
    outputWidth: mosaicSize,
    outputHeight: mosaicSize,
    folder: "Mosaic/renders",
    publicIdPrefix: "mosaic",
    format: "jpg",
    concurrency: 6,
  });

  config.lastRunAt = new Date();
  await config.save();

  return snapshot;
};

const colorDistance = (color1, color2) => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt(
    Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2)
  );
};

export const matchTilesToPhotos = async (req, res) => {
  try {
    const { mosaicKey = "default", allowReuse = true } = req.body;

    const { matched } = await matchTilesInternal({ mosaicKey, allowReuse });

    return res.status(200).json({
      message: "Tiles emparejados correctamente.",
      mosaicKey,
      matched,
      allowReuse,
    });
  } catch (error) {
    console.error("Error al emparejar tiles:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Error al emparejar tiles." });
  }
};
