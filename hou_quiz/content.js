(function () {
  "use strict";

  if (window.houQuizLoaded) return;
  window.houQuizLoaded = true;

  const QUIZ_RESULT_POPUP_ID = "hou-quiz-result-popup";
  const QUIZ_MINIMIZED_ID = "hou-quiz-minimized";
  let lastQuizResult = null;
  let activeDocument = null;
  let dbQuestions = [];

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

  // Highlight riêng phần text của đáp án, bỏ qua các thẻ chứa checkmark/icon/input
  function highlightTextInOption(optEl) {
    if (optEl.querySelector(".hou-highlight-option") || optEl.classList.contains("hou-highlight-option")) {
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
      span.className = "hou-highlight-option";
      optEl.insertBefore(span, nodesToMove[0]);
      nodesToMove.forEach(node => span.appendChild(node));
    } else {
      optEl.classList.add("hou-highlight-option");
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
    chrome.storage.local.get(["hou_auto_select_docs"], async (res) => {
      const autoSelectDocsEnabled = res.hou_auto_select_docs !== false;
      if (!autoSelectDocsEnabled) {
        showToast("Tự động chọn tài liệu đang bị tắt.");
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
        showInfoWidget(cleanCourseTitle, doc.title, "Đang tải câu hỏi...");
        
        // Load toàn bộ câu hỏi của document này về bộ nhớ client
        try {
          const response = await fetch(`${window.houQuizConfig.API_URL}/questions/document/${doc.id}`);
          if (response.ok) {
            const resData = await response.json();
            dbQuestions = resData.questions || [];
            console.log(`[HouQuiz] Loaded ${dbQuestions.length} questions from DB.`);
            showToast(`Sẵn sàng làm bài! Đã tải ${dbQuestions.length} câu hỏi.`);
            showInfoWidget(cleanCourseTitle, doc.title, `Sẵn sàng (${dbQuestions.length} câu)`);
          }
        } catch (err) {
          console.error("[HouQuiz] Error loading questions:", err);
          showInfoWidget(cleanCourseTitle, doc.title, "Lỗi tải câu hỏi từ DB");
        }
      } else {
        showToast("Không tìm thấy tài liệu phù hợp cho môn học này.");
        // Cố gắng lấy tên môn học thô để hiển thị và làm sạch dấu "-"
        const info = document.querySelector(".page-header-headings h1") || document.querySelector(".coursename a");
        let detectedName = info ? info.textContent.trim() : "Chưa xác định";
        if (detectedName.includes("-") || detectedName.includes("–") || detectedName.includes("—")) {
          detectedName = detectedName.split(/[-–—]/)[0].trim();
        }
        showInfoWidget(detectedName, "Không tìm thấy tài liệu tương ứng", "Không khả dụng");
      }
    });
  }

  // Hiển thị panel thông tin góc trên bên phải
  function showInfoWidget(courseName, docName, statusText) {
    let widget = document.getElementById("hou-quiz-info-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "hou-quiz-info-widget";
      document.body.appendChild(widget);
    }
    widget.innerHTML = `
      <div class="widget-title">
        <span>📖</span> Thông tin HOU Quiz
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

  function removeMinimizedButton() {
    const btn = document.getElementById(QUIZ_MINIMIZED_ID);
    if (btn) btn.remove();
  }

  function createMinimizedButton(result) {
    removeMinimizedButton();
    const btn = document.createElement("div");
    btn.id = QUIZ_MINIMIZED_ID;
    btn.title = "Nhấn để mở rộng";
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    `;
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
    
    const { totalPageQuestions, totalFilled, exactMatch, fuzzyMatch, notFound, dbAnswers, details } = result;

    popup.innerHTML = `
      <div class="quiz-result-header">
        <span class="quiz-result-icon">📊</span>
        <span class="quiz-result-title">Kết quả điền đáp án</span>
        <button class="quiz-result-minimize" title="Thu nhỏ">—</button>
        <button class="quiz-result-close" title="Đóng">×</button>
      </div>
      <div class="quiz-result-body">
        <div class="quiz-result-summary">
          <div class="quiz-stat-item">
            <span class="quiz-stat-label">Tổng số câu hỏi:</span>
            <span class="quiz-stat-value">${totalPageQuestions}</span>
          </div>
          <div class="quiz-stat-item filled">
            <span class="quiz-stat-icon">✅</span>
            <span class="quiz-stat-label">Đã điền:</span>
            <span class="quiz-stat-value">${totalFilled} câu</span>
          </div>
          <div class="quiz-stat-item exact">
            <span class="quiz-stat-icon">🎯</span>
            <span class="quiz-stat-label">Khớp chính xác 100%:</span>
            <span class="quiz-stat-value">${exactMatch} câu</span>
          </div>
          <div class="quiz-stat-item fuzzy">
            <span class="quiz-stat-icon">⚠️</span>
            <span class="quiz-stat-label">Khớp fuzzy 99.5%:</span>
            <span class="quiz-stat-value">${fuzzyMatch} câu</span>
          </div>
          <div class="quiz-stat-desc">Vui lòng kiểm tra lại các câu này!</div>
          <div class="quiz-stat-item not-found">
            <span class="quiz-stat-icon">❌</span>
            <span class="quiz-stat-label">Không tìm thấy:</span>
            <span class="quiz-stat-value">${notFound} câu</span>
          </div>
          <div class="quiz-stat-divider"></div>
          <div class="quiz-stat-item db">
            <span class="quiz-stat-icon">🗄️</span>
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
        <button class="quiz-btn-next">Trang Tiếp Theo →</button>
      </div>
    `;

    document.body.appendChild(popup);
    setupResultPopupEvents(popup, result);
    return popup;
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
          let statusIcon = "🎯";
          let confidence = 1.0;
          if (match.isExact) {
            exactMatch++;
          } else {
            fuzzyMatch++;
            status = "fuzzy";
            statusIcon = "⚠️";
            confidence = 0.95;
          }
          
          details.push({
            question: pq.text,
            answer: match.answerText,
            status: status,
            statusIcon: statusIcon,
            sourceIcon: "🗄️",
            confidence: confidence
          });

          // 1. Highlight câu hỏi màu đỏ
          if (highlightAnswersEnabled) {
            pq.element.classList.add("hou-highlight-question");
          }

          // 2. Tìm option khớp để highlight xanh lá và click chọn
          pq.optionElements.forEach(optEl => {
            const optText = optEl.textContent.replace(/\s+/g, " ").trim();
            const normalizedOpt = window.houQuizUtils.normalizeTextForMatching(optText);
            const normalizedMatchAns = window.houQuizUtils.normalizeTextForMatching(match.answerText);
            console.log(`[HouQuiz Debug] So sánh lựa chọn trên trang: "${normalizedOpt}" với đáp án DB: "${normalizedMatchAns}"`);
            
            if (window.houQuizUtils.compareNormalized(optText, match.answerText)) {
              console.log("[HouQuiz Debug] -> Khớp đáp án lựa chọn!");
              if (highlightAnswersEnabled) {
                highlightTextInOption(optEl);
              }
              if (autoSelectAnswersEnabled) {
                const input = optEl.querySelector("input[type='radio'], input[type='checkbox']") || 
                              optEl.closest(".que")?.querySelector(`input[value="${optEl.getAttribute('for')}"]`);
                if (input) {
                  input.click();
                  input.dispatchEvent(new Event("change", { bubbles: true }));
                } else {
                  optEl.click();
                }
              }
            }
          });
        } else {
          console.log("[HouQuiz Debug] -> Không tìm thấy câu hỏi khớp trong DB.");
          notFound++;
          details.push({
            question: pq.text,
            answer: "",
            status: "not-found",
            statusIcon: "❌",
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
  createFloatingButton();
  initDocument();
})();
