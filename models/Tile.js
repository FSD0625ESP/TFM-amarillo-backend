import mongoose from "mongoose";

const tileSchema = new mongoose.Schema({
  mosaicKey: { type: String, default: "default", index: true },
  row: { type: Number, required: true },
  col: { type: Number, required: true },
  left: { type: Number, required: true },
  top: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  color: { type: [Number], required: true },
  matchedPhoto: { type: mongoose.Schema.Types.ObjectId, ref: "Photo" },
  matchedUrl: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

tileSchema.index({ mosaicKey: 1, row: 1, col: 1 }, { unique: true });

export default mongoose.model("Tile", tileSchema);
