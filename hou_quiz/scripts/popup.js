(function () {
  "use strict";

  // Danh sách settings keys lưu trữ ở chrome.storage.local
  const KEYS = {
    AUTO_SELECT_DOCS: "hou_auto_select_docs",
    SHOW_INFO_WIDGET: "hou_show_info_widget",
    HIGHLIGHT_ANSWERS: "hou_highlight_answers",
    AUTO_SELECT_ANSWERS: "hou_auto_select_answers",
    ENABLE_LOGS: "hou_enable_logs",
    SHOW_NETWORK_STATUS: "hou_show_network_status",
    THEME_MODE: "hou_ui_theme_mode",
    PRIMARY_COLOR: "hou_ui_primary_color"
  };

  // Khởi tạo các phần tử DOM cho Cấu hình quét
  const autoSelectDocs = document.getElementById("auto-select-docs");
  const showInfoWidget = document.getElementById("show-info-widget");
  const showInfoWidgetCard = document.getElementById("show-info-widget-card");
  const highlightAnswers = document.getElementById("highlight-answers");
  const autoSelectAnswers = document.getElementById("auto-select-answers");
  const enableLogs = document.getElementById("enable-logs");
  const showNetworkStatus = document.getElementById("show-network-status");
  const connectionStatus = document.querySelector(".connection-status");

  // Khởi động các phần tử DOM cho Giao diện & Màu sắc
  const themeBtns = document.querySelectorAll(".theme-btn");
  const colorDots = document.querySelectorAll(".color-dot");

  // Hàm cập nhật ẩn/hiện card "Hiển thị thông tin môn học"
  function toggleWidgetOptionVisibility() {
    if (autoSelectDocs.checked) {
      showInfoWidgetCard.style.display = "flex";
    } else {
      showInfoWidgetCard.style.display = "none";
    }
  }

  // Áp dụng theme và màu sắc vào DOM của popup
  function applyThemeToDom(mode, color) {
    const root = document.documentElement;

    // 1. Áp dụng màu chủ đạo
    const colorClasses = ["theme-green", "theme-blue", "theme-red", "theme-purple", "theme-orange", "theme-lime", "theme-black"];
    root.classList.remove(...colorClasses);
    root.classList.add(`theme-${color}`);

    // 2. Áp dụng theme (dark/light)
    const isDark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // 3. Cập nhật trạng thái active cho nút theme
    themeBtns.forEach(btn => {
      if (btn.getAttribute("data-value") === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // 4. Cập nhật trạng thái active cho nút color
    colorDots.forEach(dot => {
      if (dot.getAttribute("data-value") === color) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }

  // Load cài đặt cũ từ storage
  chrome.storage.local.get([
    KEYS.AUTO_SELECT_DOCS,
    KEYS.SHOW_INFO_WIDGET,
    KEYS.HIGHLIGHT_ANSWERS,
    KEYS.AUTO_SELECT_ANSWERS,
    KEYS.ENABLE_LOGS,
    KEYS.SHOW_NETWORK_STATUS,
    KEYS.THEME_MODE,
    KEYS.PRIMARY_COLOR
  ], (res) => {
    autoSelectDocs.checked = res[KEYS.AUTO_SELECT_DOCS] !== false;
    showInfoWidget.checked = res[KEYS.SHOW_INFO_WIDGET] !== false;
    highlightAnswers.checked = res[KEYS.HIGHLIGHT_ANSWERS] !== false;
    autoSelectAnswers.checked = res[KEYS.AUTO_SELECT_ANSWERS] !== false;
    enableLogs.checked = res[KEYS.ENABLE_LOGS] !== false;
    showNetworkStatus.checked = res[KEYS.SHOW_NETWORK_STATUS] !== false;
    
    if (connectionStatus) {
      connectionStatus.style.display = showNetworkStatus.checked ? "flex" : "none";
    }
    toggleWidgetOptionVisibility();

    const activeTheme = res[KEYS.THEME_MODE] || "system";
    const activeColor = res[KEYS.PRIMARY_COLOR] || "green";
    applyThemeToDom(activeTheme, activeColor);
  });

  // Gắn sự kiện lưu trữ cài đặt khi thay đổi
  autoSelectDocs.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.AUTO_SELECT_DOCS]: autoSelectDocs.checked });
    toggleWidgetOptionVisibility();
  });

  showInfoWidget.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.SHOW_INFO_WIDGET]: showInfoWidget.checked });
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

  showNetworkStatus.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.SHOW_NETWORK_STATUS]: showNetworkStatus.checked });
    if (connectionStatus) {
      connectionStatus.style.display = showNetworkStatus.checked ? "flex" : "none";
    }
  });

  // Gắn sự kiện cho các nút Theme
  themeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedTheme = btn.getAttribute("data-value");
      chrome.storage.local.get([KEYS.PRIMARY_COLOR], (res) => {
        const activeColor = res[KEYS.PRIMARY_COLOR] || "green";
        chrome.storage.local.set({ [KEYS.THEME_MODE]: selectedTheme });
        applyThemeToDom(selectedTheme, activeColor);
      });
    });
  });

  // Gắn sự kiện cho các nút Color
  colorDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const selectedColor = dot.getAttribute("data-value");
      chrome.storage.local.get([KEYS.THEME_MODE], (res) => {
        const activeTheme = res[KEYS.THEME_MODE] || "system";
        chrome.storage.local.set({ [KEYS.PRIMARY_COLOR]: selectedColor });
        applyThemeToDom(activeTheme, selectedColor);
      });
    });
  });
})();
