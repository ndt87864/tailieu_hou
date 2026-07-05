(function () {
  "use strict";

  if (window.houQuizScannerLoaded) return;
  window.houQuizScannerLoaded = true;

  const SCANNER_BTN_ID = "hou-quiz-scanner-btn";
  const POPUP_ID = "hou-quiz-scanner-popup";
  const OVERLAY_ID = "hou-quiz-scanner-overlay";

  // Danh sách câu hỏi quét được đang lưu trong bộ nhớ tạm thời
  let scannedQuestionsList = [];

  // Lắng nghe message yêu cầu quét từ popup cài đặt
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "scanQuestions") {
      try {
        const questions = scanReviewQuestions();
        sendResponse({ success: true, questions: questions });
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      }
      return true;
    }
  });

  // Quét câu hỏi + đáp án đúng từ trang review.php hoặc các trang xem lại bài của HOU
  function scanReviewQuestions() {
    const results = [];
    const questionContainers = document.querySelectorAll(".que, div.question, .question-container");
    const utils = window.houQuizUtils;

    questionContainers.forEach((container, idx) => {
      try {
        const qtextEl = container.querySelector(".qtext, .questiontext") || container.querySelector(".formulation");
        if (!qtextEl) return;

        // Trích xuất text câu hỏi
        const clonedQtext = qtextEl.cloneNode(true);
        clonedQtext.querySelectorAll(".answer, label, .prompt, .accesshide").forEach(el => el.remove());
        
        let questionText = clonedQtext.textContent.replace(/\s+/g, " ").trim();
        questionText = questionText.replace(/^mô tả câu hỏi/i, "").trim();

        const instructions = [
          /chọn một câu trả lời:?/i,
          /chọn một:?/i,
          /chọn câu trả lời:?/i,
          /chọn đáp án:?/i,
          /trả lời câu hỏi:?/i,
          /\b[a-fA-F0-9][\.\)]\s*$/i
        ];
        instructions.forEach(regex => {
          questionText = questionText.replace(regex, "").trim();
        });

        const optIndex = questionText.search(/\b[a-fA-F][\.\)]\s+/);
        if (optIndex !== -1 && optIndex > 10) {
          questionText = questionText.substring(0, optIndex).trim();
        }

        if (!questionText || questionText.length < 2) return;

        // Lấy danh sách các lựa chọn
        const answerContainer = container.querySelector(".answer");
        let choices = [];
        let optionElements = [];
        if (answerContainer) {
          optionElements = Array.from(answerContainer.querySelectorAll(".r0, .r1, label, .flex-fill, div[role='option']"));
          optionElements = optionElements.filter(el => !optionElements.some(otherEl => otherEl !== el && el.contains(otherEl)));
          choices = optionElements.map(el => el.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim()).filter(Boolean);
        }

        // BƯỚC 1: Tìm đáp án từ thẻ ghi nhận đáp án đúng của Moodle: outcome hoặc rightanswer
        let rightAnswerText = "";
        const rightAnswerEl = container.querySelector(".outcome .rightanswer, .rightanswer");
        
        if (rightAnswerEl) {
          rightAnswerText = rightAnswerEl.textContent.replace(/\s+/g, " ").trim();
          rightAnswerText = rightAnswerText
            .replace(/^The correct answer is:\s*/i, "")
            .replace(/^Đáp án đúng là:\s*/i, "")
            .replace(/^Câu trả lời đúng là:\s*/i, "")
            .replace(/^The correct answers are:\s*/i, "")
            .replace(/^Các đáp án đúng là:\s*/i, "")
            .trim();
        }

        // BƯỚC 2: Kiểm tra class .correct hoặc các icon tick biểu thị đúng trong optionElements
        if (!rightAnswerText && optionElements.length > 0) {
          const correctOptionEl = optionElements.find(el => {
            const parent = el.closest(".r0, .r1, .correct, li, label");
            const hasCorrectClass = (parent && parent.classList.contains("correct")) || el.classList.contains("correct") || !!el.querySelector(".correct");
            
            const correctnessIcon = el.querySelector(".questioncorrectnessicon") || (parent && parent.querySelector(".questioncorrectnessicon"));
            const hasCorrectIcon = correctnessIcon && (
              /đúng|correct/i.test(correctnessIcon.getAttribute("alt") || "") || 
              /đúng|correct/i.test(correctnessIcon.getAttribute("title") || "") ||
              /grade_correct/i.test(correctnessIcon.getAttribute("src") || "")
            );
            
            const textContent = el.textContent || "";
            const hasTickChar = /[✓✔✅]/.test(textContent);

            return hasCorrectClass || hasCorrectIcon || hasTickChar;
          });

          if (correctOptionEl) {
            const labelEl = correctOptionEl.querySelector("label") || correctOptionEl;
            rightAnswerText = labelEl.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
          }
        }

        // BƯỚC 3: Dự phòng tìm kiếm bằng hình ảnh icon đúng / class correct chung trong container
        if (!rightAnswerText) {
          const correctIconInContainer = container.querySelector('.questioncorrectnessicon[alt*="đúng"], .questioncorrectnessicon[alt*="correct"], .questioncorrectnessicon[title*="đúng"], .questioncorrectnessicon[title*="correct"], img[src*="grade_correct"]');
          if (correctIconInContainer) {
            const parentRow = correctIconInContainer.closest("label, li, .r0, .r1, .correct");
            if (parentRow) {
              const labelEl = parentRow.querySelector("label") || parentRow;
              rightAnswerText = labelEl.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
            }
          }
        }

        // Chuẩn hóa và làm sạch đáp án
        if (rightAnswerText) {
          if (utils && typeof utils.normalizeTextForMatching === "function") {
            rightAnswerText = utils.normalizeTextForMatching(rightAnswerText);
          } else {
            rightAnswerText = rightAnswerText
              .replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, "")
              .trim();
          }
        }

        if (!rightAnswerText) return;

        results.push({
          index: results.length + 1,
          question: questionText,
          answer: rightAnswerText,
          choices: choices,
          stt: idx + 1,
          dbStatus: "checking", // checking -> checked (exists/not_exists)
          dbStatusText: "Đang kiểm tra...",
          isChecked: true
        });
      } catch (e) {
        console.error("[HouQuiz Scanner] Lỗi khi quét câu hỏi:", e);
      }
    });

    return results;
  }

  // Đóng modal kết quả quét
  function closeScannerPopup() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 300);
    }
  }

  // Hiển thị modal kết quả quét câu hỏi
  function showScannerResultsPopup(questions, courseTitle) {
    closeScannerPopup();
    scannedQuestionsList = questions;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    
    const popup = document.createElement("div");
    popup.id = POPUP_ID;

    // Build nội dung danh sách câu hỏi
    const questionsHTML = questions.map(q => {
      // Đánh dấu đáp án đúng trong list choices
      const answersListHTML = q.choices.map((c, cIdx) => {
        const letter = String.fromCharCode(65 + cIdx);
        const cleanC = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(c) : c;
        const cleanAns = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(q.answer) : q.answer;
        const isCorrect = cleanC === cleanAns || cleanC.includes(cleanAns) || cleanAns.includes(cleanC);
        
        return `
          <div class="scanner-answer-item ${isCorrect ? 'correct' : ''}">
            <span class="scanner-ans-label">${letter}</span>
            <span class="scanner-ans-text">${escapeHTML(c)}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="scanner-question-item" data-index="${q.index}">
          <div class="scanner-question-header">
            <div class="scanner-q-meta">
              <input type="checkbox" class="scanner-q-checkbox" ${q.isChecked ? 'checked' : ''} />
              <span class="scanner-q-num">Câu ${q.index}</span>
              <span class="scanner-q-type">Câu hỏi</span>
              <span class="scanner-q-doc">Tài liệu: ${escapeHTML(courseTitle)}</span>
              <span class="scanner-q-badge" id="badge-q-${q.index}">${q.dbStatusText}</span>
            </div>
            <div class="scanner-q-actions">
              <button class="scanner-q-btn edit" title="Sửa câu hỏi">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                </svg>
              </button>
              <button class="scanner-q-btn delete" title="Xóa khỏi danh sách">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="scanner-question-text" id="qtext-${q.index}">${escapeHTML(q.question)}</div>
          <div class="scanner-answers" id="qanswers-${q.index}">
            ${answersListHTML}
          </div>
        </div>
      `;
    }).join("");

    popup.innerHTML = `
      <div class="scanner-header">
        <div class="scanner-header-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          Kết quả quét
        </div>
        <div class="scanner-header-info">
          <span class="scanner-count">${questions.length} câu hỏi</span>
          <button class="scanner-close" title="Đóng">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="scanner-body">
        <div class="scanner-warning">
          ⚠️ <strong>Cảnh báo:</strong> Dữ liệu câu hỏi trong Extension có thể đã lỗi thời. Vui lòng [Xóa cache] trong popup chính để cập nhật dữ liệu mới nhất nếu cần!
        </div>
        <div class="scanner-questions-list">
          ${questionsHTML}
        </div>
      </div>
      <div class="scanner-footer">
        <button class="scanner-btn scanner-btn-secondary" id="btn-copy-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          Copy tất cả
        </button>
        <button class="scanner-btn scanner-btn-secondary" id="btn-select-all">
          Chọn tất cả
        </button>
        <button class="scanner-btn scanner-btn-secondary" id="btn-delete-selected">
          Xóa đã chọn
        </button>
        <button class="scanner-btn scanner-btn-primary" id="btn-save-db">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <path d="M17 21v-8H7v8"></path>
            <path d="M7 3v5h8"></path>
          </svg>
          Thêm vào DB
        </button>
      </div>
    `;

    // Đồng bộ Theme Mode & màu chủ đạo lên popup
    chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
      const color = res.hou_ui_primary_color || "green";
      popup.className = `theme-${color}`;
      if (res.hou_ui_theme_mode === "dark") popup.classList.add("dark");
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Xử lý đóng modal khi click ra ngoài hoặc nút close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeScannerPopup();
    });
    popup.querySelector(".scanner-close").addEventListener("click", closeScannerPopup);

    // Copy tất cả
    popup.querySelector("#btn-copy-all").addEventListener("click", () => {
      const text = scannedQuestionsList.map(q => {
        return `Câu hỏi: ${q.question}\nĐáp án: ${q.answer}\nChoices: ${q.choices.join(" | ")}`;
      }).join("\n\n");
      navigator.clipboard.writeText(text).then(() => {
        showPageToast("Đã copy toàn bộ nội dung câu hỏi!");
      });
    });

    // Chọn tất cả
    popup.querySelector("#btn-select-all").addEventListener("click", () => {
      scannedQuestionsList.forEach(q => q.isChecked = true);
      popup.querySelectorAll(".scanner-q-checkbox").forEach(cb => cb.checked = true);
    });

    // Xóa câu hỏi đã chọn
    popup.querySelector("#btn-delete-selected").addEventListener("click", () => {
      const checkedQuestions = scannedQuestionsList.filter(q => q.isChecked);
      if (checkedQuestions.length === 0) {
        showPageToast("Chưa chọn câu hỏi nào để xóa", false);
        return;
      }

      scannedQuestionsList = scannedQuestionsList.filter(q => !q.isChecked);
      // Xóa DOM tương ứng
      checkedQuestions.forEach(q => {
        const item = popup.querySelector(`.scanner-question-item[data-index="${q.index}"]`);
        if (item) item.remove();
      });

      // Cập nhật lại đếm
      popup.querySelector(".scanner-count").textContent = `${scannedQuestionsList.length} câu hỏi`;
      showPageToast(`Đã xóa ${checkedQuestions.length} câu hỏi ra khỏi danh sách.`);
    });

    // Thêm vào CSDL
    popup.querySelector("#btn-save-db").addEventListener("click", async () => {
      const activeQuestions = scannedQuestionsList.filter(q => q.isChecked);
      if (activeQuestions.length === 0) {
        showPageToast("Chưa chọn câu hỏi nào để lưu", false);
        return;
      }

      const saveBtn = popup.querySelector("#btn-save-db");
      const originalHTML = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `Đang đồng bộ...`;

      try {
        const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };

        // 1. Tải danh sách documents
        const docRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`);
        const docList = Array.isArray(docRes) ? docRes : (docRes && Array.isArray(docRes.documents) ? docRes.documents : []);

        // 2. Tìm hoặc Tạo document tương ứng
        let matchedDoc = null;
        if (docList.length > 0) {
          const cleanWebTitle = window.houQuizUtils.normalizeTextForMatching(courseTitle);
          matchedDoc = docList.find(doc => {
            const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
            return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
          });
        }

        if (!matchedDoc) {
          // Tạo document mới
          const categories = await window.houQuizUtils.fetchAPI(`${config.API_URL}/categories`);
          let categoryId = categories && categories[0] ? categories[0].id : null;
          if (!categoryId) {
            const newCat = await window.houQuizUtils.fetchAPI(`${config.API_URL}/categories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "Học phần LMS" })
            });
            categoryId = newCat ? newCat.id : null;
          }

          matchedDoc = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: courseTitle, categoryId: categoryId })
          });
        }

        // 3. Tách câu hỏi thành 2 nhóm: cần INSERT mới và cần UPDATE choices
        const toInsert = activeQuestions.filter(q => q.dbStatus !== "missing_choices" && q.dbStatus !== "exists");
        const toUpdateChoices = activeQuestions.filter(q => q.dbStatus === "missing_choices" && q.dbId);

        let inserted = 0, skipped = 0, updated = 0;
        const parts = [];

        // 3a. INSERT câu hỏi mới
        if (toInsert.length > 0) {
          const saveRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              document_id: matchedDoc.id,
              questions: toInsert.map((q, idx) => ({
                question: q.question,
                answer: q.answer,
                choices: q.choices,
                order_index: q.stt ?? idx + 1
              }))
            })
          });
          inserted = saveRes?.inserted ?? toInsert.length;
          skipped = saveRes?.skipped ?? 0;
          if (inserted > 0) parts.push(`thêm ${inserted} câu mới`);
          if (skipped > 0) parts.push(`bỏ qua ${skipped} trùng lặp`);
        }

        // 3b. UPDATE choices cho câu đã có nhưng thiếu choices
        if (toUpdateChoices.length > 0) {
          const updateRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/bulk-update-choices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              updates: toUpdateChoices.map(q => ({
                id: q.dbId,
                choices: q.choices
              }))
            })
          });
          updated = updateRes?.updated ?? toUpdateChoices.length;
          if (updated > 0) parts.push(`cập nhật choices cho ${updated} câu`);
        }

        if (parts.length === 0) {
          showPageToast("Đã tồn tại trong DB, không có gì cần lưu.", false);
        } else {
          showPageToast(`Hoàn thành: ${parts.join(", ")}.`);
        }
        closeScannerPopup();
      } catch (err) {
        showPageToast(`Lỗi khi lưu DB: ${err.message || err}`, false);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
      }
    });

    // Lắng nghe hành động sửa câu hỏi, check box
    popup.querySelectorAll(".scanner-question-item").forEach(item => {
      const qIndex = Number(item.getAttribute("data-index"));
      const questionData = scannedQuestionsList.find(q => q.index === qIndex);

      // Checkbox
      item.querySelector(".scanner-q-checkbox").addEventListener("change", (e) => {
        questionData.isChecked = e.target.checked;
      });

      // Nút xóa câu hỏi đơn
      item.querySelector(".scanner-q-btn.delete").addEventListener("click", () => {
        scannedQuestionsList = scannedQuestionsList.filter(q => q.index !== qIndex);
        item.remove();
        popup.querySelector(".scanner-count").textContent = `${scannedQuestionsList.length} câu hỏi`;
      });

      // Nút sửa câu hỏi
      item.querySelector(".scanner-q-btn.edit").addEventListener("click", () => {
        openEditForm(item, questionData);
      });
    });

    // Khởi chạy Animation overlay
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    // Tự động kiểm tra trùng lặp với DB
    checkExistingQuestions(questions, courseTitle, popup);
  }

  // Mở Form chỉnh sửa câu hỏi trực tiếp trên modal
  function openEditForm(item, questionData) {
    if (item.querySelector(".scanner-edit-form")) return;

    const textContainer = item.querySelector(".scanner-question-text");
    const answersContainer = item.querySelector(".scanner-answers");

    const form = document.createElement("div");
    form.className = "scanner-edit-form";

    form.innerHTML = `
      <textarea id="edit-qtext-${questionData.index}">${escapeHTML(questionData.question)}</textarea>
      <div class="edit-answers" id="edit-answers-${questionData.index}">
        ${questionData.choices.map((c, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isCorrect = (window.houQuizUtils && window.houQuizUtils.normalizeTextForMatching(c) === window.houQuizUtils.normalizeTextForMatching(questionData.answer)) || c === questionData.answer;
          return `
            <div class="edit-answer-row">
              <span style="font-weight:700; width:20px;">${letter}</span>
              <input type="checkbox" class="correct-chk" ${isCorrect ? 'checked' : ''} />
              <input type="text" class="ans-text" value="${escapeHTML(c)}" />
            </div>
          `;
        }).join("")}
      </div>
      <button class="scanner-btn scanner-btn-secondary scanner-btn-add-row" type="button">+ Thêm đáp án</button>
      <div class="scanner-edit-actions">
        <button class="scanner-btn scanner-btn-secondary cancel-btn" type="button">Hủy</button>
        <button class="scanner-btn scanner-btn-primary save-btn" type="button">Lưu</button>
      </div>
    `;

    // Thêm dòng đáp án mới
    form.querySelector(".scanner-btn-add-row").addEventListener("click", () => {
      const currentRows = form.querySelectorAll(".edit-answer-row").length;
      const nextLetter = String.fromCharCode(65 + currentRows);
      const row = document.createElement("div");
      row.className = "edit-answer-row";
      row.innerHTML = `
        <span style="font-weight:700; width:20px;">${nextLetter}</span>
        <input type="checkbox" class="correct-chk" />
        <input type="text" class="ans-text" value="" placeholder="Nhập đáp án mới" />
      `;
      form.querySelector(".edit-answers").appendChild(row);
    });

    item.appendChild(form);

    // Sự kiện hủy
    form.querySelector(".cancel-btn").addEventListener("click", () => {
      form.remove();
    });

    // Sự kiện lưu thay đổi
    form.querySelector(".save-btn").addEventListener("click", () => {
      const newQuestionText = form.querySelector("textarea").value.trim();
      const rows = form.querySelectorAll(".edit-answer-row");
      const newChoices = [];
      let newAnswer = "";

      rows.forEach(row => {
        const text = row.querySelector(".ans-text").value.trim();
        const isChecked = row.querySelector(".correct-chk").checked;
        if (text) {
          newChoices.push(text);
          if (isChecked) {
            newAnswer = text;
          }
        }
      });

      if (newChoices.length === 0) {
        showPageToast("Lựa chọn không được trống", false);
        return;
      }

      // Cập nhật Data model
      questionData.question = newQuestionText;
      questionData.choices = newChoices;
      if (newAnswer) questionData.answer = newAnswer;

      // Cập nhật DOM
      textContainer.textContent = newQuestionText;
      
      // Vẽ lại danh sách đáp án
      const cleanAns = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(questionData.answer) : questionData.answer;
      answersContainer.innerHTML = newChoices.map((c, cIdx) => {
        const letter = String.fromCharCode(65 + cIdx);
        const cleanC = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(c) : c;
        const isCorrect = cleanC === cleanAns || cleanC.includes(cleanAns) || cleanAns.includes(cleanC);
        return `
          <div class="scanner-answer-item ${isCorrect ? 'correct' : ''}">
            <span class="scanner-ans-label">${letter}</span>
            <span class="scanner-ans-text">${escapeHTML(c)}</span>
          </div>
        `;
      }).join("");

      form.remove();
      showPageToast("Đã lưu sửa đổi câu hỏi!");
    });
  }

  // Tự động kiểm tra xem câu hỏi đã tồn tại trên DB chưa
  async function checkExistingQuestions(questions, courseTitle, popupEl) {
    try {
      const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };

      // 1. Tải danh sách documents
      const docRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`);
      const docList = Array.isArray(docRes) ? docRes : (docRes && Array.isArray(docRes.documents) ? docRes.documents : []);

      // 2. Tìm ID tài liệu
      const cleanWebTitle = window.houQuizUtils.normalizeTextForMatching(courseTitle);
      const matchedDoc = docList.find(doc => {
        const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
        return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
      });

      if (!matchedDoc) {
        // Chưa có tài liệu -> tất cả đều chưa có trong DB
        questions.forEach(q => {
          q.dbStatus = "new";
          q.dbStatusText = "Chưa có";
          q.dbId = null;
          const badge = popupEl.querySelector(`#badge-q-${q.index}`);
          if (badge) {
            badge.textContent = "Chưa có";
            badge.style.color = "var(--success, #10b981)";
            badge.style.background = "rgba(16, 185, 129, 0.12)";
            badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
          }
        });
        return;
      }

      // 3. Tải toàn bộ câu hỏi trong tài liệu về để so khớp cục bộ tránh tạo nhiều request
      const dbQuestions = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/document/${matchedDoc.id}`);
      const dbList = Array.isArray(dbQuestions) ? dbQuestions : (dbQuestions && Array.isArray(dbQuestions.questions) ? dbQuestions.questions : []);

      questions.forEach(q => {
        const cleanQText = window.houQuizUtils.normalizeTextForMatching(q.question);

        // Tìm câu khớp trong DB
        const matchedDbQ = dbList.find(dbQ => {
          const cleanDBQ = window.houQuizUtils.normalizeTextForMatching(dbQ.question);
          const cleanDBAns = window.houQuizUtils.normalizeTextForMatching(dbQ.answer);
          const cleanQAns = window.houQuizUtils.normalizeTextForMatching(q.answer);

          const isQuestionMatch = cleanDBQ === cleanQText || cleanDBQ.includes(cleanQText) || cleanQText.includes(cleanDBQ);
          if (!isQuestionMatch) return false;

          // Nếu câu hỏi khớp, cần khớp thêm cả đáp án để tránh nhận nhầm câu hỏi trùng tiêu đề chung chung
          return cleanDBAns === cleanQAns || cleanDBAns.includes(cleanQAns) || cleanQAns.includes(cleanDBAns);
        });

        q.dbStatus = "checked";
        q.dbId = matchedDbQ ? matchedDbQ.id : null;
        const badge = popupEl.querySelector(`#badge-q-${q.index}`);

        if (!matchedDbQ) {
          // Chưa có trong DB
          q.dbStatusText = "Chưa có";
          if (badge) {
            badge.textContent = "Chưa có";
            badge.style.color = "var(--success, #10b981)";
            badge.style.background = "rgba(16, 185, 129, 0.12)";
            badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
          }
        } else {
          const hasChoices = Array.isArray(matchedDbQ.choices) && matchedDbQ.choices.length > 0;
          if (hasChoices) {
            // Đã có đầy đủ (câu hỏi + đáp án + choices)
            q.dbStatusText = "Đã có trong DB";
            q.dbStatus = "exists";
            if (badge) {
              badge.textContent = "Đã có trong DB";
              badge.style.color = "#f59e0b";
              badge.style.background = "rgba(245, 158, 11, 0.12)";
              badge.style.borderColor = "rgba(245, 158, 11, 0.2)";
            }
          } else {
            // Tồn tại nhưng chưa có choices
            q.dbStatusText = "Chưa có choices";
            q.dbStatus = "missing_choices";
            if (badge) {
              badge.textContent = "Chưa có choices";
              badge.style.color = "#8b5cf6";
              badge.style.background = "rgba(139, 92, 246, 0.12)";
              badge.style.borderColor = "rgba(139, 92, 246, 0.2)";
            }
          }
        }
      });
    } catch (err) {
      console.error("[HouQuiz Scanner] Lỗi khi kiểm tra câu hỏi trùng lặp:", err);
    }
  }

  // Hiển thị toast thông báo
  function showPageToast(message, isSuccess = true) {
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
    }, 3000);
  }

  function escapeHTML(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Hàm kích hoạt quét và hiển thị popup
  async function triggerManualScan() {
    const questions = scanReviewQuestions();
    if (questions.length === 0) {
      showPageToast("Không tìm thấy câu hỏi & đáp án nào hợp lệ để quét trên trang này.", false);
      return;
    }

    chrome.storage.local.get(["hou_current_course"], (res) => {
      const courseTitle = res.hou_current_course || "Môn học chưa đặt tên";
      showScannerResultsPopup(questions, courseTitle);
    });
  }

  // Khởi tạo Floating Button "QUÉT CÂU HỎI" ở góc dưới bên phải màn hình
  function createScannerButton() {
    if (!/\/mod\/quiz\/(review|attempt)\.php/.test(window.location.pathname || "")) {
      return;
    }

    const existing = document.getElementById(SCANNER_BTN_ID);
    if (existing) existing.remove();

    const button = document.createElement("div");
    button.id = SCANNER_BTN_ID;
    button.title = "Quét câu hỏi và hiển thị kết quả kiểm tra";
    
    // Nạp SVG Kính lúp Lucide
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
    `;

    // Đồng bộ Theme Mode & màu chủ đạo lên Button lơ lửng
    if (window.houQuizUtils && typeof window.houQuizUtils.fetchAPI === "function") {
      chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
        const color = res.hou_ui_primary_color || "green";
        button.className = `theme-${color}`;
        if (res.hou_ui_theme_mode === "dark") button.classList.add("dark");
      });
    }

    button.addEventListener("click", () => {
      triggerManualScan();
    });

    document.body.appendChild(button);
  }

  // Chạy khởi tạo nút lơ lửng
  if (document.readyState === "complete") {
    createScannerButton();
  } else {
    window.addEventListener("load", createScannerButton);
  }
})();
