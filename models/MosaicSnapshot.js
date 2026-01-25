import mongoose from "mongoose";

const mosaicSnapshotSchema = new mongoose.Schema({
  mosaicKey: { type: String, default: "default", index: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  tilesCount: { type: Number, required: true },
  format: { type: String, default: "jpg" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("MosaicSnapshot", mosaicSnapshotSchema);
