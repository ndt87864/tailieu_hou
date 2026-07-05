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
  // Khởi tạo các phần tử DOM cho Cấu hình quét
  const autoSelectDocs = document.getElementById("auto-select-docs");
  const manualDocSummaryBox = document.getElementById("manual-doc-summary-box");
  const selectedDocsText = document.getElementById("selected-docs-text");
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

  // Hàm cập nhật ẩn/hiện card "Hiển thị thông tin môn học" và chế độ chỉ xem của tài liệu đã chọn
  function toggleWidgetOptionVisibility() {
    if (manualDocSummaryBox) {
      manualDocSummaryBox.style.display = "flex";
    }
    if (autoSelectDocs.checked) {
      showInfoWidgetCard.style.display = "flex";
    } else {
      showInfoWidgetCard.style.display = "none";
    }
    renderManualDocSummary();
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

  // Xử lý mở/đóng Modal Giao diện & Màu sắc
  const btnUiSettings = document.getElementById("btn-ui-settings");
  const uiSettingsOverlay = document.getElementById("ui-settings-overlay");
  const btnCloseUiSettings = document.getElementById("btn-close-ui-settings");

  if (btnUiSettings && uiSettingsOverlay) {
    btnUiSettings.addEventListener("click", () => {
      uiSettingsOverlay.style.display = "flex";
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
          uiSettingsOverlay.style.display = "none";
        }
      }, 200);
    }
  }

  // ─── Xử lý chọn tài liệu & danh mục thủ công ───
  let allDocumentsList = [];

  function fetchDocumentsFromAPI() {
    const fetchShowNetwork = document.getElementById("show-network-status")?.checked !== false;
    const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };
    const apiUrl = `${config.API_URL}/documents`;
    
    return new Promise((resolve, reject) => {
      if (fetchShowNetwork) {
        fetch(apiUrl)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error("Lỗi tải tài liệu");
          })
          .then(data => resolve(data.documents || []))
          .catch(err => reject(err));
      } else {
        chrome.runtime.sendMessage({ type: "FETCH_API", url: apiUrl }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (res && res.success) {
            resolve(res.data.documents || []);
          } else {
            reject(new Error(res ? res.error : "Không thể fetch tài liệu"));
          }
        });
      }
    });
  }

  // Hiển thị tóm tắt tài liệu đã chọn ở popup chính
  function renderManualDocSummary() {
    const textEl = document.getElementById("selected-docs-text");
    const btnOpenFilterModal = document.getElementById("btn-open-filter-modal");
    if (!textEl) return;

    if (autoSelectDocs && autoSelectDocs.checked) {
      textEl.textContent = "Tự động nhận diện môn học";
      textEl.title = "Hệ thống đang tự động nhận diện môn học và tải tài liệu tương ứng từ trang LMS.";
      if (btnOpenFilterModal) {
        btnOpenFilterModal.disabled = true;
        btnOpenFilterModal.classList.add("disabled");
        btnOpenFilterModal.title = "Chế độ tự động đang bật - Không thể chọn thủ công";
      }
      if (manualDocSummaryBox) {
        manualDocSummaryBox.classList.add("readonly");
      }
    } else {
      if (btnOpenFilterModal) {
        btnOpenFilterModal.disabled = false;
        btnOpenFilterModal.classList.remove("disabled");
        btnOpenFilterModal.title = "Chọn danh mục & tài liệu";
      }
      if (manualDocSummaryBox) {
        manualDocSummaryBox.classList.remove("readonly");
      }
      chrome.storage.local.get(["hou_selected_doc_titles"], (res) => {
        const titles = res.hou_selected_doc_titles || [];
        if (titles.length === 0) {
          textEl.textContent = "Chưa chọn tài liệu nào";
          textEl.title = "Chưa chọn tài liệu nào";
        } else if (titles.length <= 2) {
          const text = titles.join(", ");
          textEl.textContent = text;
          textEl.title = text;
        } else {
          const text = `${titles[0]}, ${titles[1]} +${titles.length - 2}`;
          textEl.textContent = text;
          textEl.title = titles.join(", ");
        }
      });
    }
  }

  // Quản lý ẩn hiện Filter Document Modal
  const filterDocOverlay = document.getElementById("filter-doc-overlay");
  const btnOpenFilterModal = document.getElementById("btn-open-filter-modal");
  const btnCloseFilterModal = document.getElementById("btn-close-filter-modal");
  const modalCategoriesList = document.getElementById("modal-categories-list");
  const modalDocumentsList = document.getElementById("modal-documents-list");
  const modalSearchInput = document.getElementById("modal-search-input");
  const btnSaveFilter = document.getElementById("btn-save-filter");
  const chkAllCategories = document.getElementById("chk-all-categories");
  const chkAllDocuments = document.getElementById("chk-all-documents");
  const btnClearDocs = document.getElementById("btn-clear-docs");

  if (btnClearDocs) {
    btnClearDocs.addEventListener("click", () => {
      chrome.storage.local.set({
        hou_selected_doc_ids: [],
        hou_selected_doc_titles: [],
        hou_selected_doc_id: ""
      }, () => {
        if (chkAllDocuments) chkAllDocuments.checked = false;
        filterAndRenderDocuments();
        renderManualDocSummary();
      });
    });
  }

  if (btnOpenFilterModal) {
    btnOpenFilterModal.addEventListener("click", openFilterModal);
  }
  if (btnCloseFilterModal) {
    btnCloseFilterModal.addEventListener("click", closeFilterModal);
  }
  if (filterDocOverlay) {
    filterDocOverlay.addEventListener("click", (e) => {
      if (e.target === filterDocOverlay) closeFilterModal();
    });
  }

  function openFilterModal() {
    if (filterDocOverlay) {
      filterDocOverlay.style.display = "flex";
      setTimeout(() => {
        filterDocOverlay.classList.add("show");
      }, 10);
      loadModalCategories();
    }
  }

  function closeFilterModal() {
    if (filterDocOverlay) {
      filterDocOverlay.classList.remove("show");
      setTimeout(() => {
        if (!filterDocOverlay.classList.contains("show")) {
          filterDocOverlay.style.display = "none";
        }
      }, 200);
    }
  }

  // Đồng bộ trạng thái checkbox "Chọn tất cả" của danh mục
  function updateSelectAllCategoriesCheckbox() {
    if (!chkAllCategories || !modalCategoriesList) return;
    const catCheckboxes = modalCategoriesList.querySelectorAll(".category-checkbox");
    if (catCheckboxes.length === 0) {
      chkAllCategories.checked = false;
      return;
    }
    const allChecked = Array.from(catCheckboxes).every(chk => chk.checked);
    chkAllCategories.checked = allChecked;
  }

  // Đồng bộ trạng thái checkbox "Chọn tất cả" của tài liệu
  function updateSelectAllDocumentsCheckbox() {
    if (!chkAllDocuments || !modalDocumentsList) return;
    const docCheckboxes = modalDocumentsList.querySelectorAll(".document-checkbox");
    if (docCheckboxes.length === 0) {
      chkAllDocuments.checked = false;
      return;
    }
    const allChecked = Array.from(docCheckboxes).every(chk => chk.checked);
    chkAllDocuments.checked = allChecked;
  }

  // Đăng ký sự kiện click cho checkbox chọn tất cả danh mục
  chkAllCategories?.addEventListener("change", (e) => {
    if (!modalCategoriesList) return;
    const isChecked = e.target.checked;
    const catCheckboxes = modalCategoriesList.querySelectorAll(".category-checkbox");
    catCheckboxes.forEach(chk => {
      chk.checked = isChecked;
    });
    filterAndRenderDocuments();
  });

  // Đăng ký sự kiện click cho checkbox chọn tất cả tài liệu
  chkAllDocuments?.addEventListener("change", (e) => {
    if (!modalDocumentsList) return;
    const isChecked = e.target.checked;
    const docCheckboxes = modalDocumentsList.querySelectorAll(".document-checkbox");
    docCheckboxes.forEach(chk => {
      chk.checked = isChecked;
    });
  });

  async function loadModalCategories() {
    if (!modalCategoriesList || !modalDocumentsList) return;

    modalCategoriesList.innerHTML = `<div class="no-docs-placeholder">Đang tải danh mục...</div>`;
    modalDocumentsList.innerHTML = `<div class="no-docs-placeholder">Đang tải tài liệu...</div>`;
    if (modalSearchInput) modalSearchInput.value = "";
    if (chkAllCategories) chkAllCategories.checked = false;
    if (chkAllDocuments) chkAllDocuments.checked = false;

    try {
      const docs = await fetchDocumentsFromAPI();
      allDocumentsList = docs;

      const categoriesMap = new Map();
      docs.forEach(doc => {
        if (doc.category_id && doc.category) {
          categoriesMap.set(doc.category_id, doc.category.title);
        }
      });

      if (categoriesMap.size === 0) {
        modalCategoriesList.innerHTML = `<div class="no-docs-placeholder">Không có danh mục nào</div>`;
        modalDocumentsList.innerHTML = `<div class="no-docs-placeholder">Không tìm thấy tài liệu nào</div>`;
        return;
      }

      chrome.storage.local.get(["hou_selected_category_ids"], (res) => {
        let savedCatIds = res.hou_selected_category_ids;
        
        // Nếu chưa lưu lần nào, mặc định chỉ chọn danh mục đầu tiên (giảm tải hệ thống)
        if (!savedCatIds || !Array.isArray(savedCatIds)) {
          const firstCatId = Array.from(categoriesMap.keys())[0];
          savedCatIds = firstCatId ? [firstCatId] : [];
        }

        let catHTML = "";
        categoriesMap.forEach((title, id) => {
          const isChecked = savedCatIds.includes(id);
          catHTML += `
            <label class="doc-checkbox-item">
              <input type="checkbox" class="category-checkbox" value="${id}" ${isChecked ? "checked" : ""}>
              <span class="doc-checkbox-title">${escapeHTML(title)}</span>
            </label>
          `;
        });
        modalCategoriesList.innerHTML = catHTML;

        // Gắn listener change cho từng checkbox category
        modalCategoriesList.querySelectorAll(".category-checkbox").forEach(chk => {
          chk.addEventListener("change", () => {
            updateSelectAllCategoriesCheckbox();
            filterAndRenderDocuments();
          });
        });

        updateSelectAllCategoriesCheckbox();
        filterAndRenderDocuments();
      });
    } catch (err) {
      console.error("[ManualDocSelect] Lỗi tải dữ liệu:", err);
      modalCategoriesList.innerHTML = `<div class="no-docs-placeholder">Lỗi tải danh mục môn học</div>`;
      modalDocumentsList.innerHTML = `<div class="no-docs-placeholder">Không thể tải tài liệu do lỗi kết nối</div>`;
    }
  }

  function filterAndRenderDocuments() {
    if (!modalDocumentsList || !modalCategoriesList) return;

    // Lấy các category ID đang được checked
    const checkedCats = modalCategoriesList.querySelectorAll(".category-checkbox:checked");
    const selectedCategoryIds = Array.from(checkedCats).map(input => input.value);
    const searchQuery = modalSearchInput ? modalSearchInput.value.trim().toLowerCase() : "";

    let filteredDocs = allDocumentsList;

    // 1. Lọc theo các danh mục được checked
    filteredDocs = filteredDocs.filter(doc => selectedCategoryIds.includes(doc.category_id));

    // 2. Lọc theo từ khóa tìm kiếm (theo tên tài liệu hoặc tên danh mục)
    if (searchQuery) {
      filteredDocs = filteredDocs.filter(doc => {
        const docTitleMatch = doc.title.toLowerCase().includes(searchQuery);
        const catTitleMatch = doc.category && doc.category.title && doc.category.title.toLowerCase().includes(searchQuery);
        return docTitleMatch || catTitleMatch;
      });
    }

    if (filteredDocs.length === 0) {
      modalDocumentsList.innerHTML = `<div class="no-docs-placeholder">Không tìm thấy tài liệu phù hợp</div>`;
      if (chkAllDocuments) chkAllDocuments.checked = false;
      return;
    }

    chrome.storage.local.get(["hou_selected_doc_ids"], (res) => {
      const selectedDocIds = res.hou_selected_doc_ids || [];
      let docsHTML = "";
      
      filteredDocs.forEach(doc => {
        const isChecked = selectedDocIds.includes(doc.id);
        docsHTML += `
          <label class="doc-checkbox-item">
            <input type="checkbox" class="document-checkbox" value="${doc.id}" data-title="${escapeHTML(doc.title)}" ${isChecked ? "checked" : ""}>
            <span class="doc-checkbox-title">${escapeHTML(doc.title)}</span>
          </label>
        `;
      });
      modalDocumentsList.innerHTML = docsHTML;

      // Gắn listener change cho từng checkbox tài liệu
      modalDocumentsList.querySelectorAll(".document-checkbox").forEach(chk => {
        chk.addEventListener("change", updateSelectAllDocumentsCheckbox);
      });

      updateSelectAllDocumentsCheckbox();
    });
  }

  // Sự kiện gõ từ khóa tìm kiếm
  modalSearchInput?.addEventListener("input", filterAndRenderDocuments);

  // Sự kiện Áp dụng cài đặt lọc
  if (btnSaveFilter) {
    btnSaveFilter.addEventListener("click", () => {
      if (!modalCategoriesList || !modalDocumentsList) return;

      const checkedCats = modalCategoriesList.querySelectorAll(".category-checkbox:checked");
      const selectedCategoryIds = Array.from(checkedCats).map(input => input.value);

      const checkedDocs = modalDocumentsList.querySelectorAll(".document-checkbox:checked");
      const selectedDocIds = [];
      const selectedDocTitles = [];

      checkedDocs.forEach(input => {
        selectedDocIds.push(input.value);
        selectedDocTitles.push(input.getAttribute("data-title"));
      });

      chrome.storage.local.set({
        hou_selected_category_ids: selectedCategoryIds,
        hou_selected_doc_ids: selectedDocIds,
        hou_selected_doc_titles: selectedDocTitles,
        // Lưu tương thích ngược cho solver cũ chỉ đọc hou_selected_doc_id và hou_selected_category_id
        hou_selected_category_id: selectedCategoryIds[0] || "",
        hou_selected_doc_id: selectedDocIds[0] || ""
      }, () => {
        renderManualDocSummary();
        closeFilterModal();
      });
    });
  }

  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
