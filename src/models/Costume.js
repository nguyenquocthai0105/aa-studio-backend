const mongoose = require("mongoose");
const costumeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true }, 
  imageUrl: { type: String, required: true } 
}, { timestamps: true });
module.exports = mongoose.model("Costume", costumeSchema);