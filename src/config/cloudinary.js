const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

console.log("=== CHECK CLOUDINARY KEYS ===", {
  name: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY ? "ĐÃ CÓ KEY" : "TRỐNG RỖNG ❌"
});

// Kích hoạt cấu hình Cloudinary bằng các thông số trong file .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cấu hình lưu trữ và tối ưu dung lượng ảnh cho web
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'aa_studio_albums', // Thư mục lưu ảnh trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    // 🚨 ĐÃ SỬA: Gom các thuộc tính transformation vào chung 1 Object thay vì dùng mảng
    transformation: { 
      width: 2000, 
      crop: 'limit', 
      quality: 'auto', 
      fetch_format: 'auto' 
    }
  },
});

const uploadCloud = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } 
});

module.exports = uploadCloud;