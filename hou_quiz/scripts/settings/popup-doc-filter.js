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
    PRIMARY_COLOR: "hou_ui_primary_color"
  };

  const autoSelectDocs = document.getElementById("auto-select-docs");
  const manualDocSummaryBox = document.getElementById("manual-doc-summary-box");
  const selectedDocsText = document.getElementById("selected-docs-text");
  
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

  chkAllCategories?.addEventListener("change", (e) => {
    if (!modalCategoriesList) return;
    const isChecked = e.target.checked;
    const catCheckboxes = modalCategoriesList.querySelectorAll(".category-checkbox");
    catCheckboxes.forEach(chk => {
      chk.checked = isChecked;
    });
    filterAndRenderDocuments();
  });

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

    const checkedCats = modalCategoriesList.querySelectorAll(".category-checkbox:checked");
    const selectedCategoryIds = Array.from(checkedCats).map(input => input.value);
    const searchQuery = modalSearchInput ? modalSearchInput.value.trim().toLowerCase() : "";

    let filteredDocs = allDocumentsList;
    filteredDocs = filteredDocs.filter(doc => selectedCategoryIds.includes(doc.category_id));

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

      modalDocumentsList.querySelectorAll(".document-checkbox").forEach(chk => {
        chk.addEventListener("change", updateSelectAllDocumentsCheckbox);
      });

      updateSelectAllDocumentsCheckbox();
    });
  }

  modalSearchInput?.addEventListener("input", filterAndRenderDocuments);

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

  // Export render function to global scope to let main popup.js use it
  window.houQuizDocFilter = {
    renderManualDocSummary,
    toggleWidgetOptionVisibility: () => {
      if (manualDocSummaryBox) {
        manualDocSummaryBox.classList.remove("u-display-none");
      }
      const showInfoWidgetCard = document.getElementById("show-info-widget-card");
      if (autoSelectDocs.checked) {
        showInfoWidgetCard.classList.remove("u-display-none");
      } else {
        showInfoWidgetCard.classList.add("u-display-none");
      }
      renderManualDocSummary();
    }
  };
})();
