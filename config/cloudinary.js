import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const defaultImageFormat = "jpg";
const defaultImageQuality = process.env.CLOUDINARY_IMAGE_QUALITY || "auto";
const defaultFolder = process.env.CLOUDINARY_FOLDER || "proyecto_amarillo";

export const cloudinaryUploadOptions = {
  folder: defaultFolder,
  format: defaultImageFormat,
  /**
    eager: [
      {
        fetch_format: "jpg", // use fetch_format for automatic format
        quality: "auto", // use quality: 'auto' for automatic quality
      },
    ],
  */
  transformation: [
    { width: 1280, crop: "limit"},
      {fetch_format: defaultImageFormat},
      {quality: defaultImageQuality},
  ],
};

export default cloudinary;
