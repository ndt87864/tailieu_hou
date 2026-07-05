(function () {
  "use strict";

  // Quản lý bật tắt tất cả log của extension
  window.houLogsEnabled = null; // null: đang đợi load từ storage
  const logBuffer = [];

  // Sao lưu các hàm console gốc
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  function applyLogState(enabled) {
    window.houLogsEnabled = enabled;
    if (enabled) {
      // Xả buffer log tạm thời
      while (logBuffer.length > 0) {
        const item = logBuffer.shift();
        if (item.type === "log") originalLog.apply(console, item.args);
        else if (item.type === "warn") originalWarn.apply(console, item.args);
        else if (item.type === "error") originalError.apply(console, item.args);
      }
    } else {
      // Tắt log thì xóa sạch buffer
      logBuffer.length = 0;
    }
  }

  // Khởi tạo lấy cấu hình log từ storage
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["hou_enable_logs"], (res) => {
      // Mặc định bật log nếu chưa được cài đặt
      const enabled = res.hou_enable_logs !== false;
      applyLogState(enabled);
    });

    // Lắng nghe thay đổi từ popup để cập nhật realtime không cần reload trang
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.hou_enable_logs) {
        const enabled = changes.hou_enable_logs.newValue !== false;
        applyLogState(enabled);
      }
    });
  } else {
    // Dự phòng nếu chạy ngoài Extension context
    applyLogState(true);
  }

  // Ghi đè console.log, console.warn, console.error
  console.log = function (...args) {
    if (window.houLogsEnabled === true) {
      originalLog.apply(console, args);
    } else if (window.houLogsEnabled === null) {
      logBuffer.push({ type: "log", args });
    }
  };

  console.warn = function (...args) {
    if (window.houLogsEnabled === true) {
      originalWarn.apply(console, args);
    } else if (window.houLogsEnabled === null) {
      logBuffer.push({ type: "warn", args });
    }
  };

  console.error = function (...args) {
    if (window.houLogsEnabled === true) {
      originalError.apply(console, args);
    } else if (window.houLogsEnabled === null) {
      logBuffer.push({ type: "error", args });
    }
  };

  // Cấu hình môi trường API URL
  const CONFIG = {
    // Chạy local kết nối trực tiếp đến Hono Backend (local test)
    API_URL: "http://localhost:3001/api/v1"

    // Bao giờ hoàn thành chạy thực tế sẽ dùng link online (được cấu hình sẵn ở đây)
    // API_URL: "https://tailieu-hou.onrender.com/api/v1"
  };

  window.houQuizConfig = CONFIG;
})();
