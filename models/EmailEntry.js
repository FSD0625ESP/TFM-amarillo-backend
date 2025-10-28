import mongoose from "mongoose";

const { Schema } = mongoose;

const emailEntrySchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  country: { type: String, required: true },
  story: { type: String },
  photoYear: { type: Number },
  photos: [{ type: String }],
  subscribedAt: { type: Date, default: Date.now },
});

export default mongoose.model("EmailEntry", emailEntrySchema);
