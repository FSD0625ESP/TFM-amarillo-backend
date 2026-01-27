import cloudinary from "../config/cloudinary.js";

export const getPngUrl = (publicId) => {
  return cloudinary.url(publicId, {
    fetch_format: "png",
    secure: true,
  });
};
