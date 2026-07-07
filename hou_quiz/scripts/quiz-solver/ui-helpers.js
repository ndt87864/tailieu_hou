(function () {
  "use strict";

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
      const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      el.classList.toggle("dark", isDark);
    });
  }

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

  function highlightTextInOption(optEl, mode = 'bg') {
    const mainClass = mode === 'text' ? 'hou-highlight-option-text' : 'hou-highlight-option';
    if (optEl.querySelector(`.${mainClass}`) || optEl.classList.contains(mainClass)) {
      return;
    }

    const ignoreSelectors = ".feedbackspan, .icon, i, input, .accesshide, .feedback, img, .correct, .incorrect, .checkmark, .fa";
    const nodesToMove = [];
    
    Array.from(optEl.childNodes).forEach(node => {
      if (node.nodeType === 1) {
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
          <span class="widget-value widget-value-success">${statusText}</span>
        </div>
      `;
    });
  }

  function extractFillBlankSubQuestions(queContainer) {
    const subQuestions = [];
    const seenTexts = new Set();
    const inputs = Array.from(queContainer.querySelectorAll('input[type="text"], input:not([type]), textarea, select'));
    if (inputs.length === 0) return [];

    const containerMap = new Map();

    inputs.forEach(input => {
      let container = input.closest('tr');
      if (!container) {
        container = input.closest('li');
      }
      if (!container) {
        container = input.closest('p');
      }
      if (!container) {
        container = input.closest('div');
      }
      if (!container || container === queContainer || !queContainer.contains(container)) {
        container = input.parentElement;
      }
      
      if (container) {
        if (!containerMap.has(container)) {
          containerMap.set(container, []);
        }
        containerMap.get(container).push(input);
      }
    });

    function extractTextWithInputs(el, inputElements) {
      const cloned = el.cloneNode(true);
      cloned.querySelectorAll('input[type="text"], input:not([type]), textarea, select').forEach(input => {
        const placeholder = document.createTextNode(" ... ");
        input.replaceWith(placeholder);
      });
      cloned.querySelectorAll(".feedback, .feedbackspan, .accesshide, .questioncorrectnessicon").forEach(e => e.remove());
      
      let text = cloned.textContent.replace(/\s+/g, " ").trim();
      text = text.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, "").trim();
      
      return {
        text: text,
        inputElements: inputElements
      };
    }

    containerMap.forEach((inputElements, element) => {
      const res = extractTextWithInputs(element, inputElements);
      if (res && res.text.length > 1) {
        const norm = res.text.toLowerCase().replace(/\s+/g, " ").trim();
        if (!seenTexts.has(norm)) {
          seenTexts.add(norm);
          subQuestions.push({
            element: element,
            text: res.text,
            inputElements: res.inputElements
          });
        }
      }
    });

    const filteredSubQuestions = subQuestions.filter(sqA => {
      return !subQuestions.some(sqB => sqB !== sqA && sqA.element.contains(sqB.element));
    });

    return filteredSubQuestions;
  }

  function scanQuestionsOnPage() {
    const pageQuestions = [];
    const questionContainers = document.querySelectorAll(".que, div.question, .question-container");

    questionContainers.forEach((container, idx) => {
      const qtextEl = container.querySelector(".qtext, .questiontext") || container.querySelector(".formulation");
      if (!qtextEl) return;

      // Chỉ nhận diện điền từ khi có các ô nhập liệu dạng text hiển thị hoặc textarea
      const inputElements = Array.from(container.querySelectorAll('input[type="text"], input:not([type]), textarea'));
      const isFillBlank = inputElements.length > 0;

      const clonedQtext = qtextEl.cloneNode(true);
      clonedQtext.querySelectorAll("script, style, .answer, label, .prompt, .accesshide").forEach(el => el.remove());
      clonedQtext.querySelectorAll("img").forEach(img => {
        const src = img.getAttribute("src");
        if (src) {
          if (src.startsWith("data:")) {
            img.replaceWith(document.createTextNode(' "image_data" '));
          } else {
            img.replaceWith(document.createTextNode(` "${src}" `));
          }
        } else {
          img.remove();
        }
      });
      
      let questionText = clonedQtext.textContent.replace(/\s+/g, " ").trim();
      questionText = questionText.replace(/^mô tả câu hỏi/i, "").trim();
      questionText = questionText.replace(/^câu hỏi \d+\s*chưa trả lời/i, "").trim();
      questionText = questionText.replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+/i, "").trim();
      
      if (window.houQuizUtils && typeof window.houQuizUtils.cleanQuestionContent === "function") {
        questionText = window.houQuizUtils.cleanQuestionContent(questionText, qtextEl);
      }
      
      const instructions = [/chọn một câu trả lời:?/i, /chọn một:?/i, /chọn câu trả lời:?/i, /chọn đáp án:?/i, /trả lời câu hỏi:?/i, /\b[a-fA-F][\.\)]\s*$/i];
      instructions.forEach(regex => { questionText = questionText.replace(regex, "").trim(); });
      
      const optIndex = questionText.search(/\b[aA][\.\)]\s+/);
      if (optIndex !== -1 && optIndex > 10) questionText = questionText.substring(0, optIndex).trim();

      if (isFillBlank) {
        pageQuestions.push({
          id: idx,
          container: container,
          element: qtextEl,
          text: questionText,
          type: "fill_blank",
          inputElements: inputElements
        });
        return;
      }

      const answerContainer = container.querySelector(".answer");
      if (!answerContainer) return;

      let optionElements = Array.from(answerContainer.querySelectorAll("label, .flex-fill, div[role='option']"));
      optionElements = optionElements.filter(el => !optionElements.some(otherEl => otherEl !== el && el.contains(otherEl)));
      const options = optionElements.map(el => {
        const clonedEl = el.cloneNode(true);
        clonedEl.querySelectorAll("img").forEach(img => {
          const src = img.getAttribute("src");
          if (src && !src.includes("grade_correct") && !src.includes("grade_incorrect")) {
            img.replaceWith(document.createTextNode(` "${src}" `));
          } else {
            img.remove();
          }
        });
        return clonedEl.textContent.replace(/\s+/g, " ").replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
      }).filter(Boolean);

      pageQuestions.push({
        id: idx,
        container: container,
        element: qtextEl,
        text: questionText,
        type: "multiple_choice",
        optionElements: optionElements,
        options: options
      });
    });

    return pageQuestions;
  }

  function showFillBlankHint(inputEl, answerText, highlightAnswersEnabled) {
    if (!inputEl || !answerText) return;
    
    const parent = inputEl.parentElement;
    let existingHint = null;
    if (inputEl.id) {
      existingHint = parent.querySelector(`.hou-fill-blank-hint[data-input-id="${inputEl.id}"]`);
    }
    if (!existingHint && inputEl.nextElementSibling?.classList.contains("hou-fill-blank-hint")) {
      existingHint = inputEl.nextElementSibling;
    }

    if (existingHint) {
      existingHint.remove();
    }

    const hintSpan = document.createElement("span");
    hintSpan.className = "hou-fill-blank-hint";
    if (inputEl.id) {
      hintSpan.setAttribute("data-input-id", inputEl.id);
    }
    hintSpan.textContent = `(Đáp án: ${answerText})`;
    
    if (highlightAnswersEnabled) {
      hintSpan.classList.add("has-bg");
    } else {
      hintSpan.classList.add("no-bg");
    }

    inputEl.after(hintSpan);
  }

  window.houQuizUI = {
    LUCIDE_ICONS,
    applyThemeToElement,
    showToast,
    highlightTextInOption,
    truncateText,
    simulateFullClick,
    navigateToNextPage,
    showInfoWidget,
    extractFillBlankSubQuestions,
    scanQuestionsOnPage,
    showFillBlankHint
  };
})();
