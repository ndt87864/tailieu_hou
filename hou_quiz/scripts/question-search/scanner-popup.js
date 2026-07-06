(function () {
  "use strict";

  if (window.houQuizScannerUI) return;

  const OVERLAY_ID = "hou-quiz-scanner-overlay";
  const POPUP_ID = "hou-quiz-scanner-popup";

  function closeScannerPopup() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function escapeHTML(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTextWithImages(text) {
    if (!text) return "";
    let escaped = escapeHTML(text);
    const urlRegex = /(?:&quot;|")?(https?:\/\/[^\s&"<>]+?\.(?:png|jpe?g|gif|svg|webp|bmp)(?:\?[^\s&"<>]*)*)(?:&quot;|")?/gi;
    return escaped.replace(urlRegex, (match, url) => {
      return `<img src="${url}" class="scanner-preview-img" style="max-height: 100px; max-width: 100%; display: inline-block; vertical-align: middle; margin: 2px 4px; border-radius: 2px;" />`;
    });
  }

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

  function showScannerResultsPopup(questions, courseTitle, checkedQuestionsFn, scannedQuestionsListRef, setScannedQuestionsFn) {
    closeScannerPopup();
    let scannedQuestionsList = questions;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    
    const popup = document.createElement("div");
    popup.id = POPUP_ID;

    const buildQuestionsHTML = () => {
      return scannedQuestionsList.map(q => {
        const cleanAns = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(q.answer) : q.answer;
        let answersListHTML = "";

        const isFillBlank = q.type === "fill_blank" || !q.choices || q.choices.length === 0;

        if (isFillBlank) {
          answersListHTML = `
            <div class="scanner-answer-item correct">
              <span class="scanner-ans-label">Đáp án đúng</span>
              <span class="scanner-ans-text">${formatTextWithImages(q.answer)}</span>
            </div>
          `;
        } else {
          answersListHTML = q.choices.map((c, cIdx) => {
            const letter = String.fromCharCode(65 + cIdx);
            const cleanC = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(c) : c;
            const isCorrect = cleanC === cleanAns || c === q.answer;
            
            return `
              <div class="scanner-answer-item ${isCorrect ? 'correct' : ''}">
                <span class="scanner-ans-label">${letter}</span>
                <span class="scanner-ans-text">${formatTextWithImages(c)}</span>
                ${isCorrect ? `
                  <span class="scanner-ans-check">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                ` : ''}
              </div>
            `;
          }).join("");
        }

        return `
          <div class="scanner-question-item" data-index="${q.index}">
            <div class="scanner-question-header">
              <div class="scanner-q-meta">
                <input type="checkbox" class="scanner-q-checkbox" ${q.isChecked ? 'checked' : ''} />
                <span class="scanner-q-num">Câu ${q.index}</span>
                <span class="scanner-q-type">${isFillBlank ? 'Điền từ' : 'Trắc nghiệm'}</span>
                <span class="scanner-q-doc">Tài liệu: ${escapeHTML(courseTitle)}</span>
                <span class="scanner-q-badge" id="badge-q-${q.index}">${q.dbStatusText || 'Đang kiểm tra...'}</span>
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
            <div class="scanner-question-text" id="qtext-${q.index}">${formatTextWithImages(q.question)}</div>
            <div class="scanner-answers" id="qanswers-${q.index}">
              ${answersListHTML}
            </div>
          </div>
        `;
      }).join("");
    };

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
          <span class="scanner-count">${scannedQuestionsList.length} câu hỏi</span>
          <button class="scanner-close" title="Đóng">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="scanner-body">
        <div class="scanner-doc-selector-container" style="padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.02);">
          <span style="font-weight: 600; font-size: 13px;">Bộ tài liệu đích:</span>
          <select id="scanner-doc-select" style="flex: 1; padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border); font-size: 13px; background: var(--bg-card); color: var(--foreground); cursor: pointer;"></select>
        </div>
        <div class="scanner-questions-list">
          ${buildQuestionsHTML()}
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

    chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
      const color = res.hou_ui_primary_color || "green";
      popup.className = `theme-${color}`;
      if (res.hou_ui_theme_mode === "dark") popup.classList.add("dark");
    });

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeScannerPopup();
    });
    popup.querySelector(".scanner-close").addEventListener("click", closeScannerPopup);

    popup.querySelector("#btn-copy-all").addEventListener("click", () => {
      const text = scannedQuestionsList.map(q => {
        const isFB = q.type === "fill_blank" || !q.choices || q.choices.length === 0;
        const choicesText = isFB ? "" : `\nChoices: ${q.choices.join(" | ")}`;
        return `Câu hỏi: ${q.question}\nĐáp án: ${q.answer}${choicesText}`;
      }).join("\n\n");
      navigator.clipboard.writeText(text).then(() => {
        showPageToast("Đã copy toàn bộ nội dung câu hỏi!");
      });
    });

    popup.querySelector("#btn-select-all").addEventListener("click", () => {
      scannedQuestionsList.forEach(q => q.isChecked = true);
      popup.querySelectorAll(".scanner-q-checkbox").forEach(cb => cb.checked = true);
    });

    popup.querySelector("#btn-delete-selected").addEventListener("click", () => {
      const checkedQuestions = scannedQuestionsList.filter(q => q.isChecked);
      if (checkedQuestions.length === 0) {
        showPageToast("Chưa chọn câu hỏi nào để xóa", false);
        return;
      }
      scannedQuestionsList = scannedQuestionsList.filter(q => !q.isChecked);
      setScannedQuestionsFn(scannedQuestionsList);
      checkedQuestions.forEach(q => {
        const item = popup.querySelector(`.scanner-question-item[data-index="${q.index}"]`);
        if (item) item.remove();
      });
      popup.querySelector(".scanner-count").textContent = `${scannedQuestionsList.length} câu hỏi`;
      showPageToast(`Đã xóa ${checkedQuestions.length} câu hỏi ra khỏi danh sách.`);
    });

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

        saveBtn.innerHTML = `Đang tải ảnh...`;

        // 1. Thu thập và loại bỏ các liên kết ảnh trùng lặp cần tải
        const imageRequests = [];
        const seenUrls = new Set();

        for (const q of activeQuestions) {
          if (q.rawQuestionImageUrl && !q.url_question) {
            const urls = q.rawQuestionImageUrl.split(",").map(u => u.trim()).filter(Boolean);
            urls.forEach(url => {
              const reqKey = `question_url:${url}`;
              if (!seenUrls.has(reqKey)) {
                seenUrls.add(reqKey);
                imageRequests.push({ rawUrl: url, folder: "question_url" });
              }
            });
          }
          if (q.rawAnswerImageUrl && !q.url_answer) {
            const urls = q.rawAnswerImageUrl.split(",").map(u => u.trim()).filter(Boolean);
            urls.forEach(url => {
              const reqKey = `answer_url:${url}`;
              if (!seenUrls.has(reqKey)) {
                seenUrls.add(reqKey);
                imageRequests.push({ rawUrl: url, folder: "answer_url" });
              }
            });
          }
          if (q.rawChoicesImageUrl && !q.url_choices) {
            const urls = q.rawChoicesImageUrl.split(",").map(u => u.trim()).filter(Boolean);
            urls.forEach(url => {
              const reqKey = `choice_url:${url}`;
              if (!seenUrls.has(reqKey)) {
                seenUrls.add(reqKey);
                imageRequests.push({ rawUrl: url, folder: "choice_url" });
              }
            });
          }
        }

        // 2. Download các ảnh song song và chuyển đổi sang Base64 ở phía Client
        if (imageRequests.length > 0) {
          const downloadPromises = imageRequests.map(async (req) => {
            const { rawUrl, folder } = req;
            
            // Bộ lọc format URL
            if (folder === "question_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
              return null;
            }
            if (folder === "answer_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
              return null;
            }
            if (folder === "choice_url" && !/\/pluginfile\.php\/.*\/question\//i.test(rawUrl)) {
              return null;
            }

            try {
              const response = await fetch(rawUrl);
              const blob = await response.blob();
              const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              const urlPath = new URL(rawUrl).pathname;
              const fileName = urlPath.split('/').pop() || null;
              
              return { base64, folder, fileName, originalUrl: rawUrl };
            } catch (err) {
              console.error(`[HouQuiz Scanner] Lỗi khi tải ảnh (${rawUrl}):`, err);
              return null;
            }
          });

          const preparedImages = (await Promise.all(downloadPromises)).filter(Boolean);

          // 3. Upload hàng loạt lên Supabase Storage qua API bulk-upload-images
          if (preparedImages.length > 0) {
            saveBtn.innerHTML = `Đang tải lên Storage...`;
            const uploadRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/bulk-upload-images`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ images: preparedImages })
            });

            if (uploadRes && uploadRes.success && Array.isArray(uploadRes.uploaded)) {
              // 4. Ánh xạ các URL đã upload thành công trở lại các câu hỏi
              const urlMap = {};
              uploadRes.uploaded.forEach((item) => {
                if (item && item.url && !item.error) {
                  urlMap[item.originalUrl] = item.url;
                }
              });

              for (const q of activeQuestions) {
                if (q.rawQuestionImageUrl) {
                  const rawUrls = q.rawQuestionImageUrl.split(",").map(u => u.trim()).filter(Boolean);
                  const uploadedUrls = rawUrls.map(url => urlMap[url] || url);
                  q.url_question = uploadedUrls.filter(u => u.includes("supabase.co") || u.includes("tailieuhou")).join(",");
                }
                if (q.rawAnswerImageUrl) {
                  const rawUrls = q.rawAnswerImageUrl.split(",").map(u => u.trim()).filter(Boolean);
                  const uploadedUrls = rawUrls.map(url => urlMap[url] || url);
                  q.url_answer = uploadedUrls.filter(u => u.includes("supabase.co") || u.includes("tailieuhou")).join(",");
                }
                if (q.rawChoicesImageUrl) {
                  const rawUrls = q.rawChoicesImageUrl.split(",").map(u => u.trim()).filter(Boolean);
                  const uploadedUrls = rawUrls.map(url => urlMap[url] || url);
                  q.url_choices = uploadedUrls.filter(u => u.includes("supabase.co") || u.includes("tailieuhou")).join(",");
                }
              }
            }
          }
        }

        saveBtn.innerHTML = `Đang đồng bộ...`;

        let matchedDocId = popup.dataset.documentId;
        let matchedDocIds = [];

        if (matchedDocId === "__all_matched__") {
          try {
            matchedDocIds = JSON.parse(popup.dataset.matchedDocIds || "[]");
          } catch (e) {
            console.error("Lỗi parse matchedDocIds:", e);
          }
        } else if (matchedDocId) {
          matchedDocIds = [matchedDocId];
        }

        if (matchedDocIds.length === 0) {
          const docRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`);
          const docList = Array.isArray(docRes) ? docRes : (docRes && Array.isArray(docRes.documents) ? docRes.documents : []);

          let matchedDoc = null;
          if (docList.length > 0) {
            const cleanWebTitle = (courseTitle || "").normalize().toLowerCase().replace(/\s+/g, " ").trim();
            matchedDoc = docList.find(doc => {
              const cleanDocTitle = (doc.title || "").normalize().toLowerCase().replace(/\s+/g, " ").trim();
              return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
            });
          }

          if (!matchedDoc) {
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
          if (matchedDoc) {
            matchedDocIds = [matchedDoc.id];
          }
        }

        if (matchedDocIds.length === 0) {
          throw new Error("Không thể xác định hoặc tạo mới tài liệu trong cơ sở dữ liệu");
        }

        let totalInserted = 0, totalSkipped = 0, totalUpdated = 0;
        
        for (const docId of matchedDocIds) {
          const toInsertForDoc = [];
          const toUpdateChoicesForDoc = [];

          for (const q of activeQuestions) {
            let statusType = "new";
            let dbId = null;

            if (q.allDocStatuses) {
              const matchedStatus = q.allDocStatuses.find(s => s.docId === docId);
              if (matchedStatus) {
                statusType = matchedStatus.statusType;
                dbId = matchedStatus.dbId;
              }
            } else {
              statusType = q.dbStatus === "exists" ? "exists" : (q.dbStatus === "missing_choices" ? "missing_choices" : "new");
              dbId = q.dbId;
            }

            if (statusType === "new" || (statusType !== "exists" && statusType !== "missing_choices")) {
              toInsertForDoc.push(q);
            } else if (statusType === "missing_choices" && dbId) {
              toUpdateChoicesForDoc.push({ ...q, dbId });
            }
          }

          if (toInsertForDoc.length > 0) {
            const saveRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/bulk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                document_id: docId,
                questions: toInsertForDoc.map((q, idx) => ({
                  question: q.question,
                  answer: q.answer,
                  choices: q.choices || [],
                  url_question: q.url_question ?? null,
                  url_answer: q.url_answer ?? null,
                  url_choices: q.url_choices ?? null,
                  order_index: q.stt ?? idx + 1
                }))
              })
            });
            totalInserted += saveRes?.inserted ?? toInsertForDoc.length;
            totalSkipped += saveRes?.skipped ?? 0;
          }

          if (toUpdateChoicesForDoc.length > 0) {
            const updateRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/bulk-update-choices`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                updates: toUpdateChoicesForDoc.map(q => ({
                  id: q.dbId,
                  choices: q.choices || [],
                  url_question: q.url_question ?? null,
                  url_answer: q.url_answer ?? null,
                  url_choices: q.url_choices ?? null
                }))
              })
            });
            totalUpdated += updateRes?.updated ?? toUpdateChoicesForDoc.length;
          }
        }

        const parts = [];
        if (totalInserted > 0) parts.push(`thêm ${totalInserted} câu mới`);
        if (totalSkipped > 0) parts.push(`bỏ qua ${totalSkipped} trùng lặp`);
        if (totalUpdated > 0) parts.push(`cập nhật choices cho ${totalUpdated} câu`);

        if (parts.length === 0) {
          showPageToast("Đã tồn tại trong DB, không có gì cần lưu.", false);
        } else {
          showPageToast(`Hoàn thành: ${parts.join(", ")}.`);
          if (totalInserted > 0 || totalUpdated > 0) {
            if (typeof window.houQuizReloadQuestions === "function") {
              window.houQuizReloadQuestions();
            }
          }
        }
        closeScannerPopup();
      } catch (err) {
        showPageToast(`Lỗi khi lưu DB: ${err.message || err}`, false);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
      }
    });

    const bindRowEvents = (item, questionData) => {
      const qIndex = String(item.getAttribute("data-index"));

      item.querySelector(".scanner-q-checkbox").addEventListener("change", (e) => {
        questionData.isChecked = e.target.checked;
      });

      item.querySelector(".scanner-q-btn.delete").addEventListener("click", () => {
        scannedQuestionsList = scannedQuestionsList.filter(q => String(q.index) !== qIndex);
        setScannedQuestionsFn(scannedQuestionsList);
        item.remove();
        popup.querySelector(".scanner-count").textContent = `${scannedQuestionsList.length} câu hỏi`;
      });

      item.querySelector(".scanner-q-btn.edit").addEventListener("click", () => {
        openEditForm(item, questionData);
      });
    };

    popup.querySelectorAll(".scanner-question-item").forEach(item => {
      const qIndex = String(item.getAttribute("data-index"));
      const questionData = scannedQuestionsList.find(q => String(q.index) === qIndex);
      bindRowEvents(item, questionData);
    });

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });

    checkedQuestionsFn(questions, courseTitle, popup);
  }

  function openEditForm(item, questionData) {
    if (item.querySelector(".scanner-edit-form")) return;

    const textContainer = item.querySelector(".scanner-question-text");
    const answersContainer = item.querySelector(".scanner-answers");

    const form = document.createElement("div");
    form.className = "scanner-edit-form";

    const isFillBlank = questionData.type === "fill_blank" || !questionData.choices || questionData.choices.length === 0;

    let formHTML = "";
    if (isFillBlank) {
      formHTML = `
        <textarea id="edit-qtext-${questionData.index}">${escapeHTML(questionData.question)}</textarea>
        <div class="edit-answers" id="edit-answers-${questionData.index}">
          <div class="edit-answer-row">
            <span style="font-weight:700; width:100px;">Đáp án đúng:</span>
            <input type="text" class="ans-text" style="width:100%;" value="${escapeHTML(questionData.answer)}" />
          </div>
        </div>
        <div class="scanner-edit-actions">
          <button class="scanner-btn scanner-btn-secondary cancel-btn" type="button">Hủy</button>
          <button class="scanner-btn scanner-btn-primary save-btn" type="button">Lưu</button>
        </div>
      `;
    } else {
      formHTML = `
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
    }

    form.innerHTML = formHTML;

    if (!isFillBlank) {
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
    }

    item.appendChild(form);

    form.querySelector(".cancel-btn").addEventListener("click", () => {
      form.remove();
    });

    form.querySelector(".save-btn").addEventListener("click", () => {
      const newQuestionText = form.querySelector("textarea").value.trim();
      const rows = form.querySelectorAll(".edit-answer-row");
      
      if (isFillBlank) {
        const newAnsVal = form.querySelector(".ans-text").value.trim();
        if (!newAnsVal) {
          showPageToast("Đáp án không được trống", false);
          return;
        }
        questionData.question = newQuestionText;
        questionData.answer = newAnsVal;
        questionData.choices = [];

        textContainer.textContent = newQuestionText;
        answersContainer.innerHTML = `
          <div class="scanner-answer-item correct">
            <span class="scanner-ans-label">Đáp án đúng</span>
            <span class="scanner-ans-text">${escapeHTML(newAnsVal)}</span>
          </div>
        `;
      } else {
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

        questionData.question = newQuestionText;
        questionData.choices = newChoices;
        if (newAnswer) questionData.answer = newAnswer;

        textContainer.textContent = newQuestionText;
        
        const cleanAns = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(questionData.answer) : questionData.answer;
        answersContainer.innerHTML = newChoices.map((c, cIdx) => {
          const letter = String.fromCharCode(65 + cIdx);
          const cleanC = window.houQuizUtils ? window.houQuizUtils.normalizeTextForMatching(c) : c;
          const isCorrect = cleanC === cleanAns || c === questionData.answer;
          return `
            <div class="scanner-answer-item ${isCorrect ? 'correct' : ''}">
              <span class="scanner-ans-label">${letter}</span>
              <span class="scanner-ans-text">${escapeHTML(c)}</span>
              ${isCorrect ? `
                <span class="scanner-ans-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              ` : ''}
            </div>
          `;
        }).join("");
      }

      form.remove();
      showPageToast("Đã lưu sửa đổi câu hỏi!");
    });
  }

  window.houQuizScannerUI = {
    showScannerResultsPopup,
    closeScannerPopup,
    showPageToast
  };
})();
