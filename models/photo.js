import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailEntry",
    required: true,
  }, //el owner ID tiene que ser una referencia de la tabla Users
  imageUrl: { type: String, required: true },
  publicId: { type: String }, // ID de Cloudinary
  likes: { type: Number, default: 0 },
  //likedBy: [{ type: String }], // opcional: emails o IDs anónimos- No estoy seguro si es conveniente
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Photo", photoSchema);
