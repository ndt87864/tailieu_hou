(function () {
  "use strict";

  // Log luon tat o production -- khong doc storage de tranh bi override
  // De bat log tam thoi khi debug: chay window.houLogsEnabled = true trong console
  window.houLogsEnabled = false;

  // Sao luu cac ham console goc
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  // Ghi de console.log / warn / error
  console.log = function (...args) {
    if (window.houLogsEnabled === true) {
      originalLog.apply(console, args);
    }
  };

  console.warn = function (...args) {
    if (window.houLogsEnabled === true) {
      originalWarn.apply(console, args);
    }
  };

  console.error = function (...args) {
    if (window.houLogsEnabled === true) {
      originalError.apply(console, args);
    }
  };

  // Cau hinh moi truong API URL
  const CONFIG = {
    API_URL: "https://tailieuehou.id.vn/api/v1",
    LOCAL_API_URL: "http://localhost:3001/api/v1",
    VPS_API_URL: "https://tailieuehou.id.vn/api/v1"
  };

  window.houQuizConfig = CONFIG;
})();
