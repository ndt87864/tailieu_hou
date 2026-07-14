const { Redis } = require("ioredis");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function clearCache() {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  console.log(`📶 Đang kết nối tới Redis qua: ${redisUrl}`);
  
  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000
    });

    // Tạo một promise để chờ cho đến khi Redis sẵn sàng hoặc báo lỗi
    await new Promise((resolve, reject) => {
      redis.once("ready", resolve);
      redis.once("error", reject);
    });

    // Các prefix cần dọn dẹp
    const prefixes = ["docs", "questions", "categories"];
    let totalCleared = 0;

    for (const prefix of prefixes) {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        totalCleared += keys.length;
        console.log(`   🧹 Đã dọn dẹp ${keys.length} cache keys bắt đầu bằng prefix "${prefix}:"`);
      }
    }

    console.log(`✅ Hoàn tất dọn dẹp Redis cache. Tổng số keys đã xóa: ${totalCleared}`);
    await redis.quit();
  } catch (err) {
    console.error("⚠️ Không thể dọn dẹp Redis cache:", err.message);
  }
}

// Nếu chạy trực tiếp từ CLI
if (require.main === module) {
  clearCache();
}

module.exports = { clearCache };
