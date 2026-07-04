(function () {
  "use strict";

  if (window.houQuizLoaded) return;
  window.houQuizLoaded = true;

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

  // Quét các câu hỏi trên trang Moodle / LMS
  function scanQuestionsOnPage() {
    const pageQuestions = [];
    const questionContainers = document.querySelectorAll(".que, div.question, .question-container");

    questionContainers.forEach((container, idx) => {
      // Tìm element câu hỏi
      const qtextEl = container.querySelector(".qtext, .questiontext, .formulation");
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
      const optionElements = Array.from(answerContainer.querySelectorAll("label, .flex-fill, div[role='option']"));
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

      pageQuestions.forEach(pq => {
        console.log("[HouQuiz Debug] Đang so khớp câu hỏi trên trang:", pq.text.substring(0, 50) + "...");
        const match = window.houQuizMatch.matchQuestionWithDB(pq, dbQuestions);
        if (match) {
          console.log("[HouQuiz Debug] -> Khớp thành công câu hỏi! Đáp án đúng:", match.answerText);
          solvedCount++;
          
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
                optEl.classList.add("hou-highlight-option");
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
          console.log("[HouQuiz Debug] -> Không tìm thấy câu hỏi khớp trong DB. Chi tiết câu hỏi web:");
          console.log("   - Web normalized:", window.houQuizUtils.normalizeTextForMatching(pq.text));
          // Log thử 3 câu trong DB xem cấu trúc text thế nào để đối chiếu
          if (dbQuestions.length > 0) {
            console.log("   - Ví dụ 3 câu trong DB:");
            dbQuestions.slice(0, 3).forEach((dbQ, dIdx) => {
              console.log(`     DB [${dIdx}]:`, window.houQuizUtils.normalizeTextForMatching(dbQ.question));
            });
          }
        }
      });

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
