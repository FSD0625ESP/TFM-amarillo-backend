import mongoose from "mongoose";

const mosaicConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mainImageUrl: { type: String, default: "" },
  tileWidth: { type: Number, default: 20 },
  tileHeight: { type: Number, default: 20 },
  mosaicKey: { type: String, default: "default" },
  mosaicSize: { type: Number, default: 2000 },
  sharpness: { type: Number, default: 0 },
  overlayOpacity: { type: Number, default: 20 }, 
  matchPoolSize: { type: Number, default: 5 },
  mismatchDistanceThreshold: { type: Number, default: 150 },
  minUseOnce: { type: Boolean, default: true },
  maxUsesPerPhoto: { type: Number, default: null },
  allowReuse: { type: Boolean, default: true },
  reuseAfterExhaustion: { type: Boolean, default: false },
  concurrency: { type: Number, default: 3 },
  intervalHours: { type: Number, default: 24 },
  refreshSeconds: { type: Number, default: 30 },
  lastRunAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("MosaicConfig", mosaicConfigSchema);
