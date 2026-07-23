require('dotenv').config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const Album = require("../models/Album");
const Costume = require("../models/Costume");
const Slider = require("../models/Slider");
const uploadCloud = require("../config/cloudinary");

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

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Token đã hết hạn hoặc không hợp lệ!" });
  }
};

// ==========================================
//          HÀM HỖ TRỢ XÓA ẢNH CLOUDINARY
// ==========================================
const extractPublicId = (url) => {
  try {
    const parts = url.split('/');
    const uploadIndex = parts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    let startIndex = uploadIndex + 2;
    if (parts[uploadIndex + 1].startsWith('v') && !isNaN(parts[uploadIndex + 1].substring(1))) {
      startIndex = uploadIndex + 2;
    } else {
      startIndex = uploadIndex + 1;
    }
    
    const publicIdWithExt = parts.slice(startIndex).join('/');
    return publicIdWithExt.split('.')[0];
  } catch (error) {
    console.error("Lỗi trích xuất Public ID ảnh:", error);
    return null;
  }
};

// ==========================================
//   HÀM BẢO VỆ & CHUẨN HÓA THỨ TỰ (1 -> N)
// ==========================================
const normalizeSliderOrders = async () => {
  // Lấy toàn bộ slider, ưu tiên sắp xếp theo order hiện tại, nếu trùng thì xét theo thời gian tạo
  const sliders = await Slider.find().sort({ order: 1, createdAt: 1 });
  for (let i = 0; i < sliders.length; i++) {
    // Đánh lại số thứ tự chuẩn 1, 2, 3... cho từng record
    if (sliders[i].order !== i + 1) {
      await Slider.findByIdAndUpdate(sliders[i]._id, { order: i + 1 });
    }
  }
};

// ==========================================
//        API XÁC THỰC (AUTH)
// ==========================================
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username: username, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({ 
      success: true, 
      message: "Đăng nhập thành công!", 
      token: token 
    });
  }

  return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
});

// ==========================================
//        QUẢN LÝ SLIDER (AN TOÀN 100%)
// ==========================================

// 1. LẤY DANH SÁCH SLIDERS (TỰ ĐỘNG FIX LỖI TRÙNG NẾU CÓ)
router.get("/sliders", async (req, res) => {
  try {
    await normalizeSliderOrders(); // Chuẩn hóa lại DB trước khi trả về
    const sliders = await Slider.find().sort({ order: 1 });
    res.status(200).json(sliders || []);
  } catch (error) {
    console.error("🚨 LỖI GET /sliders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. THÊM SLIDER MỚI (CHẶN TỐI ĐA 6 + TỰ ĐÁNH SỐ)
router.post("/sliders", verifyToken, uploadCloud.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn hình ảnh slider!" });
    }

    const count = await Slider.countDocuments();
    if (count >= 6) {
      return res.status(400).json({ success: false, message: "Hệ thống đã đạt giới hạn tối đa 6 Slider! Vui lòng xóa bớt trước khi thêm." });
    }

    const { title, order } = req.body;

    // Tìm order lớn nhất hiện tại để cộng thêm 1
    const maxOrderSlider = await Slider.findOne().sort({ order: -1 });
    const nextOrder = maxOrderSlider ? maxOrderSlider.order + 1 : 1;

    const newSlider = new Slider({
      title: title ? title.trim() : "",
      imageUrl: req.file.path,
      order: order ? Number(order) : nextOrder
    });

    await newSlider.save();
    await normalizeSliderOrders(); // Chuẩn hóa lại thứ tự ngay lập tức

    res.status(201).json({ success: true, message: "Thêm ảnh Slider thành công!", data: newSlider });
  } catch (error) {
    console.error("🚨 LỖI POST /sliders:", error);
    res.status(500).json({ success: false, message: error.message || "Lỗi lưu Slider vào Database!" });
  }
});

// 3. REORDER - CẬP NHẬT THỨ TỰ HÀNG LOẠT
router.put("/sliders/reorder", verifyToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Dữ liệu gửi lên không đúng định dạng mảng!" });
    }

    // Cập nhật lại theo đúng thứ tự vị trí mảng mà FE gửi lên
    for (let idx = 0; idx < items.length; idx++) {
      if (items[idx]._id) {
        await Slider.findByIdAndUpdate(items[idx]._id, { order: idx + 1 });
      }
    }

    await normalizeSliderOrders();
    res.status(200).json({ success: true, message: "Cập nhật thứ tự thành công!" });
  } catch (error) {
    console.error("🚨 LỖI PUT /sliders/reorder:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. XÓA 1 SLIDER VÀ TỰ DỒN SỐ THỨ TỰ
router.delete("/sliders/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sliderToDelete = await Slider.findById(id);

    if (!sliderToDelete) {
      return res.status(404).json({ success: false, message: "Không tìm thấy Slider cần xóa!" });
    }

    // Xóa ảnh trên Cloudinary nếu trích xuất được publicId
    if (sliderToDelete.imageUrl) {
      const publicId = extractPublicId(sliderToDelete.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (cloudErr) {
          console.warn("Cảnh báo: Không thể xóa ảnh trên Cloudinary:", cloudErr);
        }
      }
    }

    // Xóa trong DB
    await Slider.findByIdAndDelete(id);

    // Dồn lại thứ tự 1 -> N cho các slide còn lại
    await normalizeSliderOrders();

    res.status(200).json({ success: true, message: "Xóa Slider và cập nhật thứ tự thành công!" });
  } catch (error) {
    console.error("🚨 LỖI DELETE /sliders/:id:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
//          QUẢN LÝ ALBUMS ÁNH
// ==========================================

router.get("/albums", async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 });
    res.status(200).json(albums);
  } catch (error) { 
    console.error("🚨 LỖI CHI TIẾT TẠI BACKEND:", JSON.stringify(error, null, 2) || error);
    res.status(500).json({ error: error.message }); 
  }
});

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

router.put("/albums/:id", verifyToken, uploadCloud.array("images", 15), async (req, res) => {
  try {
    const { name, existingImages } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Tên album không được để trống" });

    const oldAlbum = await Album.findById(req.params.id);
    if (!oldAlbum) return res.status(404).json({ message: "Không tìm thấy album để cập nhật!" });

    let finalImages = [];
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    }

    const deletedImages = oldAlbum.images.filter(imgUrl => !finalImages.includes(imgUrl));
    for (const imgUrl of deletedImages) {
      const publicId = extractPublicId(imgUrl);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

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

router.delete("/albums/:id", verifyToken, async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: "Không tìm thấy album để xóa!" });

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

router.get("/costumes", async (req, res) => {
  try {
    const costumes = await Costume.find().sort({ createdAt: -1 });
    res.status(200).json(costumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

router.put("/costumes/:id", verifyToken, uploadCloud.single("image"), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Tên trang phục không được để trống" });
    if (!price) return res.status(400).json({ message: "Giá thuê không được để trống" });

    const oldCostume = await Costume.findById(req.params.id);
    if (!oldCostume) return res.status(404).json({ message: "Không tìm thấy trang phục!" });

    let finalImageUrl = req.body.imageUrl;

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

router.delete("/costumes/:id", verifyToken, async (req, res) => {
  try {
    const costume = await Costume.findById(req.params.id);
    if (!costume) return res.status(404).json({ success: false, message: "Không tìm thấy trang phục cần xóa!" });

    const publicId = extractPublicId(costume.imageUrl);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await Costume.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Xóa trang phục thành công! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;