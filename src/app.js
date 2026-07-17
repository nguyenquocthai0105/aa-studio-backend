const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const apiRoutes = require("./routes/api");

// 1. Cấu hình đọc file môi trường .env
dotenv.config();

// 2. Khởi tạo ứng dụng Express (Dòng này định nghĩa biến app cực kỳ quan trọng!)
const app = express();

// 3. Cấu hình Middleware cơ bản
app.use(cors()); 
app.use(express.json());

// 4. Định tuyến toàn bộ API qua tiền tố /api
app.use("/api", apiRoutes);

// 5. Cấu hình chuỗi kết nối Database bảo mật
// Tìm đến dòng này trong src/app.js:
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aa_studio_db";

// 6. Kết nối đến cơ sở dữ liệu MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Á À Studio Database đã kết nối thành công! 🎉"))
  .catch((err) => console.error("Lỗi kết nối database:", err));

// 7. Mở cổng server lắng nghe các yêu cầu từ Frontend
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend đang chạy mượt mà tại cổng http://localhost:${PORT}`);
});