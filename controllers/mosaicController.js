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

// Helper para asegurar rangos 0-100
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const getOptimizedUrl = (url, { width, height, quality = "auto", sharpness = 0 } = {}) => {
  if (!url || !url.includes("/upload/")) return url;
  const safeWidth = Math.max(1, Math.round(Number(width) || 0));
  const safeHeight = Math.max(1, Math.round(Number(height) || 0));
  
  const sizeParams =
    safeWidth && safeHeight ? `w_${safeWidth},h_${safeHeight},c_fill,` : "";
    
  // Aplicamos sharpness solo si es > 0
  const effectParams = sharpness > 0 ? `,e_sharpen:${sharpness}` : "";
  
  const transformation = `${sizeParams}q_${quality},f_auto${effectParams}`;
  return url.replace("/upload/", `/upload/${transformation}/`);
};

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
  if (!mainImageUrl) throw createHttpError("mainImageUrl es requerido.", 400);
  if (tileWidth <= 0 || tileHeight <= 0) throw createHttpError("tileWidth/tileHeight inválidos.", 400);

  if (overwrite) await Tile.deleteMany({ mosaicKey });

  const imageBuffer = await fetchImageBuffer(mainImageUrl);
  const mainImage = sharp(imageBuffer);
  const metadata = await mainImage.metadata();
  if (!metadata.width || !metadata.height) throw createHttpError("No se pudo leer el tamaño de la imagen.", 400);

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
      const tileBuffer = await mainImage.clone().extract({ left, top, width, height }).toBuffer();
      const tileColors = await extractColors(tileBuffer, 1);
      const dominantColor = tileColors[0] || [128, 128, 128];
      tiles.push({ mosaicKey, row, col, left, top, width, height, color: dominantColor, matchedUrl: "" });
    }
  }
  if (tiles.length) await Tile.insertMany(tiles);
  return { rows, cols, count: tiles.length };
};

const matchTilesInternal = async ({
  mosaicKey = "default",
  allowReuse = true,
  reuseAfterExhaustion = false,
  matchPoolSize = 5,
  mismatchDistanceThreshold = 150,
  minUseOnce = true,
  maxUsesPerPhoto = null,
}) => {
  const tiles = await Tile.find({ mosaicKey }).lean();
  if (!tiles.length) throw createHttpError("No hay tiles para ese mosaicKey.", 404);

  // Shuffle para distribuir los emparejamientos por el lienzo
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  const photos = await Photo.find({ hidden: false, dominantColor: { $size: 3 } }).lean();
  if (!photos.length) throw createHttpError("No hay fotos con dominantColor.", 404);

  const poolSize = Math.max(1, Math.min(Number(matchPoolSize) || 1, photos.length));
  const mustUseOnce = Boolean(minUseOnce);
  const maxUses = Number.isFinite(Number(maxUsesPerPhoto)) && Number(maxUsesPerPhoto) > 0
    ? Math.floor(Number(maxUsesPerPhoto))
    : null;
  const mismatchThreshold =
    mismatchDistanceThreshold === null ||
    mismatchDistanceThreshold === undefined ||
    mismatchDistanceThreshold === ""
      ? null
      : Number.isFinite(Number(mismatchDistanceThreshold)) && Number(mismatchDistanceThreshold) >= 0
        ? Number(mismatchDistanceThreshold)
        : null;

  const usageCount = new Map();
  let usedOnceCount = 0;

  const hasUsed = (id) => (usageCount.get(id) || 0) > 0;
  const exhausted = () => usedOnceCount >= photos.length;
  const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

  const canUseBase = (photoId) => {
    if (!allowReuse && !reuseAfterExhaustion) return !hasUsed(photoId);
    if (!allowReuse && reuseAfterExhaustion) return exhausted() ? true : !hasUsed(photoId);
    return true;
  };

  const canUseWithMax = (photoId, ignoreMax = false) => {
    if (!canUseBase(photoId)) return false;
    if (ignoreMax || maxUses === null) return true;
    return (usageCount.get(photoId) || 0) < maxUses;
  };

  const getTileCandidates = (tile) => {
    const tileColor = Array.isArray(tile.color) && tile.color.length === 3 ? tile.color : [128, 128, 128];
    const scored = photos.map((photo) => {
      if (!Array.isArray(photo.dominantColor) || photo.dominantColor.length !== 3) {
        return null;
      }
      return { photo, distance: colorDistance(tileColor, photo.dominantColor) };
    }).filter(Boolean);

    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, poolSize);
  };

  const bulkOps = [];

  for (const tile of tiles) {
    const candidates = getTileCandidates(tile);
    let chosen = null;
    const shouldRandomize =
      mismatchThreshold !== null &&
      candidates.length > 0 &&
      candidates[0].distance > mismatchThreshold;

    if (mustUseOnce && usedOnceCount < photos.length) {
      const unusedCandidates = candidates.filter(({ photo }) => !hasUsed(photo._id) && canUseWithMax(photo._id));
      if (unusedCandidates.length) {
        chosen =
          shouldRandomize && unusedCandidates.length > 1
            ? pickRandom(unusedCandidates)
            : unusedCandidates[0];
      }
    }

    if (!chosen) {
      const allowedCandidates = candidates.filter(({ photo }) => canUseWithMax(photo._id));
      if (allowedCandidates.length) {
        chosen =
          shouldRandomize && allowedCandidates.length > 1
            ? pickRandom(allowedCandidates)
            : allowedCandidates[0];
      }
    }

    if (!chosen) {
      // Fallback: buscamos en todas las fotos si el pool quedó bloqueado por límites
      const tileColor = Array.isArray(tile.color) && tile.color.length === 3 ? tile.color : [128, 128, 128];
      const allScored = photos.map((photo) => ({
        photo,
        distance: colorDistance(tileColor, photo.dominantColor || [128, 128, 128]),
      })).sort((a, b) => a.distance - b.distance);

      const shouldRandomizeAll =
        mismatchThreshold !== null &&
        allScored.length > 0 &&
        allScored[0].distance > mismatchThreshold;

      const allowedAll = allScored.filter(({ photo }) => canUseWithMax(photo._id));
      if (allowedAll.length) {
        chosen =
          shouldRandomizeAll && allowedAll.length > 1
            ? pickRandom(allowedAll)
            : allowedAll[0];
      }

      if (!chosen && maxUses !== null) {
        // Si el límite máximo impide completar, lo relajamos para llenar el mosaico
        const allowedAllIgnoreMax = allScored.filter(({ photo }) => canUseWithMax(photo._id, true));
        if (allowedAllIgnoreMax.length) {
          chosen =
            shouldRandomizeAll && allowedAllIgnoreMax.length > 1
              ? pickRandom(allowedAllIgnoreMax)
              : allowedAllIgnoreMax[0];
        }
      }
    }

    if (chosen?.photo) {
      const photoId = chosen.photo._id;
      const currentCount = usageCount.get(photoId) || 0;
      usageCount.set(photoId, currentCount + 1);
      if (currentCount === 0) usedOnceCount += 1;

      bulkOps.push({
        updateOne: {
          filter: { _id: tile._id },
          update: { matchedPhoto: photoId, matchedUrl: chosen.photo.imageUrl },
        },
      });
    }
  }
  if (bulkOps.length) await Tile.bulkWrite(bulkOps);
  return {
    matched: bulkOps.length,
    allowReuse,
    reuseAfterExhaustion,
    matchPoolSize: poolSize,
    mismatchDistanceThreshold: mismatchThreshold,
    minUseOnce: mustUseOnce,
    maxUsesPerPhoto: maxUses,
  };
};

const renderMosaicInternal = async ({
  mosaicKey = "default",
  outputWidth,
  outputHeight,
  folder = "Mosaic/renders",
  publicIdPrefix = "mosaic",
  format = "jpg",
  concurrency = 3,
  // Parámetros opcionales del request
  sharpness, 
  overlayOpacity,
  mainImageUrl
}) => {
  // 1. Configuración y Fallbacks
  const config = await MosaicConfig.findOne({ mosaicKey }).lean();
  
  const finalOpacity = overlayOpacity !== undefined 
    ? clamp(Number(overlayOpacity), 0, 100) 
    : (config?.overlayOpacity || 0);

  const finalSharpness = sharpness !== undefined 
    ? clamp(Number(sharpness), 0, 100) 
    : (config?.sharpness || 0);

  const finalMainImage = mainImageUrl || config?.mainImageUrl;

  const tiles = await Tile.find({ mosaicKey }).lean();
  if (!tiles.length) throw createHttpError("No hay tiles para ese mosaicKey.", 404);

  const baseWidth = tiles.reduce((acc, t) => Math.max(acc, t.left + t.width), 0);
  const baseHeight = tiles.reduce((acc, t) => Math.max(acc, t.top + t.height), 0);

  const targetWidth = outputWidth ? Number(outputWidth) : baseWidth;
  const targetHeight = outputHeight ? Number(outputHeight) : baseHeight;
  if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) throw createHttpError("outputWidth/outputHeight inválidos.", 400);

  const scaleX = targetWidth / baseWidth;
  const scaleY = targetHeight / baseHeight;

  // 2. Generación del Mosaico
  const compositeInputs = await mapWithConcurrency(
    tiles,
    Math.max(1, Math.min(16, Number(concurrency) || 6)),
    async (tile) => {
      const color = Array.isArray(tile.color) ? tile.color : [128, 128, 128];
      const width = Math.max(1, Math.round(tile.width * scaleX));
      const height = Math.max(1, Math.round(tile.height * scaleY));
      const left = Math.round(tile.left * scaleX);
      const top = Math.round(tile.top * scaleY);

      let inputBuffer;
      if (tile.matchedUrl) {
        try {
          const optimizedUrl = getOptimizedUrl(tile.matchedUrl, { 
            width, 
            height,
            sharpness: finalSharpness
          });
          const imgBuffer = await fetchImageBuffer(optimizedUrl);
          inputBuffer = await sharp(imgBuffer).resize(width, height, { fit: "cover" }).toBuffer();
        } catch (error) {
          inputBuffer = await createSolidTile(color, width, height);
        }
      } else {
        inputBuffer = await createSolidTile(color, width, height);
      }
      return { input: inputBuffer, left, top };
    }
  );

  // 3. Aplicación del Overlay (CORREGIDO: Forzando PNG)
  if (finalOpacity > 0 && finalMainImage) {
    try {
      console.log(`Aplicando overlay (Opacidad: ${finalOpacity}%)`);
      const mainImgBuffer = await fetchImageBuffer(finalMainImage);
      
      // PASO A: Preparar imagen con 4 canales (sRGB + Alpha)
      const resizedOverlay = await sharp(mainImgBuffer)
        .resize(targetWidth, targetHeight, { fit: "fill" })
        .toColorspace('srgb')
        .ensureAlpha()
        .png() // <--- ESTA ES LA CLAVE: Forzamos formato que soporta transparencia
        .toBuffer(); 

      // PASO B: Ahora aplicamos la transparencia sin miedo
      const transparentOverlay = await sharp(resizedOverlay)
        .linear(
          [1, 1, 1, finalOpacity / 100], // R, G, B, Alpha
          [0, 0, 0, 0]                   // Offsets
        )
        .toBuffer();

      compositeInputs.push({
        input: transparentOverlay,
        left: 0,
        top: 0,
        blend: "over",
      });
    } catch (err) {
      console.error("Error aplicando overlay:", err);
    }
  }

  const mosaicBuffer = await sharp({
    create: { width: targetWidth, height: targetHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(compositeInputs)
    .toFormat(format)
    .toBuffer();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const publicId = `${publicIdPrefix}-${mosaicKey}-${timestamp}`;
  const uploadResult = await uploadToCloudinary(mosaicBuffer, { folder, publicId, format });

  const configSnapshot = {
    tileWidth: config?.tileWidth,
    tileHeight: config?.tileHeight,
    outputWidth: targetWidth,
    outputHeight: targetHeight,
    allowReuse: config?.allowReuse,
    reuseAfterExhaustion: config?.reuseAfterExhaustion,
    matchPoolSize: config?.matchPoolSize,
    mismatchDistanceThreshold: config?.mismatchDistanceThreshold ?? null,
    minUseOnce: config?.minUseOnce,
    maxUsesPerPhoto: config?.maxUsesPerPhoto ?? null,
    sharpness: finalSharpness,
    overlayOpacity: finalOpacity,
    concurrency: Number(concurrency) || 3,
  };

  return await MosaicSnapshot.create({
    mosaicKey,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    width: targetWidth,
    height: targetHeight,
    tilesCount: tiles.length,
    format,
    config: configSnapshot,
  });
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
      concurrency = 3,
      sharpness,
      overlayOpacity,
      mainImageUrl
    } = req.body;

    const snapshot = await renderMosaicInternal({
      mosaicKey,
      outputWidth,
      outputHeight,
      folder,
      publicIdPrefix,
      format,
      concurrency,
      sharpness,
      overlayOpacity,
      mainImageUrl
    });

    return res.status(200).json({ message: "Mosaico generado.", snapshot });
  } catch (error) {
    console.error("Error al renderizar mosaico:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Error al renderizar mosaico." });
  }
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
      enabled = false, mainImageUrl = "", tileWidth = 20, tileHeight = 20, mosaicKey = "default", mosaicSize = 2000,
      allowReuse = true, reuseAfterExhaustion = false, concurrency = 3, intervalHours = 24, refreshSeconds = 30,
      sharpness = 0, overlayOpacity = 0, matchPoolSize = 5, mismatchDistanceThreshold = 150, minUseOnce = true, maxUsesPerPhoto = null,
    } = req.body;

    const parsedMismatchThreshold =
      mismatchDistanceThreshold === null || mismatchDistanceThreshold === undefined || mismatchDistanceThreshold === ""
        ? null
        : Number(mismatchDistanceThreshold);
    const normalizedMismatchThreshold =
      Number.isFinite(parsedMismatchThreshold) && parsedMismatchThreshold >= 0
        ? parsedMismatchThreshold
        : null;

    const update = {
      enabled: Boolean(enabled), mainImageUrl, tileWidth: Number(tileWidth) || 20, tileHeight: Number(tileHeight) || 20,
      mosaicKey: mosaicKey || "default", mosaicSize: Number(mosaicSize) || 2000, allowReuse: Boolean(allowReuse),
      reuseAfterExhaustion: Boolean(reuseAfterExhaustion), concurrency: Math.max(1, Math.min(16, Number(concurrency) || 3)),
      intervalHours: Math.max(1, Number(intervalHours) || 24), refreshSeconds: Math.max(0, Number(refreshSeconds) || 0),
      matchPoolSize: Math.max(1, Number(matchPoolSize) || 1),
      mismatchDistanceThreshold: normalizedMismatchThreshold,
      minUseOnce: Boolean(minUseOnce),
      maxUsesPerPhoto: Number.isFinite(Number(maxUsesPerPhoto)) && Number(maxUsesPerPhoto) > 0
        ? Math.floor(Number(maxUsesPerPhoto))
        : null,
      sharpness: Number(sharpness) || 0, overlayOpacity: Number(overlayOpacity) || 0, updatedAt: new Date(),
    };

    const config = await MosaicConfig.findOneAndUpdate({}, update, { new: true, upsert: true, setDefaultsOnInsert: true });
    return res.status(200).json(config);
  } catch (error) {
    console.error("Error actualizando config de mosaico:", error);
    return res.status(500).json({ message: "Error actualizando config de mosaico." });
  }
};

export const deleteMosaicSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "ID requerido." });

    const snapshot = await MosaicSnapshot.findById(id);
    if (!snapshot) return res.status(404).json({ message: "Mosaico no encontrado." });

    if (snapshot.publicId) {
      await cloudinary.uploader.destroy(snapshot.publicId, { resource_type: "image" });
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
    if (!req.file) return res.status(400).json({ message: "Archivo requerido." });

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
    return res.status(500).json({ message: "Error subiendo imagen principal." });
  }
};

export const runMosaicPipelineFromConfig = async (configDoc) => {
  const config = configDoc instanceof MosaicConfig ? configDoc : null;
  if (!config) throw new Error("Config inválida.");

  const {
    mainImageUrl, tileWidth, tileHeight, mosaicKey, mosaicSize,
    allowReuse, reuseAfterExhaustion, concurrency, sharpness, overlayOpacity,
    matchPoolSize, mismatchDistanceThreshold, minUseOnce, maxUsesPerPhoto,
  } = config;

  await generateMainImageTilesInternal({
    mainImageUrl, tileWidth, tileHeight, mosaicKey, overwrite: true,
  });

  await matchTilesInternal({
    mosaicKey,
    allowReuse,
    reuseAfterExhaustion,
    matchPoolSize,
    mismatchDistanceThreshold,
    minUseOnce,
    maxUsesPerPhoto,
  });

  const snapshot = await renderMosaicInternal({
    mosaicKey,
    outputWidth: mosaicSize,
    outputHeight: mosaicSize,
    folder: "Mosaic/renders",
    publicIdPrefix: "mosaic",
    format: "jpg",
    concurrency: Math.max(1, Math.min(16, Number(concurrency) || 3)),
    sharpness,
    overlayOpacity
  });

  config.lastRunAt = new Date();
  await config.save();
  return snapshot;
};

const colorDistance = (color1, color2) => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
};

export const matchTilesToPhotos = async (req, res) => {
  try {
    const {
      mosaicKey = "default",
      allowReuse = true,
      reuseAfterExhaustion = false,
      matchPoolSize,
      mismatchDistanceThreshold,
      minUseOnce,
      maxUsesPerPhoto,
    } = req.body;

    const config = await MosaicConfig.findOne({ mosaicKey }).lean();
    const resolvedMatchPoolSize =
      matchPoolSize !== undefined && matchPoolSize !== null
        ? matchPoolSize
        : config?.matchPoolSize;
    const resolvedMinUseOnce =
      typeof minUseOnce === "boolean" ? minUseOnce : config?.minUseOnce;
    const resolvedMaxUsesPerPhoto =
      maxUsesPerPhoto !== undefined && maxUsesPerPhoto !== null
        ? maxUsesPerPhoto
        : config?.maxUsesPerPhoto;
    const resolvedMismatchThreshold =
      mismatchDistanceThreshold !== undefined && mismatchDistanceThreshold !== null
        ? mismatchDistanceThreshold
        : config?.mismatchDistanceThreshold;

    const { matched } = await matchTilesInternal({
      mosaicKey,
      allowReuse,
      reuseAfterExhaustion,
      matchPoolSize: resolvedMatchPoolSize,
      mismatchDistanceThreshold: resolvedMismatchThreshold,
      minUseOnce: resolvedMinUseOnce,
      maxUsesPerPhoto: resolvedMaxUsesPerPhoto,
    });
    return res.status(200).json({
      message: "Tiles emparejados correctamente.",
      mosaicKey,
      matched,
      allowReuse,
      reuseAfterExhaustion,
      matchPoolSize: resolvedMatchPoolSize,
      mismatchDistanceThreshold: resolvedMismatchThreshold,
      minUseOnce: resolvedMinUseOnce,
      maxUsesPerPhoto: resolvedMaxUsesPerPhoto,
    });
  } catch (error) {
    console.error("Error al emparejar tiles:", error);
    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Error al emparejar tiles." });
  }
};
