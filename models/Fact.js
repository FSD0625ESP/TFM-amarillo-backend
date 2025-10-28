// models/fact.js
import mongoose from "mongoose";

const factSchema = new mongoose.Schema({
  text: { type: String, required: true },
  category: { type: String, default: 'sagrada' },
  createdAt: { type: Date, default: Date.now }
});


const Fact= mongoose.model("Fact", factSchema);

export default Fact;

