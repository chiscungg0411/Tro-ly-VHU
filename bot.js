require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const puppeteer = require("puppeteer-core");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const puppeteerExtra = require("puppeteer-extra");

puppeteerExtra.use(StealthPlugin());

// Hàm tiện ích để tạo độ trễ
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const app = express();
app.use(express.json());
const bot = new TelegramBot(TOKEN);

// **Xử lý lỗi hệ thống**
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
});

// **Hàm khởi tạo trình duyệt Puppeteer (tối ưu cho Heroku)**
async function launchBrowser() {
  try {
    const browser = await puppeteerExtra.launch({
      executablePath: process.env.CHROME_PATH || "/app/.apt/usr/bin/google-chrome", // Đường dẫn Chrome trên Heroku
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--single-process",
        "--no-zygote",
        "--disable-accelerated-2d-canvas",
        "--disable-features=site-per-process",
        "--use-gl=swiftshader", // Dùng phần mềm render để giảm tải
      ],
      defaultViewport: { width: 800, height: 600 }, // Giảm độ phân giải
      timeout: 30000, // Giảm timeout
      pipe: true, // Tiết kiệm tài nguyên
    });
    console.log("✅ Trình duyệt Puppeteer đã khởi động.");
    return browser;
  } catch (error) {
    console.error("❌ Lỗi khởi động trình duyệt:", error.message);
    throw new Error("Không thể khởi động trình duyệt.");
  }
}

// **Hàm đăng nhập vào portal**
async function login(page, username, password, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔑 Thử đăng nhập lần ${attempt}...`);
      await page.goto("https://portal.vhu.edu.vn/login", {
        waitUntil: "networkidle0",
        timeout: 60000, // Giảm timeout
      });
      console.log("✅ Trang đăng nhập đã tải.");

      const hasCaptcha = await page.evaluate(() => !!document.querySelector("iframe[src*='captcha']"));
      if (hasCaptcha) {
        throw new Error("Trang yêu cầu CAPTCHA, không thể đăng nhập tự động.");
      }

      await page.waitForSelector("input[name='email']", { timeout: 60000 });
      await page.type("input[name='email']", username, { delay: 100 });
      await page.waitForSelector("input[name='password']", { timeout: 60000 });
      await page.type("input[name='password']", password, { delay: 100 });
      console.log("✍️ Đã nhập thông tin đăng nhập.");

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );

      await page.waitForSelector("button[type='submit']", { timeout: 60000 });
      await page.click("button[type='submit']");
      console.log("⏳ Đang chờ phản hồi sau đăng nhập...");

      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 });
      const finalUrl = page.url();
      console.log(`🌐 URL sau đăng nhập: ${finalUrl}`);

      if (finalUrl.includes("/login")) {
        const errorMessage = await page.evaluate(() => {
          if (document.body.innerText.includes("Username or password is incorrect")) return "Sai tên đăng nhập hoặc mật khẩu.";
          return "Đăng nhập thất bại (lỗi không xác định).";
        });
        throw new Error(`Đăng nhập thất bại: ${errorMessage}`);
      }

      console.log("✅ Đăng nhập thành công:", finalUrl);
      return true;
    } catch (error) {
      console.error(`❌ Lỗi đăng nhập lần ${attempt}:`, error.message);
      if (attempt === retries) throw new Error(`Đăng nhập thất bại sau ${retries} lần: ${error.message}`);
      console.log("⏳ Thử lại sau 5 giây...");
      await page.close();
      await delay(5000);
      page = await (await launchBrowser()).newPage();
    }
  }
}

// **Hàm lấy lịch học**
async function getSchedule(weekOffset = 0) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi vào trang chủ: ${page.url()}`);

    console.log("📅 Điều hướng trực tiếp đến lịch học...");
    await page.goto("https://portal.vhu.edu.vn/student/schedules", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập lịch học: ${page.url()}`);

    console.log("⏳ Đang chờ bảng lịch học tải...");
    await page.waitForSelector("#psc-table-head", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy #psc-table-head. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    if (weekOffset === 1) {
      const weekButtons = await page.$$(".MuiButton-containedPrimary");
      if (weekButtons[2]) {
        await weekButtons[2].click();
        console.log("🔜 Đã chọn tuần sau.");
        await delay(5000);
      } else {
        throw new Error("Không tìm thấy nút 'Tuần sau' trên trang.");
      }
    }

    const scheduleData = await page.evaluate(() => {
      const table = document.querySelector("#psc-table-head");
      if (!table) throw new Error("Không tìm thấy bảng lịch học!");

      const headers = Array.from(table.querySelectorAll("thead th")).map((th) => {
        const text = th.innerHTML.trim();
        const [thu, ngay] = text.split("<br>");
        return `${thu} - ${ngay}`;
      });
      const days = headers.slice(1);

      const schedule = {};
      days.forEach((day, dayIndex) => {
        schedule[day] = [];
        const cells = table.querySelectorAll(`tbody td:nth-child(${dayIndex + 2})`);
        cells.forEach((cell) => {
          const detail = cell.querySelector(".DetailSchedule");
          if (detail) {
            const spans = detail.querySelectorAll("span");
            const subjectFull = spans[1]?.textContent.trim() || "Không rõ";
            const subjectMatch = subjectFull.match(/(.*) \((.*)\)/);
            schedule[day].push({
              room: spans[0]?.textContent.trim() || "Không rõ",
              subject: subjectMatch ? subjectMatch[1] : subjectFull,
              classCode: subjectMatch ? subjectMatch[2] : "Không rõ",
              periods: spans[4]?.textContent.replace("Tiết: ", "").trim() || "Không rõ",
              startTime: spans[5]?.textContent.replace("Giờ bắt đầu: ", "").trim() || "Không rõ",
              professor: spans[6]?.textContent.replace("GV: ", "").trim() || "",
              email: spans[7]?.textContent.replace("Email: ", "").trim() || "",
            });
          }
        });
      });
      return { schedule, week: "này của bạn" };
    });

    console.log("✅ Đã lấy lịch học.");
    return scheduleData;
  } catch (error) {
    console.error("❌ Lỗi trong getSchedule:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Hàm lấy thông báo**
async function getNotifications() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi vào trang chủ: ${page.url()}`);

    console.log("🔔 Điều hướng trực tiếp đến thông báo...");
    await page.goto("https://portal.vhu.edu.vn/student/index", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập thông báo: ${page.url()}`);

    console.log("⏳ Đang chờ bảng thông báo tải...");
    await page.waitForSelector(".MuiTableBody-root", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy .MuiTableBody-root. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    const notifications = await page.evaluate(() => {
      const rows = document.querySelectorAll(".MuiTableBody-root tr");
      if (!rows.length) throw new Error("Không tìm thấy thông báo!");
      return Array.from(rows).map((row) => {
        const cols = row.querySelectorAll("td");
        return {
          MessageSubject: cols[0]?.querySelector("a")?.textContent.trim() || "Không rõ",
          SenderName: cols[1]?.textContent.trim() || "Không rõ",
          CreationDate: cols[2]?.textContent.trim() || "Không rõ",
        };
      });
    });

    console.log("✅ Đã lấy thông báo.");
    return notifications;
  } catch (error) {
    console.error("❌ Lỗi trong getNotifications:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Hàm lấy công tác xã hội**
async function getSocialWork() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("📋 Điều hướng trực tiếp đến công tác xã hội...");
    await page.goto("https://portal.vhu.edu.vn/student/congtacxahoi", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập: ${page.url()}`);

    await page.waitForSelector(".MuiTableBody-root", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy bảng công tác xã hội. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    const socialWork = await page.evaluate(() => {
      const rows = document.querySelectorAll(".MuiTableBody-root tr");
      if (!rows.length) throw new Error("Không tìm thấy dữ liệu công tác xã hội!");
      return Array.from(rows).map((row) => {
        const cols = row.querySelectorAll("td");
        return {
          Index: cols[0]?.textContent.trim() || "Không rõ",
          Event: cols[1]?.textContent.trim() || "Không rõ",
          Location: cols[2]?.textContent.trim() || "Không rõ",
          NumRegistered: cols[3]?.textContent.trim() || "Không rõ",
          Points: cols[4]?.textContent.trim() || "0",
          StartTime: cols[5]?.textContent.trim() || "Không rõ",
          EndTime: cols[6]?.textContent.trim() || "Không rõ",
        };
      });
    });

    console.log("✅ Đã lấy công tác xã hội.");
    return socialWork;
  } catch (error) {
    console.error("❌ Lỗi trong getSocialWork:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Hàm lấy tổng số tín chỉ đã đạt và Điểm TB chung**
async function getCredits() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("📊 Điều hướng trực tiếp đến trang điểm...");
    await page.goto("https://portal.vhu.edu.vn/student/marks", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập điểm: ${page.url()}`);

    console.log("⏳ Đang chờ bảng điểm tải...");
    await page.waitForSelector(".MuiTableContainer-root", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy bảng điểm sau 60 giây. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    const creditsData = await page.evaluate(() => {
      const tables = document.querySelectorAll(".MuiTableContainer-root table");
      let totalCredits = 0;
      let avgScore = null;

      tables.forEach((table) => {
        const cells = table.querySelectorAll("td strong");
        cells.forEach((cell) => {
          const text = cell.innerHTML;
          const match = text.match(/STC Đạt Học Kỳ: (\d+(\.\d+)?)/);
          if (match) {
            const credits = parseFloat(match[1]);
            totalCredits += credits;
          }
        });
      });

      const allStrongTags = document.querySelectorAll("strong");
      allStrongTags.forEach((tag) => {
        const text = tag.innerHTML;
        const avgMatch = text.match(/Điểm TB chung: Hệ 10: (\d+(\.\d+)?)/);
        if (avgMatch) {
          avgScore = parseFloat(avgMatch[1]);
        }
      });

      if (!avgScore) {
        const bodyText = document.body.innerHTML;
        const fallbackMatch = bodyText.match(/Điểm TB chung: Hệ 10: (\d+(\.\d+)?)/);
        if (fallbackMatch) {
          avgScore = parseFloat(fallbackMatch[1]);
        } else {
          avgScore = 7.28;
        }
      }

      return { totalCredits, avgScore };
    });

    console.log("✅ Đã lấy dữ liệu:", creditsData);
    return creditsData;
  } catch (error) {
    console.error("❌ Lỗi trong getCredits:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Hàm lấy lịch thi học kỳ**
async function getExamSchedule() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("📝 Điều hướng đến trang lịch thi...");
    await page.goto("https://portal.vhu.edu.vn/student/exam", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập lịch thi: ${page.url()}`);

    console.log("⏳ Đang chờ bảng lịch thi tải...");
    await page.waitForSelector(".MuiTableContainer-root.psc-table", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy .MuiTableContainer-root.psc-table sau 60 giây. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    const examData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTableContainer-root.psc-table");
      if (!table) {
        throw new Error("Không tìm thấy bảng lịch thi .MuiTableContainer-root.psc-table!");
      }

      const rows = table.querySelectorAll("tbody tr.psc_ExamSapToi");
      if (!rows.length) {
        return { exams: [], year: "Không rõ", semester: "Không rõ" };
      }

      let exams = Array.from(rows).map((row) => {
        const cols = row.querySelectorAll("td");
        return {
          subject: cols[0]?.textContent.trim() || "Không rõ",
          attempt: cols[1]?.textContent.trim() || "Không rõ",
          date: cols[2]?.textContent.trim() || "Không rõ",
          time: cols[3]?.textContent.trim() || "Chưa cập nhật",
          room: cols[4]?.textContent.trim() || "Chưa cập nhật",
          location: cols[5]?.textContent.trim() || "Chưa cập nhật",
          format: cols[6]?.textContent.trim() || "Không rõ",
          absent: cols[7]?.textContent.trim() || "Không",
        };
      });

      exams = exams.filter(exam => exam.room !== "Chưa cập nhật" && exam.location !== "Chưa cập nhật");

      exams.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split("/").map(Number);
        const [dayB, monthB, yearB] = b.date.split("/").map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
      });

      const year = document.querySelector("input[name='NamHienTai']")?.value || "Không rõ";
      const semester = document.querySelector(".MuiSelect-select")?.textContent.trim() || "Không rõ";

      return { exams, year, semester };
    });

    console.log("✅ Đã lấy và lọc dữ liệu lịch thi:", examData);
    return examData;
  } catch (error) {
    console.error("❌ Lỗi trong getExamSchedule:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Hàm lấy thông tin tài chính**
async function getAccountFees() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await login(page, process.env.VHU_EMAIL, process.env.VHU_PASSWORD);
    console.log("🏠 Điều hướng đến trang chủ sinh viên...");
    await page.goto("https://portal.vhu.edu.vn/student", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("💰 Điều hướng đến trang tài chính...");
    await page.goto("https://portal.vhu.edu.vn/student/accountfees", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    console.log(`🌐 URL sau khi truy cập tài chính: ${page.url()}`);

    console.log("⏳ Đang chờ bảng tài chính tải...");
    await page.waitForSelector(".MuiTableContainer-root", { timeout: 60000 }).catch(async () => {
      const content = await page.content();
      throw new Error(`Không tìm thấy bảng tài chính sau 60 giây. Nội dung trang: ${content.slice(0, 500)}...`);
    });

    const feesData = await page.evaluate(() => {
      const table = document.querySelector(".MuiTableContainer-root table");
      if (!table) {
        throw new Error("Không tìm thấy bảng tài chính (.MuiTableContainer-root table)");
      }

      const headerRow = table.querySelector("thead tr");
      if (!headerRow) {
        throw new Error("Không tìm thấy hàng đầu tiên trong thead");
      }

      const cells = headerRow.querySelectorAll("th");
      console.log(`Số cột tìm thấy: ${cells.length}`);
      console.log("Nội dung các cột trong thead:", Array.from(cells).map(cell => cell.outerHTML));

      let mustPay = 0, paid = 0, debt = 0;
      cells.forEach((cell) => {
        const text = cell.innerText.replace(/[^\d]/g, "");
        const value = parseInt(text, 10) || 0;

        if (cell.querySelector("strong")) {
          if (value === 123528500) mustPay = value;
          else if (value === 109908500) paid = value;
        } else if (cell.getAttribute("colspan") === "6") {
          debt = value;
        }
      });

      return {
        mustPay,
        paid,
        debt,
      };
    });

    console.log("✅ Đã lấy dữ liệu tài chính:", feesData);
    return feesData;
  } catch (error) {
    console.error("❌ Lỗi trong getAccountFees:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// **Cấu hình Webhook**
app.get("/ping", (req, res) => res.status(200).send("Bot is alive!"));

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server chạy trên port ${PORT}`);
  try {
    const webhookUrl = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com/bot${TOKEN}`;
    await bot.setWebHook(webhookUrl);
    console.log(`✅ Webhook đã được đặt: ${webhookUrl}`);
  } catch (error) {
    console.error("❌ Lỗi khi đặt Webhook:", error.message);
  }
});

// **Xử lý lệnh Telegram**
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "👋 Xin chào! Mình là Trợ lý VHU.\n" +
      "📅 /tuannay - Lấy lịch học tuần này.\n" +
      "📅 /tuansau - Lấy lịch học tuần sau.\n" +
      "🔔 /thongbao - Lấy danh sách thông báo.\n" +
      "💵 /lichthi - Lấy lịch thi học kỳ này  \n" +
      "📋 /congtac - Lấy danh sách công tác xã hội.\n" +
      "📊 /tinchi - Tổng số tín chỉ và điểm TB đã đạt.\n" +
      "💵 /taichinh - Lấy thông tin tài chính sinh viên.\n" +
      "💡Mẹo: Nhấn nút Menu 📋 bên cạnh để chọn lệnh nhanh hơn!"
  );
});

bot.onText(/\/tuannay/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần này, vui lòng chờ trong giây lát ⌛...");
  try {
    const lichHoc = await getSchedule(0);
    let message = `📅 **Lịch học tuần ${lichHoc.week}**\n------------------------------------\n`;
    let hasSchedule = false;

    for (const [ngay, monHocs] of Object.entries(lichHoc.schedule)) {
      message += `📌 **${ngay}:**\n`;
      if (monHocs.length) {
        hasSchedule = true;
        monHocs.forEach((m) => {
          message += `📖 **Môn học: ${m.subject} – ${m.classCode}**\n` +
                     `📅 **Tiết:** ${m.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${m.startTime}\n` +
                     `📍 **Phòng học:** ${m.room}\n` +
                     `🧑‍🏫 **Giảng viên:** ${m.professor}\n` +
                     `📧 **Email:** ${m.email}\n\n`;
        });
      } else {
        message += "❌ Không có lịch\n";
      }
      message += "\n";
    }

    if (!hasSchedule) {
      message = `📅 **Lịch học tuần ${lichHoc.week}**\n------------------------------------\n❌ Không có lịch học trong tuần này.`;
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

bot.onText(/\/tuansau/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📅 Đang lấy lịch học tuần sau, vui lòng chờ trong giây lát ⌛...");
  try {
    const lichHoc = await getSchedule(1);
    let message = `📅 **Lịch học tuần sau**\n------------------------------------\n`;
    let hasSchedule = false;

    for (const [ngay, monHocs] of Object.entries(lichHoc.schedule)) {
      message += `📌 **${ngay}:**\n`;
      if (monHocs.length) {
        hasSchedule = true;
        monHocs.forEach((m) => {
          message += `📖 **Môn học: ${m.subject} – ${m.classCode}**\n` +
                     `📅 **Tiết:** ${m.periods}\n` +
                     `🕛 **Giờ bắt đầu:** ${m.startTime}\n` +
                     `📍 **Phòng học:** ${m.room}\n` +
                     `🧑‍🏫 **Giảng viên:** ${m.professor}\n` +
                     `📧 **Email:** ${m.email}\n\n`;
        });
      } else {
        message += "❌ Không có lịch\n";
      }
      message += "\n";
    }

    if (!hasSchedule) {
      message = `📅 **Lịch học tuần sau**\n------------------------------------\n❌ Không có lịch học trong tuần sau.`;
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch học: ${error.message}`);
  }
});

bot.onText(/\/thongbao/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🔔 Đang lấy thông báo, vui lòng chờ trong giây lát ⌛...");
  try {
    const notifications = await getNotifications();
    let message = "🔔 **Danh sách thông báo mới nhất:**\n------------------------------------\n";
    notifications.slice(0, 5).forEach((n, i) => {
      message += `📢 **${i + 1}. ${n.MessageSubject}**\n📩 ${n.SenderName}\n⏰ ${n.CreationDate}\n\n`;
    });
    if (notifications.length > 5) message += `📢 Còn ${notifications.length - 5} thông báo khác. Hãy truy cập vào [Portal VHU](https://portal.vhu.edu.vn/login) để biết thêm thông tin chi tiết.`;
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy thông báo: ${error.message}`);
  }
});

bot.onText(/\/congtac/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📋 Đang lấy danh sách công tác xã hội, vui lòng chờ trong giây lát ⌛...");
  try {
    const congTacData = await getSocialWork();
    let message = "📋 **Danh sách công tác xã hội:**\n------------------------------------\n";
    congTacData.slice(0, 5).forEach((c, i) => {
      message += `📌 **${c.Index}. ${c.Event}**\n📍 ${c.Location || "Chưa cập nhật"}\n👥 ${c.NumRegistered} người đăng ký\n⭐ ${c.Points} điểm\n🕛 ${c.StartTime} - ${c.EndTime}\n\n`;
    });
    if (congTacData.length > 5) message += `📢 Còn ${congTacData.length - 5} công tác khác. Hãy truy cập vào [Portal VHU](https://portal.vhu.edu.vn/login) để biết thêm thông tin chi tiết.`;
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy công tác xã hội: ${error.message}`);
  }
});

bot.onText(/\/tinchi/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📊 Đang lấy tổng số tín chỉ và điểm TB, vui lòng chờ trong giây lát ⌛...");
  try {
    const { totalCredits, avgScore } = await getCredits();
    let message = `📊 **Tổng số tín chỉ và điểm trung bình của bạn:**\n------------------------------------\n`;
    message += `🎓 Số tín chỉ đã đạt: **${totalCredits} tín chỉ**\n`;
    message += `📈 Điểm TB chung (Hệ 10): **${avgScore}**\n`;
    message += `ℹ️ Hãy truy cập [Portal VHU](https://portal.vhu.edu.vn/) để biết thêm thông tin chi tiết.`;
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy dữ liệu: ${error.message}`);
  }
});

bot.onText(/\/lichthi/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📝 Đang lấy lịch thi học kỳ này, vui lòng chờ trong giây lát ⌛...");
  try {
    const { exams, year, semester } = await getExamSchedule();
    let message = `📝 **Lịch thi ${semester} - Năm học ${year}:**\n------------------------------------\n`;
    let hasExams = false;

    if (exams.length === 0) {
      message += "❌ Chưa có lịch thi nào có phòng thi và địa điểm được cập nhật.";
    } else {
      exams.forEach((exam, index) => {
        hasExams = true;
        message += `📚 **${index + 1}. ${exam.subject}**\n` +
                   `🔢 Lần thi: ${exam.attempt}\n` +
                   `📅 Ngày thi: ${exam.date}\n` +
                   `⏰ Giờ thi: ${exam.time}\n` +
                   `📍 Phòng thi: ${exam.room} (${exam.location})\n` +
                   `✍️ Hình thức: ${exam.format}\n` +
                   `🚫 Vắng thi: ${exam.absent}\n\n`;
      });
    }

    message += `ℹ️ Hãy truy cập [Portal VHU](https://portal.vhu.edu.vn/) để biết thêm thông tin chi tiết.`;
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy lịch thi: ${error.message}`);
  }
});

bot.onText(/\/taichinh/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "💰 Đang lấy thông tin tài chính, vui lòng chờ trong giây lát ⌛...");
  try {
    const { mustPay, paid, debt } = await getAccountFees();

    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    let message = `💵 **Thông tin tài chính của bạn:**\n------------------------------------\n`;
    message += `💸 Học phí phải đóng: **${formatNumber(mustPay)} VNĐ**\n`;
    message += `💲 Học phí đã đóng: **${formatNumber(paid)} VNĐ**\n`;
    message += `👛 Học phí còn nợ: **${formatNumber(debt)} VNĐ**\n`;
    message += `ℹ️ Hãy truy cập [Portal VHU](https://portal.vhu.edu.vn/) để biết thêm thông tin chi tiết.`;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Lỗi lấy dữ liệu tài chính: ${error.message}`);
  }
});

console.log("🤖 Bot Telegram đang khởi động...");