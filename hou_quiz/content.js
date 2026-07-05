(function () {
  "use strict";

  if (window.houQuizLoaded) return;
  window.houQuizLoaded = true;

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

  let lastQuizResult = null;
  let activeDocument = null;
  let dbQuestions = [];

  // Áp dụng theme và màu chủ đạo lên các phần tử UI của extension
  function applyThemeToElement(el) {
    if (!el) return;
    chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
      const mode = res.hou_ui_theme_mode || "system";
      const color = res.hou_ui_primary_color || "green";

      // 1. Áp dụng màu chủ đạo
      const colorClasses = ["theme-green", "theme-blue", "theme-red", "theme-purple", "theme-orange", "theme-lime", "theme-black"];
      el.classList.remove(...colorClasses);
      el.classList.add(`theme-${color}`);

      // 2. Áp dụng dark mode
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

  // Tạo và hiển thị Toast thông báo
  function showToast(message, duration = 3000) {
    let toast = document.querySelector(".hou-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "hou-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  // Highlight phần text của đáp án đúng
  // mode = 'bg' : bôi nền (highlight bật)
  // mode = 'text': bôi màu chữ (highlight tắt)
  function highlightTextInOption(optEl, mode = 'bg') {
    const mainClass = mode === 'text' ? 'hou-highlight-option-text' : 'hou-highlight-option';
    if (optEl.querySelector(`.${mainClass}`) || optEl.classList.contains(mainClass)) {
      return;
    }

    const ignoreSelectors = ".feedbackspan, .icon, i, input, .accesshide, .feedback, img, .correct, .incorrect, .checkmark, .fa";
    const nodesToMove = [];
    
    Array.from(optEl.childNodes).forEach(node => {
      if (node.nodeType === 1) {
        // Bỏ qua nếu khớp selector hoặc chứa ký tự checkmark/cross
        if (node.matches(ignoreSelectors) || /[\u2713\u2714\u2611\u2705\u274c\u274e]/g.test(node.textContent)) {
          return;
        }
      }
      if (node.nodeType === 3 && node.textContent.trim().length === 0) {
        return;
      }
      nodesToMove.push(node);
    });

    if (nodesToMove.length > 0) {
      const span = document.createElement("span");
      span.className = mainClass;
      optEl.insertBefore(span, nodesToMove[0]);
      nodesToMove.forEach(node => span.appendChild(node));
    } else {
      optEl.classList.add(mainClass);
    }
  }

  // Quét các câu hỏi trên trang Moodle / LMS
  function scanQuestionsOnPage() {
    const pageQuestions = [];
    const questionContainers = document.querySelectorAll(".que, div.question, .question-container");

    questionContainers.forEach((container, idx) => {
      // Tìm element câu hỏi (ưu tiên tìm câu hỏi đích danh trước formulation)
      const qtextEl = container.querySelector(".qtext, .questiontext") || container.querySelector(".formulation");
      if (!qtextEl) return;

      // Clone để tránh ảnh hưởng trực tiếp đến DOM
      const clonedQtext = qtextEl.cloneNode(true);
      // Xóa các inline class hoặc các block chứa các đáp án bị chèn nhầm nếu có
      clonedQtext.querySelectorAll(".answer, label, .prompt, .accesshide").forEach(el => el.remove());
      
      let questionText = clonedQtext.textContent.replace(/\s+/g, " ").trim();
      questionText = questionText.replace(/^mô tả câu hỏi/i, "").trim();
      
      // Loại bỏ các chỉ dẫn Moodle hoặc các đáp án bị dính vào cuối câu hỏi
      const instructions = [
        /chọn một câu trả lời:?/i,
        /chọn một:?/i,
        /chọn câu trả lời:?/i,
        /chọn đáp án:?/i,
        /trả lời câu hỏi:?/i,
        /\b[a-fA-F0-9][\.\)]\s*$/i // loại bỏ kí tự lựa chọn dính ở cuối
      ];
      instructions.forEach(regex => {
        questionText = questionText.replace(regex, "").trim();
      });
      
      // Nếu có kí tự tùy chọn như "a. ..." dính vào câu hỏi, hãy cắt nó đi
      const optIndex = questionText.search(/\b[a-fA-F][\.\)]\s+/);
      if (optIndex !== -1 && optIndex > 10) {
        questionText = questionText.substring(0, optIndex).trim();
      }

      // Tìm container câu trả lời
      const answerContainer = container.querySelector(".answer");
      if (!answerContainer) return;

      // Tìm các option lựa chọn (radio hoặc checkbox labels)
      let optionElements = Array.from(answerContainer.querySelectorAll("label, .flex-fill, div[role='option']"));
      // Lọc bỏ các phần tử cha nếu có phần tử con cũng nằm trong danh sách (tránh highlight cả block chứa đáp án)
      optionElements = optionElements.filter(el => 
        !optionElements.some(otherEl => otherEl !== el && el.contains(otherEl))
      );
      const options = optionElements.map(el => {
        let txt = el.textContent.replace(/\s+/g, " ").trim();
        // Xóa ký tự checkmark hoặc các icon đúng/sai có thể dính vào text của option
        txt = txt.replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
        return txt;
      }).filter(Boolean);

      pageQuestions.push({
        id: idx,
        container: container,
        element: qtextEl,
        text: questionText,
        optionElements: optionElements,
        options: options
      });
    });

    return pageQuestions;
  }

  // Tự động load tài liệu theo môn học
  async function initDocument() {
    chrome.storage.local.get(["hou_auto_select_docs", "hou_show_info_widget"], async (res) => {
      const autoSelectDocsEnabled = res.hou_auto_select_docs !== false;
      const showInfoWidgetEnabled = res.hou_show_info_widget !== false;

      if (!autoSelectDocsEnabled) {
        showToast("Tự động chọn tài liệu đang bị tắt.");
        const widget = document.getElementById("hou-quiz-info-widget");
        if (widget) widget.remove();
        return;
      }

      showToast("Đang xác định môn học...");
      const doc = await window.houQuizAutoSelect.detectAndFetchDocument();
      if (doc) {
        activeDocument = doc;
        let cleanCourseTitle = doc.title;
        if (cleanCourseTitle.includes("-") || cleanCourseTitle.includes("–") || cleanCourseTitle.includes("—")) {
          cleanCourseTitle = cleanCourseTitle.split(/[-–—]/)[0].trim();
        }
        showToast(`Đã nhận diện môn học: ${cleanCourseTitle}`);
        if (showInfoWidgetEnabled) {
          showInfoWidget(cleanCourseTitle, doc.title, "Đang tải câu hỏi...");
        } else {
          const widget = document.getElementById("hou-quiz-info-widget");
          if (widget) widget.remove();
        }
        
        // Load toàn bộ câu hỏi của document này về bộ nhớ client
        try {
          const response = await fetch(`${window.houQuizConfig.API_URL}/questions/document/${doc.id}`);
          if (response.ok) {
            const resData = await response.json();
            dbQuestions = resData.questions || [];
            console.log(`[HouQuiz] Loaded ${dbQuestions.length} questions from DB.`);
            showToast(`Sẵn sàng làm bài! Đã tải ${dbQuestions.length} câu hỏi.`);
            if (showInfoWidgetEnabled) {
              showInfoWidget(cleanCourseTitle, doc.title, `Sẵn sàng (${dbQuestions.length} câu)`);
            }
          }
        } catch (err) {
          console.error("[HouQuiz] Error loading questions:", err);
          if (showInfoWidgetEnabled) {
            showInfoWidget(cleanCourseTitle, doc.title, "Lỗi tải câu hỏi từ DB");
          }
        }
      } else {
        showToast("Không tìm thấy tài liệu phù hợp cho môn học này.");
        // Cố gắng lấy tên môn học thô để hiển thị và làm sạch dấu "-"
        const info = document.querySelector(".page-header-headings h1") || document.querySelector(".coursename a");
        let detectedName = info ? info.textContent.trim() : "Chưa xác định";
        if (detectedName.includes("-") || detectedName.includes("–") || detectedName.includes("—")) {
          detectedName = detectedName.split(/[-–—]/)[0].trim();
        }
        if (showInfoWidgetEnabled) {
          showInfoWidget(detectedName, "Không tìm thấy tài liệu tương ứng", "Không khả dụng");
        } else {
          const widget = document.getElementById("hou-quiz-info-widget");
          if (widget) widget.remove();
        }
      }
    });
  }

  // Hiển thị panel thông tin góc trên bên phải
  function showInfoWidget(courseName, docName, statusText) {
    chrome.storage.local.get(["hou_show_info_widget"], (res) => {
      const showInfoWidgetEnabled = res.hou_show_info_widget !== false;
      if (!showInfoWidgetEnabled) {
        const widget = document.getElementById("hou-quiz-info-widget");
        if (widget) widget.remove();
        return;
      }

      let widget = document.getElementById("hou-quiz-info-widget");
      if (!widget) {
        widget = document.createElement("div");
        widget.id = "hou-quiz-info-widget";
        document.body.appendChild(widget);
      }
      applyThemeToElement(widget);
      widget.innerHTML = `
        <div class="widget-title">
          ${LUCIDE_ICONS.bookOpen} Thông tin HOU Quiz
        </div>
        <div class="widget-field">
          <span class="widget-label">Môn học:</span>
          <span class="widget-value">${courseName}</span>
        </div>
        <div class="widget-field">
          <span class="widget-label">Tài liệu:</span>
          <span class="widget-value">${docName}</span>
        </div>
        <div class="widget-field">
          <span class="widget-label">Trạng thái:</span>
          <span class="widget-value" style="color: #2e7d32; font-weight: bold;">${statusText}</span>
        </div>
      `;
    });
  }

  // Các hàm helper phục vụ hiển thị kết quả và điều hướng
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
      showToast("Không tìm thấy nút chuyển trang!");
    }
  }

  function createMinimizedButton(result) {
    if (window.houQuizResultPopup) {
      window.houQuizResultPopup.createResultPopup(result);
      // Xóa nút thu nhỏ nếu đang hiển thị
      const btn = document.getElementById(QUIZ_MINIMIZED_ID);
      if (btn) btn.remove();
    }
  }

  function createResultPopup(result) {
    if (window.houQuizResultPopup) {
      window.houQuizResultPopup.createResultPopup(result);
    }
  }


  // Thực hiện làm bài: Quét, so khớp, highlight và tự động chọn đáp án
  function startSolving() {
    console.log("[HouQuiz Debug] Bắt đầu làm bài, số lượng câu hỏi trong DB:", dbQuestions.length);
    if (dbQuestions.length === 0) {
      showToast("Không có câu hỏi trong database. Đang tải lại...");
      initDocument();
      return;
    }

    chrome.storage.local.get(["hou_highlight_answers", "hou_auto_select_answers"], (res) => {
      const highlightAnswersEnabled = res.hou_highlight_answers !== false;
      const autoSelectAnswersEnabled = res.hou_auto_select_answers !== false;

      const pageQuestions = scanQuestionsOnPage();
      console.log("[HouQuiz Debug] Số câu hỏi quét được trên trang:", pageQuestions.length);
      let solvedCount = 0;
      let exactMatch = 0;
      let fuzzyMatch = 0;
      let notFound = 0;
      const details = [];

      pageQuestions.forEach(pq => {
        console.log("[HouQuiz Debug] Đang so khớp câu hỏi trên trang:", pq.text.substring(0, 50) + "...");
        const match = window.houQuizMatch.matchQuestionWithDB(pq, dbQuestions);
        if (match) {
          console.log("[HouQuiz Debug] -> Khớp thành công câu hỏi! Đáp án đúng:", match.answerText);
          solvedCount++;
          let status = "matched";
          let statusIcon = LUCIDE_ICONS.target;
          let confidence = 1.0;
          if (match.isExact) {
            exactMatch++;
          } else {
            fuzzyMatch++;
            status = "fuzzy";
            statusIcon = LUCIDE_ICONS.alertTriangle;
            confidence = 0.95;
          }
          
          details.push({
            question: pq.text,
            answer: match.answerText,
            status: status,
            statusIcon: statusIcon,
            sourceIcon: LUCIDE_ICONS.database,
            confidence: confidence
          });

          // 1. Highlight câu hỏi màu đỏ (chỉ khi bật)
          if (highlightAnswersEnabled) {
            pq.element.classList.add("hou-highlight-question");
          }

          // 2. Tìm option khớp tốt nhất (dung sai nhỏ nhất / similarity score cao nhất)
          let bestOption = null;
          let bestScore = -1;

          pq.optionElements.forEach(optEl => {
            const optText = optEl.textContent.replace(/\s+/g, " ").trim();
            // Chỉ xem xét nếu hàm so sánh nhận diện là khớp
            if (window.houQuizUtils.compareNormalized(optText, match.answerText)) {
              const score = window.houQuizUtils.getSimilarityScore(optText, match.answerText);
              if (score > bestScore) {
                bestScore = score;
                bestOption = optEl;
              }
            }
          });

          if (bestOption) {
            console.log(`[HouQuiz Debug] -> Chọn đáp án khớp nhất: "${bestOption.textContent.trim()}" (Score: ${bestScore})`);
            // Highlight bật: bôi nền màu chủ đề; tắt: bôi màu chữ thay thế
            if (highlightAnswersEnabled) {
              highlightTextInOption(bestOption, 'bg');
            } else {
              highlightTextInOption(bestOption, 'text');
            }
            if (autoSelectAnswersEnabled) {
              const input = bestOption.querySelector("input[type='radio'], input[type='checkbox']") || 
                            bestOption.closest(".que")?.querySelector(`input[value="${bestOption.getAttribute('for')}"]`);
              if (input) {
                input.click();
                input.dispatchEvent(new Event("change", { bubbles: true }));
              } else {
                bestOption.click();
              }
            }
          }
        } else {
          console.log("[HouQuiz Debug] -> Không tìm thấy câu hỏi khớp trong DB.");
          notFound++;
          details.push({
            question: pq.text,
            answer: "",
            status: "not-found",
            statusIcon: LUCIDE_ICONS.xCircle,
            sourceIcon: "",
            confidence: 0
          });
        }
      });

      lastQuizResult = {
        totalPageQuestions: pageQuestions.length,
        totalFilled: solvedCount,
        exactMatch: exactMatch,
        fuzzyMatch: fuzzyMatch,
        notFound: notFound,
        dbAnswers: solvedCount,
        details: details
      };

      createResultPopup(lastQuizResult);
      showToast(`Đã hoàn thành tìm và xử lý: ${solvedCount}/${pageQuestions.length} câu.`);
    });
  }

  // Khởi tạo Floating Button "LÀM BÀI NGAY"
  function createFloatingButton() {
    const existing = document.getElementById("hou-quiz-btn");
    if (existing) existing.remove();

    const button = document.createElement("div");
    button.id = "hou-quiz-btn";
    applyThemeToElement(button);
    button.innerHTML = `
      <div class="btn-content">
        <span class="btn-icon">🚀</span>
        <span class="btn-text">LÀM BÀI NGAY</span>
      </div>
    `;

    button.addEventListener("click", () => {
      startSolving();
    });

    document.body.appendChild(button);
  }

  // Khởi động
  applyThemeToElement(document.body);
  createFloatingButton();
  initDocument();

  // Lắng nghe thay đổi cấu hình từ popup để cập nhật UI realtime
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.hou_auto_select_docs) {
        const enabled = changes.hou_auto_select_docs.newValue !== false;
        if (!enabled) {
          const widget = document.getElementById("hou-quiz-info-widget");
          if (widget) widget.remove();
        } else {
          initDocument();
        }
      }
      if (changes.hou_show_info_widget) {
        const enabled = changes.hou_show_info_widget.newValue !== false;
        if (!enabled) {
          const widget = document.getElementById("hou-quiz-info-widget");
          if (widget) widget.remove();
        } else {
          initDocument();
        }
      }
      // Cập nhật theme & màu chủ đạo realtime
      if (changes.hou_ui_theme_mode || changes.hou_ui_primary_color) {
        const widget = document.getElementById("hou-quiz-info-widget");
        const popup = document.getElementById("hou-quiz-result-popup");
        const minimized = document.getElementById("hou-quiz-minimized");
        const btn = document.getElementById("hou-quiz-btn");
        applyThemeToElement(document.body);
        applyThemeToElement(widget);
        applyThemeToElement(popup);
        applyThemeToElement(minimized);
        applyThemeToElement(btn);
      }
    }
  });
})();
