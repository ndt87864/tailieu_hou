(function () {
  "use strict";

  // Lắng nghe các yêu cầu gửi từ Content Script hoặc Popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_API") {
      fetch(message.url, message.options || {})
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          sendResponse({ success: true, data: data });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Giữ cổng kết nối mở để phản hồi bất đồng bộ
    }
  });
})();
