import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const defaultImageFormat = "auto";
const defaultImageQuality = process.env.CLOUDINARY_IMAGE_QUALITY || "auto:good";
const defaultFolder = process.env.CLOUDINARY_FOLDER || "proyecto_amarillo";

export const cloudinaryUploadOptions = {
  folder: defaultFolder,
  transformation: [
    {
      fetch_format: defaultImageFormat,
      quality: defaultImageQuality,
    },
  ],
};

export default cloudinary;
