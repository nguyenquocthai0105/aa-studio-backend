// src/controllers/authController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Khóa bí mật dùng để ký token (Thái nên cấu hình trong file .env nhé)
const JWT_SECRET =
  process.env.JWT_SECRET || "aa_studio_art_creative_secret_key_2026";

const authController = {
  /**
   * Xử lý đăng nhập Admin
   */
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // 1. Kiểm tra tài khoản tồn tại trong Database không
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Tên tài khoản hoặc mật khẩu không chính xác!",
        });
      }

      // 2. Đối chiếu mật khẩu gõ vào với mật khẩu đã mã hóa (hash) dưới DB
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Tên tài khoản hoặc mật khẩu không chính xác!",
        });
      }

      // 3. Tạo JWT Token có thời hạn sử dụng (ví dụ: 7 ngày)
      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // 4. Trả về thành công kèm token cho Frontend lưu trữ
      return res.status(200).json({
        success: true,
        message: "Đăng nhập không gian quản trị thành công!",
        token,
      });
    } catch (error) {
      console.error("Lỗi xử lý Auth Login:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống máy chủ xác thực nội bộ!",
      });
    }
  },

  /**
   * Hàm Helper tự động khởi tạo duy nhất 1 tài khoản Admin gốc nếu DB trống rỗng
   * Mật khẩu sẽ tự động được mã hóa an toàn trước khi lưu.
   */
  seedAdmin: async () => {
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        // Đọc trực tiếp từ file .env, nếu không có mới lấy giá trị mặc định
        const adminUser = process.env.ADMIN_USERNAME || "aa";
        const adminPass = process.env.ADMIN_PASSWORD || "aa";

        const hashedPassword = await bcrypt.hash(adminPass, 10);
        await User.create({
          username: adminUser,
          password: hashedPassword,
        });
        console.log(
          `👉 [Auth Seed]: Đã khởi tạo Admin thành công với tài khoản trong file .env!`,
        );
      }
    } catch (error) {
      console.error("Không thể tạo tài khoản seeder admin:", error);
    }
  },
};

module.exports = authController;
