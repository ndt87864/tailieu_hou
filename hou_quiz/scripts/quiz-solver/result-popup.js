(function () {
  "use strict";

  const QUIZ_RESULT_POPUP_ID = "hou-quiz-result-popup";
  const QUIZ_MINIMIZED_ID = "hou-quiz-minimized";

  // Lucide Icons SVG
  const LUCIDE_ICONS = {
    bookOpen: `<svg class="lucide-icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    barChart: `<svg class="lucide-icon" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    checkCircle: `<svg class="lucide-icon" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    target: `<svg class="lucide-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    alertTriangle: `<svg class="lucide-icon" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    xCircle: `<svg class="lucide-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    database: `<svg class="lucide-icon" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`,
    x: `<svg class="lucide-icon" viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    minus: `<svg class="lucide-icon" viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    arrowRight: `<svg class="lucide-icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    edit: `<svg class="lucide-icon" viewBox="0 0 24 24" stroke="#ffffff"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
  };

  function applyThemeToElement(el) {
    if (!el) return;
    chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
      const mode = res.hou_ui_theme_mode || "system";
      const color = res.hou_ui_primary_color || "green";

      const colorClasses = ["theme-green", "theme-blue", "theme-red", "theme-purple", "theme-orange", "theme-lime", "theme-black"];
      el.classList.remove(...colorClasses);
      el.classList.add(`theme-${color}`);

      const isDark =
        mode === "dark" ||
        (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (isDark) {
        el.classList.add("dark");
      } else {
        el.classList.remove("dark");
      }
    });
  }

  function truncateText(text, maxLength) {
    if (!text) return "";
    const str = text.toString();
    return str.length <= maxLength ? str : str.substring(0, maxLength) + "...";
  }

  function simulateFullClick(el) {
    if (!el) return;
    try {
      el.focus();
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse" }));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      setTimeout(() => {
        el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerType: "mouse" }));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.click();
        if (el.tagName === "INPUT" || el.tagName === "SELECT") {
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, 50);
    } catch (e) {
      el.click();
    }
  }

  function navigateToNextPage() {
    const moodleNext = document.querySelector('.submitbtns input[name="next"]') || document.querySelector('input[name="next"]');
    if (moodleNext) {
      simulateFullClick(moodleNext);
      return;
    }
    const allBtns = Array.from(document.querySelectorAll('input[type="submit"], button, a'));
    const nextBtn = allBtns.find(el => /tiếp\s+theo|tiếp\s+tục|next/i.test(el.value || el.textContent || ''));
    if (nextBtn) {
      simulateFullClick(nextBtn);
    } else {
      let toast = document.querySelector(".hou-toast");
      if (toast) {
        toast.textContent = "Không tìm thấy nút chuyển trang!";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
      }
    }
  }

  function removeMinimizedButton() {
    const btn = document.getElementById(QUIZ_MINIMIZED_ID);
    if (btn) btn.remove();
  }

  function createMinimizedButton(result) {
    removeMinimizedButton();
    const btn = document.createElement("div");
    btn.id = QUIZ_MINIMIZED_ID;
    btn.title = "Nhấn để mở rộng";
    btn.innerHTML = LUCIDE_ICONS.edit;
    applyThemeToElement(btn);
    btn.addEventListener("click", () => {
      btn.remove();
      createResultPopup(result);
    });
    document.body.appendChild(btn);
  }

  function setupResultPopupEvents(popup, result) {
    popup.querySelector(".quiz-result-close")?.addEventListener("click", () => {
      popup.remove();
      removeMinimizedButton();
    });
    popup.querySelector(".quiz-result-minimize")?.addEventListener("click", () => {
      popup.remove();
      createMinimizedButton(result);
    });
    popup.querySelector(".quiz-btn-next")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateToNextPage();
    });
  }

  function createResultPopup(result) {
    const existing = document.getElementById(QUIZ_RESULT_POPUP_ID);
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = QUIZ_RESULT_POPUP_ID;
    applyThemeToElement(popup);
    
    const { totalPageQuestions, totalFilled, exactMatch, fuzzyMatch, notFound, dbAnswers, details } = result;

    popup.innerHTML = `
      <div class="quiz-result-header">
        <span class="quiz-result-icon">${LUCIDE_ICONS.barChart}</span>
        <span class="quiz-result-title">Kết quả điền đáp án</span>
        <span class="quiz-result-minimize" title="Thu nhỏ">${LUCIDE_ICONS.minus}</span>
        <span class="quiz-result-close" title="Đóng">${LUCIDE_ICONS.x}</span>
      </div>
      <div class="quiz-result-body">
        <div class="quiz-result-summary">
          <div class="quiz-stat-item">
            <span class="quiz-stat-label">Tổng số câu hỏi:</span>
            <span class="quiz-stat-value">${totalPageQuestions}</span>
          </div>
          <div class="quiz-stat-item filled">
            <span class="quiz-stat-icon">${LUCIDE_ICONS.checkCircle}</span>
            <span class="quiz-stat-label">Đã điền:</span>
            <span class="quiz-stat-value">${totalFilled} câu</span>
          </div>
          <div class="quiz-stat-item exact">
            <span class="quiz-stat-icon">${LUCIDE_ICONS.target}</span>
            <span class="quiz-stat-label">Khớp chính xác 100%:</span>
            <span class="quiz-stat-value">${exactMatch} câu</span>
          </div>
          <div class="quiz-stat-item fuzzy">
            <span class="quiz-stat-icon">${LUCIDE_ICONS.alertTriangle}</span>
            <span class="quiz-stat-label">Khớp fuzzy 99.5%:</span>
            <span class="quiz-stat-value">${fuzzyMatch} câu</span>
          </div>
          <div class="quiz-stat-desc">Vui lòng kiểm tra lại các câu này!</div>
          <div class="quiz-stat-item not-found">
            <span class="quiz-stat-icon">${LUCIDE_ICONS.xCircle}</span>
            <span class="quiz-stat-label">Không tìm thấy:</span>
            <span class="quiz-stat-value">${notFound} câu</span>
          </div>
          <div class="quiz-stat-divider"></div>
          <div class="quiz-stat-item db">
            <span class="quiz-stat-icon">${LUCIDE_ICONS.database}</span>
            <span class="quiz-stat-label">Đáp án từ Dữ liệu (DB/Cached):</span>
            <span class="quiz-stat-value">${dbAnswers} câu</span>
          </div>
        </div>
        <div class="quiz-result-details">
          <div class="quiz-details-header">Chi tiết:</div>
          <div class="quiz-details-list">
            ${details.map((d, idx) => `
              <div class="quiz-detail-item ${d.status}">
                <span class="quiz-detail-icon">${d.statusIcon}</span>
                <span class="quiz-detail-num">Câu ${idx + 1}:</span>
                <span class="quiz-detail-source">${d.sourceIcon}</span>
                <span class="quiz-detail-text">${truncateText(d.question, 60)}</span>
                ${d.answer ? `<br><span class="quiz-detail-answer">→ ${truncateText(d.answer, 40)} ${d.confidence ? `(${(d.confidence * 100).toFixed(1)}%)` : ""}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="quiz-result-footer">
        <button class="quiz-btn-next">Trang Tiếp Theo ${LUCIDE_ICONS.arrowRight}</button>
      </div>
    `;

    document.body.appendChild(popup);
    setupResultPopupEvents(popup, result);
    return popup;
  }

  // Xuất ra ngoài window để content.js sử dụng
  window.houQuizResultPopup = {
    createResultPopup,
    applyThemeToElement,
    LUCIDE_ICONS
  };
})();
