(function () {
  "use strict";

  const KEYS = {
    AUTO_SELECT_DOCS: "hou_auto_select_docs",
    SHOW_INFO_WIDGET: "hou_show_info_widget",
    HIGHLIGHT_ANSWERS: "hou_highlight_answers",
    AUTO_SELECT_ANSWERS: "hou_auto_select_answers",
    ENABLE_LOGS: "hou_enable_logs",
    SHOW_NETWORK_STATUS: "hou_show_network_status",
    THEME_MODE: "hou_ui_theme_mode",
    PRIMARY_COLOR: "hou_ui_primary_color",
    DB_MODE: "hou_db_mode"
  };

  const autoSelectDocs = document.getElementById("auto-select-docs");
  const showInfoWidget = document.getElementById("show-info-widget");
  const highlightAnswers = document.getElementById("highlight-answers");
  const autoSelectAnswers = document.getElementById("auto-select-answers");
  const enableLogs = document.getElementById("enable-logs");
  const showNetworkStatus = document.getElementById("show-network-status");
  const connectionStatus = document.querySelector(".connection-status");
  const dbModeSelect = document.getElementById("db-mode-select");

  const themeBtns = document.querySelectorAll(".theme-btn");
  const colorDots = document.querySelectorAll(".color-dot");

  function applyThemeToDom(mode, color) {
    const root = document.documentElement;

    const colorClasses = ["theme-green", "theme-blue", "theme-red", "theme-purple", "theme-orange", "theme-lime", "theme-black"];
    root.classList.remove(...colorClasses);
    root.classList.add(`theme-${color}`);

    const isDark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    themeBtns.forEach(btn => {
      if (btn.getAttribute("data-value") === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    colorDots.forEach(dot => {
      if (dot.getAttribute("data-value") === color) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }

  function updateConnectionStatusText(dbMode) {
    if (!connectionStatus) return;
    const dot = connectionStatus.querySelector(".status-dot");
    const textSpan = connectionStatus.querySelector("span:not(.status-dot)");
    
    if (dbMode === "off") {
      if (dot) dot.style.backgroundColor = "var(--danger)";
      if (textSpan) textSpan.textContent = "Trạng thái: Đã ngắt kết nối (off)";
    } else if (dbMode === "question_crawler") {
      if (dot) dot.style.backgroundColor = "var(--warn)";
      if (textSpan) textSpan.textContent = "Kết nối: LMS Crawler (crawler_questions/courses)";
    } else {
      if (dot) dot.style.backgroundColor = "var(--success)";
      if (textSpan) textSpan.textContent = "Kết nối: Ngân hàng chính (questions/documents)";
    }
  }

  // Load cài đặt từ storage
  chrome.storage.local.get([
    KEYS.AUTO_SELECT_DOCS,
    KEYS.SHOW_INFO_WIDGET,
    KEYS.HIGHLIGHT_ANSWERS,
    KEYS.AUTO_SELECT_ANSWERS,
    KEYS.ENABLE_LOGS,
    KEYS.SHOW_NETWORK_STATUS,
    KEYS.THEME_MODE,
    KEYS.PRIMARY_COLOR,
    KEYS.DB_MODE
  ], (res) => {
    autoSelectDocs.checked = res[KEYS.AUTO_SELECT_DOCS] !== false;
    showInfoWidget.checked = res[KEYS.SHOW_INFO_WIDGET] !== false;
    highlightAnswers.checked = res[KEYS.HIGHLIGHT_ANSWERS] !== false;
    autoSelectAnswers.checked = res[KEYS.AUTO_SELECT_ANSWERS] !== false;
    enableLogs.checked = res[KEYS.ENABLE_LOGS] === true;
    showNetworkStatus.checked = res[KEYS.SHOW_NETWORK_STATUS] === true;
    
    const dbMode = res[KEYS.DB_MODE] || "questions";
    if (dbModeSelect) {
      dbModeSelect.value = dbMode;
    }
    updateConnectionStatusText(dbMode);
    
    if (connectionStatus) {
      if (showNetworkStatus.checked) {
        connectionStatus.classList.remove("u-display-none");
      } else {
        connectionStatus.classList.add("u-display-none");
      }
    }

    if (window.houQuizDocFilter) {
      window.houQuizDocFilter.toggleWidgetOptionVisibility();
    }

    const activeTheme = res[KEYS.THEME_MODE] || "system";
    const activeColor = res[KEYS.PRIMARY_COLOR] || "green";
    applyThemeToDom(activeTheme, activeColor);
  });

  // Sự kiện lưu cài đặt
  if (dbModeSelect) {
    dbModeSelect.addEventListener("change", () => {
      const mode = dbModeSelect.value;
      chrome.storage.local.set({ [KEYS.DB_MODE]: mode });
      updateConnectionStatusText(mode);
    });
  }

  autoSelectDocs.addEventListener("change", () => {
    chrome.storage.local.set({ [KEYS.AUTO_SELECT_DOCS]: autoSelectDocs.checked });
    if (window.houQuizDocFilter) {
      window.houQuizDocFilter.toggleWidgetOptionVisibility();
    }
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
      if (showNetworkStatus.checked) {
        connectionStatus.classList.remove("u-display-none");
      } else {
        connectionStatus.classList.add("u-display-none");
      }
    }
  });

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

  // Mở/Đóng Modal Giao diện & Màu sắc
  const btnUiSettings = document.getElementById("btn-ui-settings");
  const uiSettingsOverlay = document.getElementById("ui-settings-overlay");
  const btnCloseUiSettings = document.getElementById("btn-close-ui-settings");

  if (btnUiSettings && uiSettingsOverlay) {
    btnUiSettings.addEventListener("click", () => {
      uiSettingsOverlay.classList.remove("u-display-none");
      uiSettingsOverlay.offsetHeight; // force reflow
      uiSettingsOverlay.classList.add("show");
    });

    if (btnCloseUiSettings) {
      btnCloseUiSettings.addEventListener("click", closeModal);
    }

    uiSettingsOverlay.addEventListener("click", (e) => {
      if (e.target === uiSettingsOverlay) {
        closeModal();
      }
    });

    function closeModal() {
      uiSettingsOverlay.classList.remove("show");
      setTimeout(() => {
        if (!uiSettingsOverlay.classList.contains("show")) {
          uiSettingsOverlay.classList.add("u-display-none");
        }
      }, 200);
    }
  }
})();
