(function () {
  "use strict";

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

  function getElementTextWithImages(element, collectImgsArray = null) {
    if (!element) return "";
    const clonedEl = element.cloneNode(true);
    clonedEl.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src");
      if (src && !src.includes("grade_correct") && !src.includes("grade_incorrect") && !src.includes("grade_")) {
        if (src.startsWith("data:")) {
          img.replaceWith(document.createTextNode(' "image_data" '));
        } else {
          img.replaceWith(document.createTextNode(` "${src}" `));
          if (collectImgsArray && !collectImgsArray.includes(src)) {
            collectImgsArray.push(src);
          }
        }
      } else {
        img.remove();
      }
    });
    return clonedEl.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
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

        const qimgs = Array.from(qtextEl.querySelectorAll("img"));
        const rawQuestionImageUrl = qimgs.length > 0
          ? qimgs.map(img => img.getAttribute("src")).filter(src => src && !src.includes("grade_")).join(",")
          : null;
        let rawAnswerImageUrl = null;

        const clonedQtext = qtextEl.cloneNode(true);
        clonedQtext.querySelectorAll("script, style, .answer, label, .prompt, .accesshide").forEach(el => el.remove());
        clonedQtext.querySelectorAll("img").forEach(img => {
          const src = img.getAttribute("src");
          if (src) {
            img.replaceWith(document.createTextNode(` "${src}" `));
          } else {
            img.remove();
          }
        });
        let questionText = clonedQtext.textContent.replace(/\s+/g, " ").trim();
        questionText = questionText.replace(/^mô tả câu hỏi/i, "").trim();
        questionText = questionText.replace(/^câu hỏi \d+\s*chưa trả lời/i, "").trim();
        questionText = questionText.replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+/i, "").trim();

        if (utils && typeof utils.cleanQuestionContent === "function") {
          questionText = utils.cleanQuestionContent(questionText, qtextEl);
        }

        // Loại trừ các thẻ input ẩn (hidden) thường dùng để check trạng thái Moodle
        const inputElements = Array.from(container.querySelectorAll('input[type="text"], input:not([type]), textarea, select'));
        const isFillBlank = inputElements.length > 0;

        if (isFillBlank) {
          let parsedRightAnswers = [];
          const rightAnswerEl = container.querySelector(".outcome .rightanswer, .rightanswer");
          if (rightAnswerEl) {
            const aimgs = Array.from(rightAnswerEl.querySelectorAll("img"));
            rawAnswerImageUrl = aimgs.length > 0
              ? aimgs.map(img => img.getAttribute("src")).filter(src => src && !src.includes("grade_")).join(",")
              : null;
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
            subQs.forEach((subQ) => {
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
                  isChecked: true,
                  rawQuestionImageUrl,
                  rawAnswerImageUrl
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
                isChecked: true,
                rawQuestionImageUrl,
                rawAnswerImageUrl
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
          /\b[a-fA-F][\.\)]\s*$/i
        ];
        instructions.forEach(regex => {
          questionText = questionText.replace(regex, "").trim();
        });

        const optIndex = questionText.search(/\b[aA][\.\)]\s+/);
        if (optIndex !== -1 && optIndex > 10) {
          questionText = questionText.substring(0, optIndex).trim();
        }

        if (!questionText || questionText.length < 2) return;

        const answerContainer = container.querySelector(".answer");
        let choices = [];
        let optionElements = [];
        const choiceImgs = [];
        if (answerContainer) {
          optionElements = Array.from(answerContainer.querySelectorAll(".r0, .r1, label, .flex-fill, div[role='option']"));
          optionElements = optionElements.filter(el => !optionElements.some(otherEl => otherEl !== el && el.contains(otherEl)));
          choices = optionElements.map(el => {
            return getElementTextWithImages(el, choiceImgs);
          }).filter(Boolean);
        }
        const rawChoicesImageUrl = choiceImgs.length > 0 ? choiceImgs.join(",") : null;

        let rightAnswerText = "";
        const ansImgs = [];
        const rightAnswerEl = container.querySelector(".outcome .rightanswer, .rightanswer");
        if (rightAnswerEl) {
          rightAnswerText = getElementTextWithImages(rightAnswerEl, ansImgs);
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
            let hasCorrectIcon = false;
            if (correctnessIcon) {
              const alt = (correctnessIcon.getAttribute("alt") || "").toLowerCase();
              const title = (correctnessIcon.getAttribute("title") || "").toLowerCase();
              const src = (correctnessIcon.getAttribute("src") || "").toLowerCase();
              
              const isCorrectText = (text) => {
                if (!text) return false;
                if (text.includes("không") || text.includes("incorrect")) return false;
                return text.includes("đúng") || text.includes("correct");
              };
              
              hasCorrectIcon = isCorrectText(alt) || isCorrectText(title) || src.includes("grade_correct");
            }
            
            const textContent = el.textContent || "";
            const hasTickChar = /[✓✔✅]/.test(textContent);

            return hasCorrectClass || hasCorrectIcon || hasTickChar;
          });

          if (correctOptionEl) {
            const labelEl = correctOptionEl.querySelector("label") || correctOptionEl;
            rightAnswerText = getElementTextWithImages(labelEl, ansImgs);
          }
        }

        rawAnswerImageUrl = ansImgs.length > 0 ? ansImgs.join(",") : null;

        if (!rightAnswerText) {
          const icons = Array.from(container.querySelectorAll('.questioncorrectnessicon, img[src*="grade_"]'));
          const correctIconInContainer = icons.find(icon => {
            const alt = (icon.getAttribute("alt") || "").toLowerCase();
            const title = (icon.getAttribute("title") || "").toLowerCase();
            const src = (icon.getAttribute("src") || "").toLowerCase();
            
            const isCorrectText = (text) => {
              if (!text) return false;
              if (text.includes("không") || text.includes("incorrect")) return false;
              return text.includes("đúng") || text.includes("correct");
            };
            
            return isCorrectText(alt) || isCorrectText(title) || src.includes("grade_correct");
          });

          if (correctIconInContainer) {
            const parentRow = correctIconInContainer.closest("label, li, .r0, .r1, .correct");
            if (parentRow) {
              const labelEl = parentRow.querySelector("label") || parentRow;
              rightAnswerText = getElementTextWithImages(labelEl, ansImgs);
              if (!rawAnswerImageUrl) {
                rawAnswerImageUrl = ansImgs.join(",");
              }
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
          isChecked: true,
          rawQuestionImageUrl,
          rawAnswerImageUrl,
          rawChoicesImageUrl
        });
      } catch (e) {
        console.error("[HouQuiz Scanner] Lỗi khi quét câu hỏi:", e);
      }
    });

    return results;
  }

  // Export functions to global scope
  window.houQuizScannerCore = {
    isInputCorrect,
    getElementTextWithImages,
    extractSingleFillBlankRow,
    scanReviewQuestions
  };
})();
