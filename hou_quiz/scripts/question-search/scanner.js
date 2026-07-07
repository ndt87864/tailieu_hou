(function () {
  "use strict";

  if (window.houQuizScannerLoaded) return;
  window.houQuizScannerLoaded = true;

  const SCANNER_BTN_ID = "hou-quiz-scanner-btn";

  if (sessionStorage.getItem("hou_quiz_auto_open_scanner") === "true") {
    sessionStorage.removeItem("hou_quiz_auto_open_scanner");
    const runScanOnLoad = () => {
      setTimeout(() => {
        triggerManualScan();
      }, 800);
    };
    if (document.readyState === "complete") {
      runScanOnLoad();
    } else {
      window.addEventListener("load", runScanOnLoad);
    }
  }

  let scannedQuestionsList = [];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "scanQuestions") {
      try {
        const questions = window.houQuizScannerCore.scanReviewQuestions();
        sendResponse({ success: true, questions: questions });
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      }
      return true;
    }
  });

  async function checkExistingQuestions(questions, courseTitle, popupEl) {
    try {
      const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };
      const docRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`);
      const docList = Array.isArray(docRes) ? docRes : (docRes && Array.isArray(docRes.documents) ? docRes.documents : []);

      const titleParts = (courseTitle || "").split("/").map(t => t.trim()).filter(Boolean);
      const cleanWebTitles = titleParts.map(part => window.houQuizUtils.normalizeTextForMatching(part));

      function isCourseTitleMatch(webTitle, docTitle) {
        const w = String(webTitle || "").toLowerCase().trim();
        const d = String(docTitle || "").toLowerCase().trim();
        if (w === d) return true;

        const cleanW = window.houQuizUtils.stripVietnameseDiacritics(w).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const cleanD = window.houQuizUtils.stripVietnameseDiacritics(d).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        if (cleanW === cleanD) return true;

        const getBaseAndNumbers = (str) => {
          const match = str.match(/^(.*?)\s*(\b\d+(?:[\s+,&/\\]+\d+)*\b)\s*$/);
          if (match) {
            const base = match[1].trim();
            const nums = match[2].match(/\d+/g) || [];
            return { base, nums };
          }
          return { base: str, nums: [] };
        };

        const parsedW = getBaseAndNumbers(cleanW);
        const parsedD = getBaseAndNumbers(cleanD);

        if (parsedW.base && parsedD.base && parsedW.base === parsedD.base) {
          if (parsedW.nums.length > 0 && parsedD.nums.length > 0) {
            const allNumsMatched = parsedW.nums.every(num => parsedD.nums.includes(num));
            if (allNumsMatched) return true;
          }
        }

        return cleanD.includes(cleanW) || cleanW.includes(cleanD);
      }

      const matchedDocs = [];
      if (docList.length > 0) {
        const tempMatched = [];
        docList.forEach(doc => {
          const cleanDocTitle = window.houQuizUtils.normalizeTextForMatching(doc.title);
          const matchIndex = cleanWebTitles.findIndex(cleanWebTitle => isCourseTitleMatch(cleanWebTitle, cleanDocTitle));
          if (matchIndex !== -1) {
            tempMatched.push({ doc, matchIndex });
          }
        });
        tempMatched.sort((a, b) => a.matchIndex - b.matchIndex);
        matchedDocs.push(...tempMatched.map(item => item.doc));
      }

      const docSelect = popupEl.querySelector("#scanner-doc-select");
      if (docSelect) {
        docSelect.innerHTML = "";

        if (matchedDocs.length > 1) {
          const allOpt = document.createElement("option");
          allOpt.value = "__all_matched__";
          allOpt.textContent = `Tất cả tài liệu khớp (${matchedDocs.length})`;
          docSelect.appendChild(allOpt);
        }
        
        matchedDocs.forEach(doc => {
          const opt = document.createElement("option");
          opt.value = doc.id;
          opt.textContent = doc.title;
          docSelect.appendChild(opt);
        });

        const newOpt = document.createElement("option");
        newOpt.value = "__new__";
        newOpt.textContent = `+ Tạo mới: ${titleParts[titleParts.length - 1] || courseTitle}`;
        docSelect.appendChild(newOpt);

        if (docList.length > matchedDocs.length) {
          const optGroup = document.createElement("optgroup");
          optGroup.label = "Tài liệu khác trong CSDL";
          docList.forEach(doc => {
            if (!matchedDocs.some(md => md.id === doc.id)) {
              const opt = document.createElement("option");
              opt.value = doc.id;
              opt.textContent = doc.title;
              optGroup.appendChild(opt);
            }
          });
          docSelect.appendChild(optGroup);
        }
      }

      const initialDocId = matchedDocs.length > 1 ? "__all_matched__" : (matchedDocs.length > 0 ? matchedDocs[0].id : "__new__");
      if (docSelect) docSelect.value = initialDocId;
      popupEl.dataset.documentId = initialDocId === "__new__" ? "" : initialDocId;
      popupEl.dataset.matchedDocIds = JSON.stringify(matchedDocs.map(d => d.id));

      if (docSelect) {
        docSelect.addEventListener("change", (e) => {
          popupEl.dataset.documentId = e.target.value === "__new__" ? "" : e.target.value;
          updateQuestionsActiveMapping(e.target.value);
        });
      }

      questions.forEach(q => {
        const badge = document.getElementById(`badge-q-${q.index}`);
        if (badge) {
          badge.textContent = "Đang kiểm tra...";
        }
      });

      const docsQuestionsMap = {};
      await Promise.all(matchedDocs.map(async (doc) => {
        try {
          const dbQuestions = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/document/${doc.id}`);
          docsQuestionsMap[doc.id] = Array.isArray(dbQuestions) ? dbQuestions : (dbQuestions && Array.isArray(dbQuestions.questions) ? dbQuestions.questions : []);
        } catch (err) {
          console.error(`[HouQuiz Scanner] Lỗi tải tài liệu ${doc.id}:`, err);
          docsQuestionsMap[doc.id] = [];
        }
      }));

      questions.forEach(q => {
        q.allDocStatuses = matchedDocs.map(doc => {
          const dbList = docsQuestionsMap[doc.id] || [];
          const cleanQText = window.houQuizUtils.normalizeTextForMatching(q.question || "");

          const matchedDbQ = dbList.find(dbQ => {
            const cleanDBQ = window.houQuizUtils.normalizeTextForMatching(dbQ.question || "");
            const cleanDBAns = window.houQuizUtils.normalizeTextForMatching(dbQ.answer || "");
            const cleanQAns = window.houQuizUtils.normalizeTextForMatching(q.answer || "");

            const isQuestionMatch = cleanDBQ === cleanQText || cleanDBQ.includes(cleanQText) || cleanQText.includes(cleanDBQ);
            if (!isQuestionMatch) return false;

            return cleanDBAns === cleanQAns || cleanDBAns.includes(cleanQAns) || cleanQAns.includes(cleanDBAns);
          });

          let statusText = "Chưa có";
          let statusType = "new";

          if (matchedDbQ) {
            const isValQImg = q.rawQuestionImageUrl && q.rawQuestionImageUrl.includes("pluginfile.php");
            const isValAnsImg = q.rawAnswerImageUrl && q.rawAnswerImageUrl.includes("pluginfile.php");
            const isValChoiceImg = q.rawChoicesImageUrl && q.rawChoicesImageUrl.includes("pluginfile.php");

            const needsQuestionUrl = isValQImg && !matchedDbQ.url_question;
            const needsAnswerUrl = isValAnsImg && !matchedDbQ.url_answer;
            const needsChoicesUrl = isValChoiceImg && !matchedDbQ.url_choices;

            if (needsQuestionUrl || needsAnswerUrl || needsChoicesUrl) {
              statusText = "Thiếu ảnh";
              statusType = "missing_choices";
            } else if (q.type === "fill_blank") {
              statusText = "Đã có";
              statusType = "exists";
            } else {
              const hasChoices = Array.isArray(matchedDbQ.choices) && matchedDbQ.choices.length > 0;
              if (hasChoices) {
                statusText = "Đã có";
                statusType = "exists";
              } else {
                statusText = "Thiếu choices";
                statusType = "missing_choices";
              }
            }
          }

          return {
            docId: doc.id,
            docTitle: doc.title,
            statusText: statusText,
            statusType: statusType,
            dbId: matchedDbQ ? matchedDbQ.id : null,
            matchedDbQ: matchedDbQ
          };
        });

        const badge = document.getElementById(`badge-q-${q.index}`);
        if (badge) {
          badge.style.background = "none";
          badge.style.border = "none";
          badge.style.padding = "0";
          badge.textContent = "";

          const renderTag = (status) => {
            const span = document.createElement("span");
            span.className = `scanner-status-tag tag-${status.statusType}`;
            span.title = `${status.docTitle}: ${status.statusText}`;
            span.textContent = `${status.docTitle}: ${status.statusText}`;
            return span;
          };

          if (q.allDocStatuses.length === 0) {
            badge.textContent = "Chưa có";
            badge.style.color = "var(--success, #10b981)";
            badge.style.background = "rgba(16, 185, 129, 0.12)";
            badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
            badge.style.border = "1px solid";
            badge.style.padding = "2px 8px";
            badge.style.borderRadius = "6px";
            badge.style.fontSize = "10px";
            badge.style.fontWeight = "700";
          } else if (q.allDocStatuses.length <= 2) {
            q.allDocStatuses.forEach(status => {
              badge.appendChild(renderTag(status));
            });
          } else {
            q.allDocStatuses.slice(0, 2).forEach(status => {
              badge.appendChild(renderTag(status));
            });

            const moreCount = q.allDocStatuses.length - 2;
            const moreTag = document.createElement("span");
            moreTag.className = "scanner-status-tag tag-more";
            moreTag.textContent = `+${moreCount}`;
            moreTag.title = "Nhấp để hiển thị toàn bộ tài liệu";
            
            moreTag.addEventListener("click", (e) => {
              e.stopPropagation();
              moreTag.remove();
              q.allDocStatuses.slice(2).forEach(status => {
                badge.appendChild(renderTag(status));
              });
            });
            badge.appendChild(moreTag);
          }
        }
      });

      const updateQuestionsActiveMapping = (targetDocId) => {
        questions.forEach(q => {
          if (!q.allDocStatuses) return;
          if (targetDocId === "__all_matched__") {
            const hasNew = q.allDocStatuses.some(s => s.statusType !== "exists" && s.statusType !== "missing_choices");
            const hasMissing = q.allDocStatuses.some(s => s.statusType === "missing_choices");
            if (hasNew) {
              q.dbStatus = "checked";
              q.dbStatusText = "Chưa có";
              q.dbId = null;
            } else if (hasMissing) {
              q.dbStatus = "missing_choices";
              q.dbStatusText = "Thiếu choices";
              q.dbId = q.allDocStatuses.find(s => s.statusType === "missing_choices")?.dbId || null;
            } else {
              q.dbStatus = "exists";
              q.dbStatusText = "Đã có";
              q.dbId = q.allDocStatuses[0]?.dbId || null;
            }
            return;
          }

          const activeStatus = q.allDocStatuses.find(s => s.docId === targetDocId);
          if (activeStatus) {
            q.dbStatus = activeStatus.statusType === "exists" ? "exists" : (activeStatus.statusType === "missing_choices" ? "missing_choices" : "checked");
            q.dbStatusText = activeStatus.statusText;
            q.dbId = activeStatus.dbId;
          } else {
            q.dbStatus = "new";
            q.dbStatusText = "Chưa có";
            q.dbId = null;
          }
        });
      };

      updateQuestionsActiveMapping(initialDocId);
    } catch (err) {
      console.error("[HouQuiz Scanner] Lỗi khi kiểm tra câu hỏi trùng lặp:", err);
    }
  }

  async function triggerManualScan() {
    const questions = window.houQuizScannerCore.scanReviewQuestions();
    if (questions.length === 0) {
      if (window.houQuizScannerUI) {
        window.houQuizScannerUI.showPageToast("Không tìm thấy câu hỏi & đáp án nào hợp lệ để quét trên trang này.", false);
      }
      return;
    }

    chrome.storage.local.get(["hou_current_course"], (res) => {
      const courseTitle = res.hou_current_course || "Môn học chưa đặt tên";
      if (window.houQuizScannerUI) {
        window.houQuizScannerUI.showScannerResultsPopup(
          questions,
          courseTitle,
          checkExistingQuestions,
          scannedQuestionsList,
          (updatedList) => {
            scannedQuestionsList = updatedList;
          }
        );
      }
    });
  }

  function createScannerButton() {
    if (!/\/mod\/quiz\/(review|attempt)\.php/.test(window.location.pathname || "")) {
      return;
    }

    const existing = document.getElementById(SCANNER_BTN_ID);
    if (existing) existing.remove();

    const button = document.createElement("div");
    button.id = SCANNER_BTN_ID;
    button.title = "Quét câu hỏi và hiển thị kết quả kiểm tra";
    
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan-line">
        <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
        <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
        <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
        <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
        <path d="M7 12h10"/>
      </svg>
    `;

    chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
      const color = res.hou_ui_primary_color || "green";
      button.className = `theme-${color}`;
      if (res.hou_ui_theme_mode === "dark") button.classList.add("dark");
    });

    button.addEventListener("click", () => {
      if (sessionStorage.getItem("hou_quiz_solver_active") === "true") {
        sessionStorage.setItem("hou_quiz_auto_open_scanner", "true");
        window.location.reload();
      } else {
        triggerManualScan();
      }
    });

    document.body.appendChild(button);
  }

  if (document.readyState === "complete") {
    createScannerButton();
  } else {
    window.addEventListener("load", createScannerButton);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      chrome.storage.local.get(["hou_ui_theme_mode", "hou_ui_primary_color"], (res) => {
        const color = res.hou_ui_primary_color || "green";
        const btn = document.getElementById(SCANNER_BTN_ID);
        if (btn) {
          btn.className = `theme-${color}`;
          if (res.hou_ui_theme_mode === "dark") {
            btn.classList.add("dark");
          } else {
            btn.classList.remove("dark");
          }
        }
      });
    }
  });
})();
