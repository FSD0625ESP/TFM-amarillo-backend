import mongoose from "mongoose";

const photoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },          // título de la foto
    description: { type: String, required: false },    // descripción o historia de la foto
    imageUrl: { type: String, required: true },       // URL de Cloudinary
    publicId: { type: String, required: true },       // ID de Cloudinary
    year: { type: Number, required: true },           // año en que fue tomada la foto
    owner: { type: String, required: true },          // correo electrónico del usuario
    likes: { type: Number, default: 0 },              // contador de "me gusta"
  },
  { timestamps: true }
);

export default mongoose.model("Photo", photoSchema);
