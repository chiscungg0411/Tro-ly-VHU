# 🤖 Chatbot Trợ Lý VHU 

**Trợ Lý VHU** là một chatbot được xây dựng trên nền tảng **Telegram**, hỗ trợ sinh viên trường Đại học Văn Hiến tra cứu nhanh các thông tin quan trọng như:

- 🧑‍🎓 Thông tin sinh viên, liên lạc, khóa học, người liên hệ,...
- 📅 Thời khóa biểu tuần này / tuần sau
- 🔔 Danh sách thông báo
- 🧾 Danh sách lịch thi
- 📋 Các công các xã hội
- 💳 Số tín chỉ đã học
- 💸 Thông tin tài chính sinh viên

Bot sử dụng Node.js + Puppeteer để tự động đăng nhập và lấy dữ liệu từ portal sinh viên VHU.

---

## 📂 Cấu trúc dự án

<pre>
Tro-ly-VHU/
├── node_modules/           # Các thư viện cài đặt qua npm
├── .env                    # Các biến môi trường (Token bot, tài khoản VHU)
├── .gitignore              # Danh sách file cần ignore khi push Git
├── bot.js                  # File chính khởi tạo và vận hành bot Telegram
├── getSchedule.js          # Các hàm Puppeteer để lấy dữ liệu portal VHU
├── package.json            # Quản lý dependencies và scripts
├── package-lock.json       # Khóa version của dependencies
├── README.md               # Tài liệu hướng dẫn sử dụng và cài đặt
└── Dockerfile              # (Nếu có) - Triển khai bot với Docker
</pre>


---

## 🚀 Demo

- **Bot Telegram:** [@trolyvhu_bot](https://t.me/trolyvhu_bot) (Chế độ Private)
  
  ![image](https://github.com/user-attachments/assets/94c6c67f-bb5b-48a3-9dff-af1ce4b7cb13)


---

## 🛠 Các công nghệ sử dụng

- [Node.js](https://nodejs.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Puppeteer](https://pptr.dev/)
- [dotenv](https://www.npmjs.com/package/dotenv)

---

## ⚙️ Hướng dẫn cài đặt và chạy bot

### 1. Clone project

```bash
git clone https://github.com/chiscungg0411/Tro-ly-VHU.git
cd Tro-ly-VHU
```

### 2. Cài đặt Dependencies

```bash
npm install
```

### 3. Tạo file .env
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
VHU_EMAIL=your_student_email_here
VHU_PASSWORD=your_password_here
```

## 📢 Lưu ý:

**TELEGRAM_BOT_TOKEN: Token của bot Telegram từ @BotFather.**

**VHU_EMAIL và VHU_PASSWORD: Tài khoản cổng thông tin sinh viên VHU.**

### 4. Chạy Chatbot
```bash
npm start
```
---

## 🛡️ Bảo mật bot (Chế độ Private)

**allowedUsers**: Danh sách các User ID được phép sử dụng bot.

Mọi người dùng khác sẽ nhận được thông báo:

**❌ Đây là bot riêng tư. Bạn không có quyền sử dụng.**

![image](https://github.com/user-attachments/assets/b356792b-b32d-4f2f-ac58-bfda8c83d314)


---

## 📜 Các lệnh hỗ trợ

**Lệnh | Mô tả**
- /start | Bắt đầu tương tác với bot
- /help | Xem hướng dẫn sử dụng bot
- /thongtin | Lấy thông tin sinh viên, liên lạc, khóa học, người liên hệ
- /tuannay | Xem thời khóa biểu tuần này
- /tuansau | Xem thời khóa biểu tuần sau
- /lichthi | Xem lịch thi sắp tới
- /tinchi | Tra cứu số tín chỉ tích lũy
- /taichinh | Tra cứu tình trạng tài chính
- /thongbao | Xem thông báo mới từ trường
- /congtac | Xem các hoạt động công tác sinh viên

---

## 📣 Ghi chú

Dự án được xây dựng với mục đích hỗ trợ sinh viên cá nhân, **KHÔNG SỬ DỤNG** vào mục đích thương mại.

**Khi cần nâng cấp chức năng, vui lòng fork hoặc liên hệ với tác giả.**

---

## 👨‍💻 Tác giả
**© 2025 - Võ Chí Cường**
<p align="center">
  <a href="https://github.com/chiscungg0411" target="_blank">
    <img src="https://img.icons8.com/?size=100&id=v551nqGeHhGn&format=png&color=000000" alt="GitHub" style="border-radius:50%; margin-right:10px; height:60px;" />
  </a>
  <a href="https://facebook.com/ChiCuongDeyy" target="_blank">
    <img src="https://img.icons8.com/?size=100&id=118468&format=png&color=0865FE" alt="Facebook" style="border-radius:50%; margin-right:10px; height:60px;" />
  </a>
  <a href="https://instagram.com/vochicuong_" target="_blank">
    <img src="https://img.icons8.com/?size=100&id=32292&format=png&color=CD2257" alt="Instagram" style="border-radius:50%; height:60px;" />
  </a>
</p>
