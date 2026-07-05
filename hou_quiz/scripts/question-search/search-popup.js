(function () {
  "use strict";

  const SEARCH_BTN_ID = "hou-quiz-search-btn";
  const SEARCH_POPUP_ID = "hou-quiz-search-popup";
  const QUIZ_MINIMIZED_ID = "hou-quiz-minimized";

  const LUCIDE_ICONS = {
    search: `<svg class="lucide-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    x: `<svg class="lucide-icon" viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  let dbQuestions = [];
  let applyThemeFn = null;

  function setDbQuestions(questions) {
    dbQuestions = questions || [];
  }

  function setApplyThemeFn(fn) {
    applyThemeFn = fn;
    const btn = document.getElementById(SEARCH_BTN_ID);
    const popup = document.getElementById(SEARCH_POPUP_ID);
    if (applyThemeFn) {
      if (btn) applyThemeFn(btn);
      if (popup) applyThemeFn(popup);
    }
  }

  function updateSearchBtnPosition() {
    const searchBtn = document.getElementById(SEARCH_BTN_ID);
    const searchPopup = document.getElementById(SEARCH_POPUP_ID);
    const hasMinimized = !!document.getElementById(QUIZ_MINIMIZED_ID);

    if (searchBtn) {
      searchBtn.classList.toggle("has-minimized", hasMinimized);
    }
    if (searchPopup) {
      searchPopup.classList.toggle("has-minimized", hasMinimized);
    }
  }

  function performSearch(questionQuery, optionQuery) {
    const utils = window.houQuizUtils;
    if (!questionQuery.trim()) {
      return { status: "empty", message: "Vui lòng nhập nội dung câu hỏi." };
    }

    const cleanQuery = utils.normalizeTextForMatching(questionQuery);
    const hasOptQuery = optionQuery && optionQuery.trim();
    const cleanOptQuery = hasOptQuery ? utils.normalizeTextForMatching(optionQuery) : "";

    let candidates = dbQuestions.map(dbQ => {
      const cleanDbQ = utils.normalizeTextForMatching(dbQ.question);
      const qSimilarity = utils.getSimilarityScore(cleanQuery, cleanDbQ);
      
      let optSimilarity = null;
      const dbChoices = Array.isArray(dbQ.choices) ? dbQ.choices : [];

      if (hasOptQuery) {
        if (dbChoices.length > 0) {
          let maxOptSim = 0;
          dbChoices.forEach(choice => {
            const sim = utils.getSimilarityScore(cleanOptQuery, utils.normalizeTextForMatching(choice));
            if (sim > maxOptSim) maxOptSim = sim;
          });
          const answerSim = utils.getSimilarityScore(cleanOptQuery, utils.normalizeTextForMatching(dbQ.answer));
          if (answerSim > maxOptSim) maxOptSim = answerSim;
          optSimilarity = maxOptSim;
        }
      }

      return { dbQ, qSimilarity, optSimilarity };
    });

    candidates = candidates.filter(c => {
      if (c.qSimilarity <= 0.3) return false;
      if (hasOptQuery && c.optSimilarity !== null && c.optSimilarity <= 0.3) return false;
      return true;
    });

    candidates.sort((a, b) => {
      if (Math.abs(b.qSimilarity - a.qSimilarity) > 0.05) {
        return b.qSimilarity - a.qSimilarity;
      }
      if (a.optSimilarity !== null && b.optSimilarity !== null) {
        return b.optSimilarity - a.optSimilarity;
      }
      return b.qSimilarity - a.qSimilarity;
    });

    if (candidates.length === 0) {
      return { status: "not-found", message: "Không tìm thấy câu hỏi phù hợp trong CSDL." };
    }

    const topMatches = candidates.slice(0, 5).map(c => ({
      question: c.dbQ.question,
      choices: Array.isArray(c.dbQ.choices) ? c.dbQ.choices : [],
      answer: c.dbQ.answer,
      qSimilarity: c.qSimilarity,
      optSimilarity: c.optSimilarity
    }));

    return {
      status: "success",
      matches: topMatches
    };
  }

  function showSearchResults(resultBox, searchRes) {
    if (searchRes.status === "empty" || searchRes.status === "not-found") {
      resultBox.innerHTML = `<div class="search-result-empty">${searchRes.message}</div>`;
      return;
    }

    const utils = window.houQuizUtils;
    let html = "";

    searchRes.matches.forEach((match, mIdx) => {
      const cleanAnswer = String(match.answer || "").trim();
      let choicesHtml = "";

      if (match.choices.length > 0) {
        choicesHtml = `<div class="search-res-choices">`;
        match.choices.forEach((choice, idx) => {
          const cleanChoice = utils.normalizeTextForMatching(choice);
          const isCorrectText = utils.compareNormalized(cleanChoice, cleanAnswer);
          const alphabet = ["a", "b", "c", "d", "e", "f"];
          const isCorrectIndex = alphabet[idx] === cleanAnswer.toLowerCase();
          const isCorrect = isCorrectText || isCorrectIndex;

          const correctClass = isCorrect ? "correct-choice" : "";
          choicesHtml += `
            <div class="search-res-choice-item ${correctClass}">
              ${alphabet[idx].toUpperCase()}. ${choice}
            </div>
          `;
        });
        choicesHtml += `</div>`;
      }

      const borderStyle = mIdx > 0 ? "border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 12px;" : "";

      let scoreHtml = `Khớp câu: ${(match.qSimilarity * 100).toFixed(0)}%`;
      if (match.optSimilarity !== null) {
        scoreHtml += `<br/>Lựa chọn: ${(match.optSimilarity * 100).toFixed(0)}%`;
      }

      html += `
        <div class="search-result-item" style="${borderStyle}">
          <div class="search-res-question" style="display:flex; justify-content:space-between; gap:10px; align-items: flex-start;">
            <span>Câu ${mIdx + 1}: ${match.question}</span>
            <span style="font-size:11px; color:var(--muted); font-weight:normal; flex-shrink:0; text-align:right;">${scoreHtml}</span>
          </div>
          ${choicesHtml}
          <div class="search-res-answer">Đáp án đúng: ${match.answer}</div>
        </div>
      `;
    });

    resultBox.innerHTML = html;
  }

  function createSearchPopup() {
    const existing = document.getElementById(SEARCH_POPUP_ID);
    if (existing) {
      existing.remove();
      return;
    }

    const popup = document.createElement("div");
    popup.id = SEARCH_POPUP_ID;
    if (applyThemeFn) applyThemeFn(popup);

    popup.innerHTML = `
      <div class="search-header">
        <div class="search-header-title">${LUCIDE_ICONS.search} Tra cứu câu hỏi nhanh</div>
        <button class="search-header-close" title="Đóng">${LUCIDE_ICONS.x}</button>
      </div>
      <div class="search-body">
        <div class="search-field">
          <label class="search-label">Nội dung câu hỏi</label>
          <textarea class="search-input q-input" placeholder="Nhập câu hỏi cần tìm..."></textarea>
        </div>
        <div class="search-field">
          <label class="search-label">Một trong các lựa chọn (nếu muốn lọc thêm)</label>
          <input type="text" class="search-input opt-input" placeholder="Ví dụ: 18 tuổi, 4 chủ thể..."/>
        </div>
        <button class="search-btn">${LUCIDE_ICONS.search} Tìm kiếm</button>
        <div class="search-result-box">
          <div class="search-result-empty">Nhập thông tin câu hỏi và nhấn Tìm kiếm.</div>
        </div>
      </div>
    `;

    popup.querySelector(".search-header-close").addEventListener("click", () => {
      popup.remove();
    });

    const qInput = popup.querySelector(".q-input");
    const optInput = popup.querySelector(".opt-input");
    const searchBtn = popup.querySelector(".search-btn");
    const resultBox = popup.querySelector(".search-result-box");

    const doSearch = () => {
      showSearchResults(resultBox, performSearch(qInput.value, optInput.value));
    };

    searchBtn.addEventListener("click", doSearch);

    qInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSearch();
      }
    });
    optInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSearch();
      }
    });

    document.body.appendChild(popup);
    updateSearchBtnPosition();
    qInput.focus();
  }

  function createSearchButton() {
    const existing = document.getElementById(SEARCH_BTN_ID);
    if (existing) existing.remove();

    const btn = document.createElement("div");
    btn.id = SEARCH_BTN_ID;
    btn.title = "Tra cứu câu hỏi nhanh";
    btn.innerHTML = LUCIDE_ICONS.search;
    if (applyThemeFn) applyThemeFn(btn);

    btn.addEventListener("click", () => {
      createSearchPopup();
    });

    document.body.appendChild(btn);
    updateSearchBtnPosition();

    const observer = new MutationObserver(() => {
      updateSearchBtnPosition();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.houQuizSearchPopup = {
    setDbQuestions,
    setApplyThemeFn,
    createSearchButton
  };
})();
