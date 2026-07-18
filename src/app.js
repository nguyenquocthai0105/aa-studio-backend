const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const apiRoutes = require("./routes/api");

// 🚨 1. IMPORT THÊM BỘ ĐIỀU KHIỂN AUTH VÀO ĐÂY
const authController = require("./controllers/authController"); 

// Cấu hình đọc file môi trường .env
dotenv.config();

// Khởi tạo ứng dụng Express 
const app = express();

// Cấu hình Middleware cơ bản
app.use(cors()); 
app.use(express.json());

// Định tuyến toàn bộ API qua tiền tố /api
app.use("/api", apiRoutes);

// Cấu hình chuỗi kết nối Database bảo mật
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aa_studio_db";

// 🚨 2. CHÈN HÀM TẠO ADMIN VÀO KHỐI KẾT NỐI MONGODB (Nhớ thêm async)
mongoose.connect(MONGODB_URI)
  .then(async () => { 
    console.log("Á À Studio Database đã kết nối thành công! 🎉");
    
    // Kích hoạt sinh tài khoản Admin duy nhất nếu DB trống
    await authController.seedAdmin();
  })
  .catch((err) => console.error("Lỗi kết nối database:", err));

// Mở cổng server lắng nghe các yêu cầu từ Frontend
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});