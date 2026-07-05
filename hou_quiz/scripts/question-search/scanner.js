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
        const questions = scanReviewQuestions();
        sendResponse({ success: true, questions: questions });
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err) });
      }
      return true;
    }
  });

  function isInputCorrect(input) {
    if (!input) return false;
    
    const cls = input.className || "";
    if (/\b(correct|right|ok)\b/i.test(cls)) return true;
    if (/\b(incorrect|wrong)\b/i.test(cls)) return false;

    let parent = input.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      const pCls = parent.className || "";
      if (/\b(incorrect|wrong)\b/i.test(pCls)) return false;
      if (/\b(correct)\b/i.test(pCls)) return true;
      parent = parent.parentElement;
      depth++;
    }

    const parentEl = input.parentElement;
    if (parentEl) {
      const checkEls = [...parentEl.children, ...(parentEl.parentElement?.children || [])];
      for (const el of checkEls) {
        if (el === input) continue;
        const txt = el.textContent || "";
        const cName = el.className || "";
        if (/[✗×❌]/.test(txt) && !/[✓✔]/.test(txt)) return false;
        if (/\b(incorrect|wrong|error)\b/i.test(cName)) return false;
        if (/[✓✔✅]/.test(txt)) return true;
        if (/\b(correct|check|tick|ok)\b/i.test(cName)) return true;
      }
    }

    const style = window.getComputedStyle(input);
    const bgColor = style.backgroundColor || "";
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      if (g > r && g > 150) return true;
      if (r > g && r > 150) return false;
    }

    return false;
  }

  function extractSingleFillBlankRow(element, parsedRightAnswers) {
    if (!element) return null;
    const inputs = element.querySelectorAll('input[type="text"], input:not([type]), select');
    if (inputs.length === 0) return null;

    const correctAnswers = [];
    inputs.forEach((input, idx) => {
      let val = "";
      if (parsedRightAnswers && parsedRightAnswers.length > 0) {
        const matchedAns = parsedRightAnswers.find(a => a.index === (idx + 1)) || parsedRightAnswers[idx];
        if (matchedAns && matchedAns.answer) {
          val = matchedAns.answer;
        }
      }
      
      if (!val && isInputCorrect(input)) {
        if (input.tagName === "SELECT") {
          const opt = input.options[input.selectedIndex];
          val = opt?.text?.trim() || opt?.value?.trim() || "";
        } else {
          val = input.value?.trim() || "";
        }
      }

      if (val) {
        correctAnswers.push({ index: idx + 1, value: val });
      }
    });

    if (correctAnswers.length === 0) return null;

    let correctAnswer = "";
    if (correctAnswers.length === 1) {
      correctAnswer = correctAnswers[0].value;
    } else {
      correctAnswer = correctAnswers.map(a => `${a.index}.${a.value}`).join(", ");
    }

    const cloned = element.cloneNode(true);
    cloned.querySelectorAll('input[type="text"], input:not([type]), select').forEach(input => {
      input.replaceWith(document.createTextNode(" ... "));
    });
    cloned.querySelectorAll(".feedback, .feedbackspan, .accesshide, .questioncorrectnessicon").forEach(e => e.remove());
    let questionText = cloned.textContent.replace(/\s+/g, " ").trim();
    questionText = questionText.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, "").trim();

    return {
      questionText,
      correctAnswer,
      element
    };
  }

  function scanReviewQuestions() {
    const results = [];
    const questionContainers = document.querySelectorAll(".que, div.question, .question-container");
    const utils = window.houQuizUtils;

    questionContainers.forEach((container, idx) => {
      try {
        const qtextEl = container.querySelector(".qtext, .questiontext") || container.querySelector(".formulation");
        if (!qtextEl) return;

        const clonedQtext = qtextEl.cloneNode(true);
        clonedQtext.querySelectorAll("script, style, .answer, label, .prompt, .accesshide").forEach(el => el.remove());
        let questionText = clonedQtext.textContent.replace(/\s+/g, " ").trim();
        questionText = questionText.replace(/^mô tả câu hỏi/i, "").trim();

        const inputElements = container.querySelectorAll('input[type="text"], input:not([type]), textarea, select');
        const isFillBlank = inputElements.length > 0;

        if (isFillBlank) {
          let parsedRightAnswers = [];
          const rightAnswerEl = container.querySelector(".outcome .rightanswer, .rightanswer");
          if (rightAnswerEl) {
            let raText = rightAnswerEl.textContent.replace(/\s+/g, " ").trim();
            raText = raText
              .replace(/^The correct answer is:\s*/i, "")
              .replace(/^Đáp án đúng là:\s*/i, "")
              .replace(/^Câu trả lời đúng là:\s*/i, "")
              .replace(/^The correct answers are:\s*/i, "")
              .replace(/^Các đáp án đúng là:\s*/i, "")
              .trim();
            
            if (window.houQuizMatch && typeof window.houQuizMatch.parseNumberedAnswers === "function") {
              parsedRightAnswers = window.houQuizMatch.parseNumberedAnswers(raText);
            }
          }

          const extractFillBlankSubQuestions = window.houQuizUI?.extractFillBlankSubQuestions;
          let subQs = [];
          if (typeof extractFillBlankSubQuestions === "function") {
            subQs = extractFillBlankSubQuestions(container);
          }

          if (subQs && subQs.length > 0) {
            subQs.forEach((subQ, subQIdx) => {
              const res = extractSingleFillBlankRow(subQ.element, parsedRightAnswers);
              if (res && res.correctAnswer) {
                results.push({
                  index: String(results.length + 1),
                  question: res.questionText,
                  answer: res.correctAnswer,
                  choices: [],
                  type: "fill_blank",
                  stt: idx + 1,
                  dbStatus: "checking",
                  dbStatusText: "Đang kiểm tra...",
                  isChecked: true
                });
              }
            });
          } else {
            const res = extractSingleFillBlankRow(container, parsedRightAnswers);
            if (res && res.correctAnswer) {
              results.push({
                index: String(results.length + 1),
                question: res.questionText,
                answer: res.correctAnswer,
                choices: [],
                type: "fill_blank",
                stt: idx + 1,
                dbStatus: "checking",
                dbStatusText: "Đang kiểm tra...",
                isChecked: true
              });
            }
          }
          return;
        }

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

        const answerContainer = container.querySelector(".answer");
        let choices = [];
        let optionElements = [];
        if (answerContainer) {
          optionElements = Array.from(answerContainer.querySelectorAll(".r0, .r1, label, .flex-fill, div[role='option']"));
          optionElements = optionElements.filter(el => !optionElements.some(otherEl => otherEl !== el && el.contains(otherEl)));
          choices = optionElements.map(el => el.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim()).filter(Boolean);
        }

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
          index: String(results.length + 1),
          question: questionText,
          answer: rightAnswerText,
          choices: choices,
          type: "multiple_choice",
          stt: idx + 1,
          dbStatus: "checking",
          dbStatusText: "Đang kiểm tra...",
          isChecked: true
        });
      } catch (e) {
        console.error("[HouQuiz Scanner] Lỗi khi quét câu hỏi:", e);
      }
    });

    return results;
  }

  async function checkExistingQuestions(questions, courseTitle, popupEl) {
    try {
      const config = window.houQuizConfig || { API_URL: "http://localhost:3001/api/v1" };
      const docRes = await window.houQuizUtils.fetchAPI(`${config.API_URL}/documents`);
      const docList = Array.isArray(docRes) ? docRes : (docRes && Array.isArray(docRes.documents) ? docRes.documents : []);

      const cleanWebTitle = (courseTitle || "").normalize().toLowerCase().replace(/\s+/g, " ").trim();
      const matchedDoc = docList.find(doc => {
        const cleanDocTitle = (doc.title || "").normalize().toLowerCase().replace(/\s+/g, " ").trim();
        return cleanDocTitle === cleanWebTitle || cleanDocTitle.includes(cleanWebTitle) || cleanWebTitle.includes(cleanDocTitle);
      });

      if (!matchedDoc) {
        questions.forEach(q => {
          q.dbStatus = "new";
          q.dbStatusText = "Chưa có";
          q.dbId = null;
          const badge = document.getElementById(`badge-q-${q.index}`);
          if (badge) {
            badge.textContent = "Chưa có";
            badge.style.color = "var(--success, #10b981)";
            badge.style.background = "rgba(16, 185, 129, 0.12)";
            badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
          }
        });
        return;
      }

      popupEl.dataset.documentId = matchedDoc.id;

      const dbQuestions = await window.houQuizUtils.fetchAPI(`${config.API_URL}/questions/document/${matchedDoc.id}`);
      const dbList = Array.isArray(dbQuestions) ? dbQuestions : (dbQuestions && Array.isArray(dbQuestions.questions) ? dbQuestions.questions : []);

      questions.forEach(q => {
        try {
          const cleanQText = window.houQuizUtils.normalizeTextForMatching(q.question || "");

          const matchedDbQ = dbList.find(dbQ => {
            const cleanDBQ = window.houQuizUtils.normalizeTextForMatching(dbQ.question || "");
            const cleanDBAns = window.houQuizUtils.normalizeTextForMatching(dbQ.answer || "");
            const cleanQAns = window.houQuizUtils.normalizeTextForMatching(q.answer || "");

            const isQuestionMatch = cleanDBQ === cleanQText || cleanDBQ.includes(cleanQText) || cleanQText.includes(cleanDBQ);
            if (!isQuestionMatch) return false;

            return cleanDBAns === cleanQAns || cleanDBAns.includes(cleanQAns) || cleanQAns.includes(cleanDBAns);
          });

          q.dbStatus = "checked";
          q.dbId = matchedDbQ ? matchedDbQ.id : null;
          const badge = document.getElementById(`badge-q-${q.index}`);

          if (!matchedDbQ) {
            q.dbStatusText = "Chưa có";
            if (badge) {
              badge.textContent = "Chưa có";
              badge.style.color = "var(--success, #10b981)";
              badge.style.background = "rgba(16, 185, 129, 0.12)";
              badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
            }
          } else {
            if (q.type === "fill_blank") {
              q.dbStatusText = "Đã có trong DB";
              q.dbStatus = "exists";
              if (badge) {
                badge.textContent = "Đã có trong DB";
                badge.style.color = "#f59e0b";
                badge.style.background = "rgba(245, 158, 11, 0.12)";
                badge.style.borderColor = "rgba(245, 158, 11, 0.2)";
              }
            } else {
              const hasChoices = Array.isArray(matchedDbQ.choices) && matchedDbQ.choices.length > 0;
              if (hasChoices) {
                q.dbStatusText = "Đã có trong DB";
                q.dbStatus = "exists";
                if (badge) {
                  badge.textContent = "Đã có trong DB";
                  badge.style.color = "#f59e0b";
                  badge.style.background = "rgba(245, 158, 11, 0.12)";
                  badge.style.borderColor = "rgba(245, 158, 11, 0.2)";
                }
              } else {
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
          }
        } catch (itemErr) {
          console.error("[HouQuiz Scanner] Lỗi khi check trùng cho câu đơn lẻ:", itemErr, q);
        }
      });
    } catch (err) {
      console.error("[HouQuiz Scanner] Lỗi khi kiểm tra câu hỏi trùng lặp:", err);
    }
  }

  async function triggerManualScan() {
    const questions = scanReviewQuestions();
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
