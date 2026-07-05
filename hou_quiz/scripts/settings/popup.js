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

  // Xử lý Quét câu hỏi & Lưu CSDL
  const btnScan = document.getElementById("btn-scan-questions");
  const scanStatusBox = document.getElementById("scan-status-box");
  const scanStatusText = document.getElementById("scan-status-text");
  const scanStatusDetails = document.getElementById("scan-status-details");

  if (btnScan) {
    btnScan.addEventListener("click", async () => {
      btnScan.disabled = true;
      btnScan.textContent = "Đang quét...";
      scanStatusBox.style.display = "flex";
      scanStatusText.textContent = "Đang kết nối tới trang làm bài...";
      scanStatusDetails.textContent = "";

      try {
        // Query tab hiện tại
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("Không tìm thấy tab hoạt động.");

        // Gửi tin nhắn yêu cầu quét câu hỏi tới Content Script (scanner.js)
        chrome.tabs.sendMessage(tab.id, { action: "scanQuestions" }, async (response) => {
          if (chrome.runtime.lastError) {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
            scanStatusText.textContent = "Lỗi kết nối trang.";
            scanStatusDetails.textContent = "Hãy chắc chắn bạn đang ở trang xem lại bài (review) và đã tải lại trang.";
            return;
          }

          if (!response || !response.success) {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
            scanStatusText.textContent = "Quét thất bại.";
            scanStatusDetails.textContent = response?.error || "Không thể quét được câu hỏi.";
            return;
          }

          const questions = response.questions || [];
          if (questions.length === 0) {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
            scanStatusText.textContent = "Không tìm thấy câu hỏi.";
            scanStatusDetails.textContent = "Trang này không có câu hỏi nào hoặc không được hỗ trợ quét.";
            return;
          }

          scanStatusText.textContent = `Đã quét được ${questions.length} câu. Đang lấy thông tin tài liệu...`;

          // Lấy thông tin tài liệu môn học đã được nhận diện tự động
          chrome.storage.local.get(["hou_current_course", "hou_current_doc"], async (storeRes) => {
            const courseTitle = storeRes.hou_current_course;
            if (!courseTitle) {
              btnScan.disabled = false;
              btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
              scanStatusText.textContent = "Không có tài liệu.";
              scanStatusDetails.textContent = "Không phát hiện được môn học hiện tại. Hãy mở tab làm bài.";
              return;
            }

            // Gọi API backend tìm kiếm tài liệu theo môn học
            try {
              // Lấy API_URL từ config
              const config = await new Promise((resolve) => {
                chrome.storage.local.get(["hou_ui_theme_mode"], () => {
                  resolve(window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" });
                });
              });

              scanStatusText.textContent = `Đang kết nối backend tìm tài liệu cho môn: ${courseTitle}...`;
              
              // 1. Tải danh sách documents
              const fetchShowNetwork = await new Promise(resolve => {
                chrome.storage.local.get(["hou_show_network_status"], res => {
                  resolve(res.hou_show_network_status !== false);
                });
              });

              let docList = [];
              if (fetchShowNetwork) {
                const docRes = await fetch(`${config.API_URL}/documents`);
                if (docRes.ok) {
                  const payload = await docRes.json();
                  docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
                }
              } else {
                const res = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({ type: "FETCH_API", url: `${config.API_URL}/documents` }, resolve);
                });
                if (res && res.success) {
                  const payload = res.data;
                  docList = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.documents) ? payload.documents : []);
                }
              }

              // 2. Tìm tài liệu khớp nhất
              let matchedDoc = null;
              if (docList.length > 0) {
                const cleanWebTitle = window.houQuizUtils.normalizeTextForMatching(courseTitle);
                matchedDoc = docList.find(doc => {
                  const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
                  return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
                });
              }

              if (!matchedDoc) {
                // Không thấy document tương ứng -> Tạo document mới dưới Category mặc định đầu tiên hoặc category chung
                scanStatusText.textContent = `Không tìm thấy tài liệu phù hợp. Đang tạo tài liệu mới: "${courseTitle}"...`;
                
                // Lấy danh sách category
                let categories = [];
                const catUrl = `${config.API_URL}/categories`;
                if (fetchShowNetwork) {
                  const catRes = await fetch(catUrl);
                  if (catRes.ok) categories = await catRes.json();
                } else {
                  const res = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "FETCH_API", url: catUrl }, resolve);
                  });
                  if (res && res.success) categories = res.data;
                }

                let categoryId = categories && categories[0] ? categories[0].id : null;
                if (!categoryId) {
                  // Tạo category mặc định nếu hoàn toàn trống
                  const createCatUrl = `${config.API_URL}/categories`;
                  const options = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "Học phần LMS" })
                  };
                  let newCat = null;
                  if (fetchShowNetwork) {
                    const createCatRes = await fetch(createCatUrl, options);
                    if (createCatRes.ok) newCat = await createCatRes.json();
                  } else {
                    const res = await new Promise((resolve) => {
                      chrome.runtime.sendMessage({ type: "FETCH_API", url: createCatUrl, options }, resolve);
                    });
                    if (res && res.success) newCat = res.data;
                  }
                  categoryId = newCat ? newCat.id : null;
                }

                if (!categoryId) throw new Error("Không thể khởi tạo Category lưu trữ.");

                // Tạo tài liệu mới
                const createDocUrl = `${config.API_URL}/documents`;
                const createDocOptions = {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: courseTitle, categoryId: categoryId })
                };
                
                if (fetchShowNetwork) {
                  const createDocRes = await fetch(createDocUrl, createDocOptions);
                  if (createDocRes.ok) matchedDoc = await createDocRes.json();
                } else {
                  const res = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ type: "FETCH_API", url: createDocUrl, options: createDocOptions }, resolve);
                  });
                  if (res && res.success) matchedDoc = res.data;
                }
              }

              if (!matchedDoc || !matchedDoc.id) {
                throw new Error("Không thể nhận diện hoặc tạo tài liệu lưu trữ môn học.");
              }

              // 3. Đẩy danh sách câu hỏi lên Backend lưu vào DB
              scanStatusText.textContent = `Đang lưu ${questions.length} câu vào tài liệu: "${matchedDoc.title}"...`;
              
              // Gọi API lưu câu hỏi hàng loạt
              const saveQuestionsUrl = `${config.API_URL}/questions/bulk`;
              const saveOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  documentId: matchedDoc.id,
                  questions: questions.map(q => ({
                    question: q.question,
                    answer: q.answer,
                    choices: q.choices,
                    stt: q.stt
                  }))
                })
              };

              let saveResult = null;
              if (fetchShowNetwork) {
                const saveRes = await fetch(saveQuestionsUrl, saveOptions);
                if (saveRes.ok) saveResult = await saveRes.json();
              } else {
                const res = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({ type: "FETCH_API", url: saveQuestionsUrl, options: saveOptions }, resolve);
                });
                if (res && res.success) saveResult = res.data;
              }

              btnScan.disabled = false;
              btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
              scanStatusText.textContent = "Thành công!";
              
              const added = saveResult ? (saveResult.added || saveResult.successCount || questions.length) : questions.length;
              scanStatusDetails.textContent = `Đã đồng bộ ${added} câu hỏi vào CSDL của tài liệu "${matchedDoc.title}".`;
              
            } catch (err) {
              btnScan.disabled = false;
              btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
              scanStatusText.textContent = "Lỗi lưu CSDL.";
              scanStatusDetails.textContent = err.message || String(err);
            }
          });
        });
      } catch (err) {
        btnScan.disabled = false;
        btnScan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Quét & Lưu câu hỏi`;
        scanStatusText.textContent = "Lỗi khởi chạy.";
        scanStatusDetails.textContent = err.message || String(err);
      }
    });
  }
})();
