require('dotenv').config();
const express = require("express");
const router = express.Router();

const Album = require("../models/Album");
const Costume = require("../models/Costume");
const uploadCloud = require("../config/cloudinary");

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
  // Sửa dòng console.error cũ thành dòng này để xem chi tiết Object lỗi
  console.error("🚨 LỖI CHI TIẾT TẠI BACKEND:", JSON.stringify(error, null, 2) || error);
  res.status(500).json({ error: error.message }); 
}
});

// ĐÃ NÂNG CẤP: Nhận tối đa 15 file ảnh thật gửi từ máy tính và tự động đẩy lên Cloudinary
router.post("/albums", uploadCloud.array("images", 15), async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập tên album!" });
    }

    // Kiểm tra xem người dùng có chọn ảnh để upload không
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 hình ảnh!" });
    }

    // Map qua danh sách file đã nén và lấy link URL online mà Cloudinary trả về
    const imageUrls = req.files.map(file => file.path);

    // Lưu vào MongoDB database
    const newAlbum = new Album({ 
      name, 
      images: imageUrls, 
      photosCount: imageUrls.length 
    });
    
    await newAlbum.save();
    res.status(201).json({ success: true, message: "Tạo album thành công!", data: newAlbum });
  } catch (error) { 
    // 🚨 ĐÃ CẬP NHẬT Ở ĐÂY: In bung bét toàn bộ ngóc ngách của Object lỗi ra Terminal Backend
    console.log("🚨=== PHÁT HIỆN LỖI XỬ LÝ UPLOAD ALBUM ===🚨");
    console.error(error); 
    
    res.status(500).json({ error: error.message || "Lỗi xử lý file hoặc Database!" }); 
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