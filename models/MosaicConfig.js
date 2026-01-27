import mongoose from "mongoose";

const mosaicConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mainImageUrl: { type: String, default: "" },
  tileWidth: { type: Number, default: 20 },
  tileHeight: { type: Number, default: 20 },
  mosaicKey: { type: String, default: "default" },
  mosaicSize: { type: Number, default: 2000 },
  allowReuse: { type: Boolean, default: true },
  intervalHours: { type: Number, default: 24 },
  lastRunAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("MosaicConfig", mosaicConfigSchema);
