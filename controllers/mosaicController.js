import sharp from "sharp";
import Tile from "../models/Tile.js";
import Photo from "../models/photo.js";
import MosaicSnapshot from "../models/MosaicSnapshot.js";
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

export const generateMainImageTiles = async (req, res) => {
  try {
    const {
      mainImageUrl,
      tileWidth = 10,
      tileHeight = 10,
      mosaicKey = "default",
      overwrite = true,
    } = req.body;

    if (!mainImageUrl) {
      return res.status(400).json({ message: "mainImageUrl es requerido." });
    }

    if (tileWidth <= 0 || tileHeight <= 0) {
      return res.status(400).json({ message: "tileWidth/tileHeight inválidos." });
    }

    if (overwrite) {
      await Tile.deleteMany({ mosaicKey });
    }

    const imageBuffer = await fetchImageBuffer(mainImageUrl);
    const mainImage = sharp(imageBuffer);
    const metadata = await mainImage.metadata();

    if (!metadata.width || !metadata.height) {
      return res.status(400).json({ message: "No se pudo leer el tamaño de la imagen." });
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

    return res.status(200).json({
      message: "Tiles generados correctamente.",
      mosaicKey,
      rows,
      cols,
      count: tiles.length,
    });
  } catch (error) {
    console.error("Error al generar tiles:", error);
    return res.status(500).json({ message: "Error al generar tiles." });
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
      folder = "Mosaic",
      publicIdPrefix = "mosaic",
      format = "jpg",
      concurrency = 6,
    } = req.body;

    const tiles = await Tile.find({ mosaicKey }).lean();
    if (!tiles.length) {
      return res.status(404).json({ message: "No hay tiles para ese mosaicKey." });
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
      return res.status(400).json({ message: "outputWidth/outputHeight inválidos." });
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

    return res.status(200).json({
      message: "Mosaico generado y guardado en Cloudinary.",
      snapshot,
    });
  } catch (error) {
    console.error("Error al renderizar mosaico:", error);
    return res.status(500).json({ message: "Error al renderizar mosaico." });
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

    const tiles = await Tile.find({ mosaicKey }).lean();
    if (!tiles.length) {
      return res.status(404).json({ message: "No hay tiles para ese mosaicKey." });
    }

    const photos = await Photo.find({
      hidden: false,
      dominantColor: { $size: 3 },
    }).lean();

    if (!photos.length) {
      return res.status(404).json({ message: "No hay fotos con dominantColor." });
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

    return res.status(200).json({
      message: "Tiles emparejados correctamente.",
      mosaicKey,
      matched: bulkOps.length,
      allowReuse,
    });
  } catch (error) {
    console.error("Error al emparejar tiles:", error);
    return res.status(500).json({ message: "Error al emparejar tiles." });
  }
};
