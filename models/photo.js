import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EmailEntry",
    required: false, //cambiar a true una vez que lo tengamos
  }, //el owner ID tiene que ser una referencia de la tabla Users
  imageUrl: { type: String, required: true },
  publicId: { type: String }, // ID de Cloudinary
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "EmailEntry" }],
   year: { type: Number },// para que el usuario elija el año
  //likedBy: [{ type: String }], // opcional: emails o IDs anónimos- No estoy seguro si es conveniente
  createdAt: { type: Date, default: Date.now },
  hidden: { type: Boolean, default: false },
  hiddenReason: { type: String, default: "" },
  
});

export default mongoose.model("Photo", photoSchema);
