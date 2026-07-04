(function () {
  "use strict";

  // Danh sách settings keys lưu trữ ở chrome.storage.local
  const KEYS = {
    AUTO_SELECT_DOCS: "hou_auto_select_docs",
    HIGHLIGHT_ANSWERS: "hou_highlight_answers",
    AUTO_SELECT_ANSWERS: "hou_auto_select_answers",
    ENABLE_LOGS: "hou_enable_logs"
  };

  // Khởi tạo các phần tử DOM
  const autoSelectDocs = document.getElementById("auto-select-docs");
  const highlightAnswers = document.getElementById("highlight-answers");
  const autoSelectAnswers = document.getElementById("auto-select-answers");
  const enableLogs = document.getElementById("enable-logs");

  // Load cài đặt cũ từ storage
  chrome.storage.local.get([
    KEYS.AUTO_SELECT_DOCS,
    KEYS.HIGHLIGHT_ANSWERS,
    KEYS.AUTO_SELECT_ANSWERS,
    KEYS.ENABLE_LOGS
  ], (res) => {
    autoSelectDocs.checked = res[KEYS.AUTO_SELECT_DOCS] !== false; // mặc định true
    highlightAnswers.checked = res[KEYS.HIGHLIGHT_ANSWERS] !== false; // mặc định true
    autoSelectAnswers.checked = res[KEYS.AUTO_SELECT_ANSWERS] !== false; // mặc định true
    enableLogs.checked = res[KEYS.ENABLE_LOGS] !== false; // mặc định true
  });

  // Gắn sự kiện lưu trữ cài đặt khi thay đổi
  autoSelectDocs.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.AUTO_SELECT_DOCS]: autoSelectDocs.checked });
  });

  highlightAnswers.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.HIGHLIGHT_ANSWERS]: highlightAnswers.checked });
  });

  autoSelectAnswers.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.AUTO_SELECT_ANSWERS]: autoSelectAnswers.checked });
  });

  enableLogs.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.ENABLE_LOGS]: enableLogs.checked });
  });
})();
