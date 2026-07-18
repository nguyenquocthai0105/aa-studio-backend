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

// --- API CẬP NHẬT/CHỈNH SỬA ALBUM ---
router.put("/albums/:id", uploadCloud.array("images", 15), async (req, res) => {
  try {
    const { name, existingImages } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tên album không được để trống" });
    }

    // Biến đổi dữ liệu existingImages nhận từ FormData
    // (FormData ép mọi thứ thành string, cần bóc tách lại thành mảng các link ảnh cũ)
    let finalImages = [];
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }

    // Nếu có đăng thêm ảnh mới, lấy link online từ Cloudinary và đẩy vào mảng
    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map(file => file.path);
      finalImages = [...finalImages, ...newImageUrls];
    }

    if (finalImages.length === 0) {
      return res.status(400).json({ message: "Album phải có ít nhất 1 hình ảnh" });
    }

    // Cập nhật thông tin mới vào MongoDB
    const updatedAlbum = await Album.findByIdAndUpdate(
      req.params.id,
      {
        name: name,
        images: finalImages,
        photosCount: finalImages.length
      },
      { new: true } // Trả về dữ liệu mới sau khi sửa đổi
    );

    if (!updatedAlbum) {
      return res.status(404).json({ success: false, message: "Không tìm thấy album để cập nhật!" });
    }

    res.status(200).json({ success: true, message: "Cập nhật album thành công! 🎉", data: updatedAlbum });
  } catch (error) {
    console.error("🚨 LỖI CẬP NHẬT ALBUM:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- API XÓA ALBUM ---
router.delete("/albums/:id", async (req, res) => {
  try {
    const deletedAlbum = await Album.findByIdAndDelete(req.params.id);
    
    if (!deletedAlbum) {
      return res.status(404).json({ success: false, message: "Không tìm thấy album để xóa!" });
    }
    
    res.status(200).json({ success: true, message: "Xóa album thành công! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//          QUẢN LÝ TRANG PHỤC (COSTUME)
// ==========================================

// 1. API: LẤY DANH SÁCH TRANG PHỤC (Đã sắp xếp mới nhất lên đầu)
router.get("/costumes", async (req, res) => {
  try {
    const costumes = await Costume.find().sort({ createdAt: -1 });
    res.status(200).json(costumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. API: TẠO MỚI TRANG PHỤC (Tự động đẩy 1 file ảnh lên Cloudinary)
router.post("/costumes", uploadCloud.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Vui lòng nhập tên trang phục!" });
    }
    if (!price) {
      return res.status(400).json({ message: "Vui lòng nhập giá thuê!" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên hình ảnh trang phục!" });
    }

    // Đường link online do Cloudinary trả về
    const imageUrl = req.file.path;

    const newCostume = new Costume({
      name,
      price: Number(price),
      imageUrl
    });

    await newCostume.save();
    res.status(201).json({ success: true, message: "Thêm trang phục thành công!", data: newCostume });
  } catch (error) {
    console.error("🚨 LỖI TẠI BACKEND ĐỒ CƯỚI:", error);
    res.status(500).json({ error: error.message || "Lỗi xử lý file hoặc Database!" });
  }
});

// 3. API: CẬP NHẬT TRANG PHỤC (Cho phép giữ ảnh cũ hoặc đổi ảnh mới)
router.put("/costumes/:id", uploadCloud.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tên trang phục không được để trống" });
    }
    if (!price) {
      return res.status(400).json({ message: "Giá thuê không được để trống" });
    }

    // Mặc định giữ lại link ảnh cũ từ cơ sở dữ liệu gửi lên nếu không upload file mới
    let finalImageUrl = req.body.imageUrl;

    // Nếu admin chọn file ảnh mới, đè đường link mới của Cloudinary vào
    if (req.file) {
      finalImageUrl = req.file.path;
    }

    const updatedCostume = await Costume.findByIdAndUpdate(
      req.params.id,
      {
        name,
        price: Number(price),
        imageUrl: finalImageUrl
      },
      { new: true }
    );

    if (!updatedCostume) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trang phục!" });
    }

    res.status(200).json({ success: true, message: "Cập nhật trang phục thành công! 🎉", data: updatedCostume });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. API: XÓA VĨNH VIỄN TRANG PHỤC
router.delete("/costumes/:id", async (req, res) => {
  try {
    const deletedCostume = await Costume.findByIdAndDelete(req.params.id);
    if (!deletedCostume) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trang phục cần xóa!" });
    }
    res.status(200).json({ success: true, message: "Xóa trang phục thành công! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;