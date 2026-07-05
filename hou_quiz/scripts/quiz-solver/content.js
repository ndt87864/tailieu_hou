(function () {
  "use strict";

  if (window.houQuizLoaded) return;
  window.houQuizLoaded = true;

  // Reset cờ solver active của trang/tab khi bắt đầu load trang
  sessionStorage.removeItem("hou_quiz_solver_active");

  const QUIZ_RESULT_POPUP_ID = "hou-quiz-result-popup";
  const QUIZ_MINIMIZED_ID = "hou-quiz-minimized";

  let lastQuizResult = null;
  let activeDocument = null;
  let dbQuestions = [];

  const getUI = () => window.houQuizUI || {};
  const getLucideIcons = () => getUI().LUCIDE_ICONS || {};
  const applyThemeToElement = (el) => getUI().applyThemeToElement?.(el);
  const showToast = (msg, dur) => getUI().showToast?.(msg, dur);
  const highlightTextInOption = (optEl, mode) => getUI().highlightTextInOption?.(optEl, mode);
  const showFillBlankHint = (inputEl, ansText, hl) => getUI().showFillBlankHint?.(inputEl, ansText, hl);

  const scanQuestionsOnPage = () => getUI().scanQuestionsOnPage?.() || [];

  // Load tài liệu theo môn học (tự động hoặc thủ công)
  async function initDocument() {
    chrome.storage.local.get([
      "hou_auto_select_docs", 
      "hou_show_info_widget", 
      "hou_selected_doc_id", 
      "hou_selected_doc_ids",
      "hou_selected_doc_titles"
    ], async (res) => {
      const autoSelectDocsEnabled = res.hou_auto_select_docs !== false;
      const showInfoWidgetEnabled = res.hou_show_info_widget !== false;
      
      let docIds = res.hou_selected_doc_ids || [];
      // Tương thích ngược nếu người dùng chỉ có hou_selected_doc_id đơn lẻ
      if (docIds.length === 0 && res.hou_selected_doc_id) {
        docIds = [res.hou_selected_doc_id];
      }

      if (!autoSelectDocsEnabled) {
        if (docIds.length === 0) {
          showToast("Chưa chọn tài liệu thủ công.");
          if (showInfoWidgetEnabled) {
            showInfoWidget("Chưa xác định", "Chưa chọn tài liệu thủ công", "Chưa cấu hình");
          } else {
            const widget = document.getElementById("hou-quiz-info-widget");
            if (widget) widget.remove();
          }
          return;
        }

        showToast("Đang tải tài liệu thủ công...");
        const titles = res.hou_selected_doc_titles || [];
        let summaryTitle = "";
        if (titles.length === 0) {
          summaryTitle = "Tài liệu thủ công";
        } else if (titles.length <= 2) {
          summaryTitle = titles.join(", ");
        } else {
          summaryTitle = `${titles[0]}, ${titles[1]} +${titles.length - 2}`;
        }

        if (showInfoWidgetEnabled) {
          showInfoWidget("Thủ công", summaryTitle, "Đang tải câu hỏi...");
        } else {
          const widget = document.getElementById("hou-quiz-info-widget");
          if (widget) widget.remove();
        }

        try {
          dbQuestions = await window.houQuizUtils.fetchQuestionsForDocuments(docIds);
          if (window.houQuizSearchPopup) {
            window.houQuizSearchPopup.setDbQuestions(dbQuestions);
          }
          console.log(`[HouQuiz] Loaded ${dbQuestions.length} questions from DB (Manual).`);
          showToast(`Sẵn sàng làm bài! Đã tải ${dbQuestions.length} câu hỏi.`);
          if (showInfoWidgetEnabled) {
            showInfoWidget("Thủ công", summaryTitle, `Sẵn sàng (${dbQuestions.length} câu)`);
          }
        } catch (err) {
          console.error("[HouQuiz] Error loading questions:", err);
          showToast("Lỗi tải câu hỏi từ DB");
          if (showInfoWidgetEnabled) {
            showInfoWidget("Thủ công", summaryTitle, "Lỗi tải câu hỏi từ DB");
          }
        }
      } else {
        showToast("Đang xác định môn học...");
        const doc = await window.houQuizAutoSelect.detectAndFetchDocument();
        if (doc) {
          activeDocument = doc;
          let cleanCourseTitle = doc.title;
          if (cleanCourseTitle.includes("-") || cleanCourseTitle.includes("–") || cleanCourseTitle.includes("—")) {
            cleanCourseTitle = cleanCourseTitle.split(/[-–—]/)[0].trim();
          }
          showToast(`Môn học: ${cleanCourseTitle}`);
          if (showInfoWidgetEnabled) {
            showInfoWidget(cleanCourseTitle, doc.title, "Đang tải câu hỏi...");
          } else {
            const widget = document.getElementById("hou-quiz-info-widget");
            if (widget) widget.remove();
          }
          
          try {
            const resData = await window.houQuizUtils.fetchAPI(`${window.houQuizConfig.API_URL}/questions/document/${doc.id}`);
            dbQuestions = resData.questions || [];
            if (window.houQuizSearchPopup) {
              window.houQuizSearchPopup.setDbQuestions(dbQuestions);
            }
            console.log(`[HouQuiz] Loaded ${dbQuestions.length} questions from DB.`);
            showToast(`Sẵn sàng làm bài! Đã tải ${dbQuestions.length} câu hỏi.`);
            if (showInfoWidgetEnabled) {
              showInfoWidget(cleanCourseTitle, doc.title, `Sẵn sàng (${dbQuestions.length} câu)`);
            }
          } catch (err) {
            console.error("[HouQuiz] Error loading questions:", err);
            if (showInfoWidgetEnabled) {
              showInfoWidget(cleanCourseTitle, doc.title, "Lỗi tải câu hỏi từ DB");
            }
          }
        } else {
          showToast("Không tìm thấy tài liệu phù hợp.");
          if (showInfoWidgetEnabled) {
            const info = document.querySelector(".page-header-headings h1") || document.querySelector(".coursename a");
            let detectedName = info ? info.textContent.trim() : "Chưa xác định";
            if (detectedName.includes("-") || detectedName.includes("–") || detectedName.includes("—")) {
              detectedName = detectedName.split(/[-–—]/)[0].trim();
            }
            showInfoWidget(detectedName, "Không tìm thấy tài liệu tương ứng", "Không khả dụng");
          } else {
            const widget = document.getElementById("hou-quiz-info-widget");
            if (widget) widget.remove();
          }
        }
      }
    });
  }

  const showInfoWidget = (c, d, s) => getUI().showInfoWidget?.(c, d, s);
  const truncateText = (t, m) => getUI().truncateText?.(t, m) || "";
  const simulateFullClick = (el) => getUI().simulateFullClick?.(el);
  const navigateToNextPage = () => getUI().navigateToNextPage?.();

  function createResultPopup(result) {
    if (window.houQuizResultPopup) {
      window.houQuizResultPopup.createResultPopup(result);
    }
  }


  // Thực hiện làm bài: Quét, so khớp, highlight và tự động chọn đáp án
  function startSolving() {
    console.log("[HouQuiz Debug] Bắt đầu làm bài, số lượng câu hỏi trong DB:", dbQuestions.length);
    // Đánh dấu là Quiz Solver đã hoạt động trên trang hiện tại
    sessionStorage.setItem("hou_quiz_solver_active", "true");

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
        
        if (pq.type === "fill_blank") {
          let matchedDbQ = window.houQuizMatch.matchFillBlankQuestion(pq.text, dbQuestions);
          if (matchedDbQ) {
            solvedCount++;
            exactMatch++;
            details.push({
              question: pq.text,
              answer: matchedDbQ.answer,
              status: "matched",
              statusIcon: getLucideIcons().target,
              sourceIcon: getLucideIcons().database,
              confidence: 1.0,
              matchType: "fill_blank_full"
            });

            if (highlightAnswersEnabled) {
              pq.element.classList.add("hou-highlight-question");
            }

            const parsedAnsList = window.houQuizMatch.parseNumberedAnswers(matchedDbQ.answer);
            pq.inputElements.forEach((inputEl, inputIdx) => {
              const ansObj = parsedAnsList.find(a => a.index === (inputIdx + 1)) || parsedAnsList[inputIdx];
              if (ansObj && ansObj.answer) {
                showFillBlankHint(inputEl, ansObj.answer, highlightAnswersEnabled);
                if (highlightAnswersEnabled) {
                  inputEl.classList.add("hou-highlight-input");
                }
                if (autoSelectAnswersEnabled) {
                  inputEl.value = ansObj.answer;
                  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                  inputEl.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }
            });
          } else {
            // Bước 2: Thử phân rã thành các câu hỏi con
            const extractFillBlankSubQuestions = window.houQuizUI.extractFillBlankSubQuestions;
            let subQs = [];
            if (typeof extractFillBlankSubQuestions === "function") {
              subQs = extractFillBlankSubQuestions(pq.container);
            }
            
            if (subQs && subQs.length > 0) {
              let subSolvedCount = 0;
              subQs.forEach((subQ) => {
                const subMatched = window.houQuizMatch.matchFillBlankQuestion(subQ.text, dbQuestions);
                if (subMatched) {
                  subSolvedCount++;
                  details.push({
                    question: `[Con] ${subQ.text}`,
                    answer: subMatched.answer,
                    status: "matched",
                    statusIcon: getLucideIcons().target,
                    sourceIcon: getLucideIcons().database,
                    confidence: 1.0,
                    matchType: "fill_blank_sub"
                  });

                  if (highlightAnswersEnabled) {
                    subQ.element.classList.add("hou-highlight-question");
                  }

                  const parsedAnsList = window.houQuizMatch.parseNumberedAnswers(subMatched.answer);
                  subQ.inputElements.forEach((inputEl, inputIdx) => {
                    const ansObj = parsedAnsList.find(a => a.index === (inputIdx + 1)) || parsedAnsList[inputIdx];
                    if (ansObj && ansObj.answer) {
                      showFillBlankHint(inputEl, ansObj.answer, highlightAnswersEnabled);
                      if (highlightAnswersEnabled) {
                        inputEl.classList.add("hou-highlight-input");
                      }
                      if (autoSelectAnswersEnabled) {
                        inputEl.value = ansObj.answer;
                        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
                      }
                    }
                  });
                } else {
                  details.push({
                    question: `[Con] ${subQ.text}`,
                    answer: "",
                    status: "not-found",
                    statusIcon: getLucideIcons().xCircle,
                    sourceIcon: "",
                    confidence: 0
                  });
                }
              });

              if (subSolvedCount > 0) {
                solvedCount++;
                exactMatch++;
              } else {
                notFound++;
              }
            } else {
              notFound++;
              details.push({
                question: pq.text,
                answer: "",
                status: "not-found",
                statusIcon: getLucideIcons().xCircle,
                sourceIcon: "",
                confidence: 0
              });
            }
          }
          return;
        }

        const match = window.houQuizMatch.matchQuestionWithDB(pq, dbQuestions);
        if (match) {
          console.log("[HouQuiz Debug] -> Khớp thành công câu hỏi! Đáp án đúng:", match.answerText);
          solvedCount++;
          let status = "matched";
          let statusIcon = getLucideIcons().target;
          let confidence = 1.0;
          if (match.isExact) {
            exactMatch++;
          } else {
            fuzzyMatch++;
            status = "fuzzy";
            statusIcon = getLucideIcons().alertTriangle;
            confidence = 0.95;
          }
          
          details.push({
            question: pq.text,
            answer: match.answerText,
            status: status,
            statusIcon: statusIcon,
            sourceIcon: getLucideIcons().database,
            confidence: confidence,
            matchType: match.matchType
          });

          if (highlightAnswersEnabled) {
            pq.element.classList.add("hou-highlight-question");
          }

          let bestOption = null;
          let bestScore = -1;

          pq.optionElements.forEach(optEl => {
            let optText = optEl.textContent.replace(/\s+/g, " ").trim();
            optText = optText.replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
            const cleanOptText = window.houQuizUtils.normalizeTextForMatching(optText);
            if (window.houQuizUtils.compareNormalized(cleanOptText, match.answerText)) {
              const score = window.houQuizUtils.getSimilarityScore(cleanOptText, match.answerText);
              if (score > bestScore) {
                bestScore = score;
                bestOption = optEl;
              }
            }
          });

          if (bestOption) {
            console.log(`[HouQuiz Debug] -> Chọn đáp án khớp nhất: "${bestOption.textContent.trim()}" (Score: ${bestScore})`);
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
            statusIcon: getLucideIcons().xCircle,
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
  if (window.houQuizSearchPopup) {
    window.houQuizSearchPopup.setApplyThemeFn(applyThemeToElement);
    window.houQuizSearchPopup.createSearchButton();
  }
  // Hàm tải lại dữ liệu câu hỏi từ DB cho solver
  async function reloadQuestionsData() {
    if (!activeDocument) return;
    try {
      showToast("Đang làm mới câu hỏi...");
      const resData = await window.houQuizUtils.fetchAPI(`${window.houQuizConfig.API_URL}/questions/document/${activeDocument.id}`);
      dbQuestions = resData.questions || [];
      if (window.houQuizSearchPopup) {
        window.houQuizSearchPopup.setDbQuestions(dbQuestions);
      }
      console.log(`[HouQuiz] Reloaded ${dbQuestions.length} questions from DB.`);
      showToast(`Đã làm mới dữ liệu câu hỏi! Tổng số: ${dbQuestions.length} câu.`);
      
      let cleanCourseTitle = activeDocument.title;
      if (cleanCourseTitle.includes("-") || cleanCourseTitle.includes("–") || cleanCourseTitle.includes("—")) {
        cleanCourseTitle = cleanCourseTitle.split(/[-–—]/)[0].trim();
      }
      chrome.storage.local.get(["hou_show_info_widget"], (res) => {
        if (res.hou_show_info_widget !== false) {
          showInfoWidget(cleanCourseTitle, activeDocument.title, `Sẵn sàng (${dbQuestions.length} câu)`);
        }
      });
    } catch (err) {
      console.error("[HouQuiz] Error reloading questions:", err);
      showToast("Lỗi làm mới câu hỏi.");
    }
  }
  window.houQuizReloadQuestions = reloadQuestionsData;

  initDocument();

  // Lắng nghe thay đổi cấu hình từ popup để cập nhật UI realtime
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.hou_auto_select_docs || changes.hou_selected_doc_id || changes.hou_selected_doc_ids) {
        initDocument();
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
        if (window.houQuizSearchPopup) {
          window.houQuizSearchPopup.setApplyThemeFn(applyThemeToElement);
        }
      }
    }
  });
})();
