const mongoose = require("mongoose");
const albumSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }], 
  photosCount: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model("Album", albumSchema);