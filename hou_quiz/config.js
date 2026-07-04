(function () {
  "use strict";

  // Cấu hình môi trường API URL
  const CONFIG = {
    // Chạy local kết nối trực tiếp đến Hono Backend (local test)
    API_URL: "http://localhost:3001/api/v1"

    // Bao giờ hoàn thành chạy thực tế sẽ dùng link online (được cấu hình sẵn ở đây)
    // API_URL: "https://tailieu-hou.onrender.com/api/v1"
  };

  window.houQuizConfig = CONFIG;
})();
