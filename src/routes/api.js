const express = require("express");
const router = express.Router();

const Album = require("../models/Album");
const Costume = require("../models/Costume");

// --- API AUTHENTICATION ---
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "quocthai123" && password === "quocthai123") {
    return res.status(200).json({ 
      success: true, 
      message: "Đăng nhập thành công!", 
      token: "mock-jwt-token-aastudio" 
    });
  }
  return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
});

// --- API ALBUMS ---
router.get("/albums", async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 });
    res.status(200).json(albums);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.post("/albums", async (req, res) => {
  try {
    const { name, images } = req.body;
    if (images && images.length > 15) return res.status(400).json({ message: "Tối đa 15 ảnh!" });
    const newAlbum = new Album({ name, images, photosCount: images ? images.length : 0 });
    await newAlbum.save();
    res.status(201).json({ success: true, data: newAlbum });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.put("/albums/:id", async (req, res) => {
  try {
    const { name, images } = req.body;
    const updated = await Album.findByIdAndUpdate(
      req.params.id, 
      { name, images, photosCount: images ? images.length : 0 }, 
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// --- API COSTUMES ---
router.get("/costumes", async (req, res) => {
  try {
    const costumes = await Costume.find().sort({ updatedAt: -1 });
    res.status(200).json(costumes);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.post("/costumes", async (req, res) => {
  try {
    const { name, price, imageUrl } = req.body;
    const newCostume = new Costume({ name, price: Number(price), imageUrl });
    await newCostume.save();
    res.status(201).json({ success: true, data: newCostume });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.put("/costumes/:id", async (req, res) => {
  try {
    const { name, price, imageUrl } = req.body;
    const updated = await Costume.findByIdAndUpdate(
      req.params.id, 
      { name, price: Number(price), imageUrl }, 
      { new: true }
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

module.exports = router;