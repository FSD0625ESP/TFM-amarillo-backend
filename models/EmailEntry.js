import mongoose from "mongoose";
extractColor (imageBuffer, colorCount)

const { Schema } = mongoose;
const colors = await extractColors(req.file.buffer);

const emailEntrySchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  country: { type: String, required: true },
  story: { type: String },
  photoYear: { type: Number },
  photos: [{ type: String }],
  hiddenPhotos: { type: [String], default: [] },
  subscribedAt: { type: Date, default: Date.now },
  width: Result.width,
  height: Result.height,
  colors: colors
});

export default mongoose.model("EmailEntry", emailEntrySchema);
