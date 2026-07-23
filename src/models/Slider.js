// src/models/Slider.js
const mongoose = require("mongoose");

const sliderSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true,
        default: ""
    },
    imageUrl: {
        type: String,
        required: true
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("Slider", sliderSchema);