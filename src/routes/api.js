require('dotenv').config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken"); // Cần dùng để tạo và xác thực token

const Album = require("../models/Album");
const Costume = require("../models/Costume");
const uploadCloud = require("../config/cloudinary");

// Lấy instance của cloudinary từ file config để dùng hàm xóa (destroy)
const cloudinary = require('cloudinary').v2; 

// ==========================================
//      MIDDLEWARE BẢO MẬT (VERIFY TOKEN)
// ==========================================
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Bạn không có quyền truy cập tính năng này!" });
    }

    // Bóc tách token từ chuỗi "Bearer <token>"
    const token = authHeader.split(" ")[1];

    // Xác thực token bằng JWT_SECRET đã cấu hình trên Render
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin admin vào request để dùng nếu cần
    next(); // Hợp lệ thì cho đi tiếp vào API
  } catch (error) {
    return res.status(403).json({ success: false, message: "Token đã hết hạn hoặc không hợp lệ!" });
  }
};

// ==========================================
//          HÀM HỖ TRỢ XÓA ẢNH CLOUDINARY
// ==========================================
// Hàm tách public_id từ URL Cloudinary (Ví dụ: .../v12345/folder/image.jpg -> folder/image)
const extractPublicId = (url) => {
  try {
    const parts = url.split('/');
    const uploadIndex = parts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    // Bỏ phần version (ví dụ: v1625... nếu có)
    let startIndex = uploadIndex + 2;
    if (parts[uploadIndex + 1].startsWith('v') && !isNaN(parts[uploadIndex + 1].substring(1))) {
      startIndex = uploadIndex + 2;
    } else {
      startIndex = uploadIndex + 1;
    }
    
    const publicIdWithExt = parts.slice(startIndex).join('/');
    return publicIdWithExt.split('.')[0]; // Bỏ đuôi định dạng (.jpg, .png)
  } catch (error) {
    console.error("Lỗi trích xuất Public ID ảnh:", error);
    return null;
  }
};

// ==========================================
//        API XÁC THỰC (AUTH) - ĐÃ UPGRADE
// ==========================================
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  // SO SÁNH VỚI BIẾN MÔI TRƯỜNG TRÊN RENDER (Không sợ lộ mật khẩu nữa)
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    
    // Tạo mã JWT thật, có thời hạn sử dụng là 1 ngày (1d)
    const token = jwt.sign(
      { username: username, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({ 
      success: true, 
      message: "Đăng nhập thành công!", 
      token: token // Trả token xịn về cho FE lưu
    });
  }

  return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
});

// ==========================================
//          QUẢN LÝ ALBUMS ảnh
// ==========================================

// Lấy danh sách (Ai xem cũng được - Không cần chặn)
router.get("/albums", async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 });
    res.status(200).json(albums);
  } catch (error) { 
    console.error("🚨 LỖI CHI TIẾT TẠI BACKEND:", JSON.stringify(error, null, 2) || error);
    res.status(500).json({ error: error.message }); 
  }
});

// Tạo Album mới (Cần Đăng Nhập) -> Gắn thêm verifyToken vào giữa
router.post("/albums", verifyToken, uploadCloud.array("images", 15), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Vui lòng nhập tên album!" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 hình ảnh!" });

    const imageUrls = req.files.map(file => file.path);

    const newAlbum = new Album({ 
      name, 
      images: imageUrls, 
      photosCount: imageUrls.length 
    });
    
    await newAlbum.save();
    res.status(201).json({ success: true, message: "Tạo album thành công!", data: newAlbum });
  } catch (error) { 
    res.status(500).json({ error: error.message || "Lỗi xử lý file hoặc Database!" }); 
  }
});

// Cập nhật Album (Cần Đăng Nhập + Dọn dẹp ảnh thừa trên Cloudinary nếu admin xóa bớt ảnh)
router.put("/albums/:id", verifyToken, uploadCloud.array("images", 15), async (req, res) => {
  try {
    const { name, existingImages } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Tên album không được để trống" });

    // Lấy thông tin album cũ từ DB để so sánh ảnh bị xóa bớt
    const oldAlbum = await Album.findById(req.params.id);
    if (!oldAlbum) return res.status(404).json({ message: "Không tìm thấy album để cập nhật!" });

    let finalImages = [];
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }

    // --- LOGIC BẢO VỆ DUNG LƯỢNG CLOUDINARY ---
    // Tìm những ảnh cũ có trong DB nhưng không còn nằm trong danh sách existingImages gửi lên
    const deletedImages = oldAlbum.images.filter(imgUrl => !finalImages.includes(imgUrl));
    for (const imgUrl of deletedImages) {
      const publicId = extractPublicId(imgUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId); // Xóa thẳng trên Cloudinary
    }

    // Nếu có đăng thêm ảnh mới, gộp chung vào mảng
    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map(file => file.path);
      finalImages = [...finalImages, ...newImageUrls];
    }

    if (finalImages.length === 0) return res.status(400).json({ message: "Album phải có ít nhất 1 hình ảnh" });

    const updatedAlbum = await Album.findByIdAndUpdate(
      req.params.id,
      { name, images: finalImages, photosCount: finalImages.length },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Cập nhật album thành công! 🎉", data: updatedAlbum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa vĩnh viễn Album (Cần Đăng Nhập + Xóa sạch toàn bộ ảnh của album đó trên Cloudinary)
router.delete("/albums/:id", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: "Không tìm thấy album để xóa!" });

    // Xóa sạch toàn bộ ảnh thuộc album này trên Cloudinary trước khi xóa DB
    for (const imgUrl of album.images) {
      const publicId = extractPublicId(imgUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

    await Album.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Xóa album và toàn bộ ảnh thành công! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
//        QUẢN LÝ TRANG PHỤC (COSTUME)
// ==========================================

// Lấy danh sách (Public công khai)
router.get("/costumes", async (req, res) => {
  try {
    const costumes = await Costume.find().sort({ createdAt: -1 });
    res.status(200).json(costumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tạo trang phục (Cần Đăng Nhập)
router.post("/costumes", verifyToken, uploadCloud.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Vui lòng nhập tên trang phục!" });
    if (!price) return res.status(400).json({ message: "Vui lòng nhập giá thuê!" });
    if (!req.file) return res.status(400).json({ message: "Vui lòng tải lên hình ảnh trang phục!" });

    const newCostume = new Costume({
      name,
      price: Number(price),
      imageUrl: req.file.path
    });

    await newCostume.save();
    res.status(201).json({ success: true, message: "Thêm trang phục thành công!", data: newCostume });
  } catch (error) {
    res.status(500).json({ error: error.message || "Lỗi xử lý file hoặc Database!" });
  }
});

// Cập nhật trang phục (Cần Đăng Nhập + Xóa ảnh cũ trên Cloudinary nếu đổi ảnh mới)
router.put("/costumes/:id", verifyToken, uploadCloud.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Tên trang phục không được để trống" });
    if (!price) return res.status(400).json({ message: "Giá thuê không được để trống" });

    const oldCostume = await Costume.findById(req.params.id);
    if (!oldCostume) return res.status(404).json({ message: "Không tìm thấy trang phục!" });

    let finalImageUrl = req.body.imageUrl;

    // Nếu thay ảnh mới, tiến hành xóa ảnh cũ trên Cloudinary để giải phóng bộ nhớ
    if (req.file) {
      finalImageUrl = req.file.path;
      const oldPublicId = extractPublicId(oldCostume.imageUrl);
      if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId);
    }

    const updatedCostume = await Costume.findByIdAndUpdate(
      req.params.id,
      { name, price: Number(price), imageUrl: finalImageUrl },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Cập nhật trang phục thành công! 🎉", data: updatedCostume });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa trang phục (Cần Đăng Nhập + Xóa ảnh trên Cloudinary)
router.delete("/costumes/:id", verifyToken, async (req, res) => {
  try {
    const costume = await Costume.findById(req.params.id);
    if (!costume) return res.status(404).json({ success: false, message: "Không tìm thấy trang phục cần xóa!" });

    // Xóa ảnh trên Cloudinary
    const publicId = extractPublicId(costume.imageUrl);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await Costume.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Xóa trang phục thành công! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;