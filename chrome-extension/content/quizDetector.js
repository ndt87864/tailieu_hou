// src/content/quizDetector.js
// Parse cau hoi + choices tu trang Moodle quiz (attempt/review) EHOU/NEU/lmshub.
(function () {
  'use strict';

  if (window.tailieuQuizDetector) return;

  const OPTION_SELECTOR =
    "label, div[data-region='answer-label'], .flex-fill, li, [role='option'], button[role='option']";
  const INPUT_SELECTOR = 'input[type="radio"], input[type="checkbox"]';

  function getConcatenatedText(el) {
    if (!el) return '';
    // Tra ve textContent, giu ngat dong de match anh separably
    return (el.textContent || '').trim();
  }

  // detect day la trang review (co dap an dung hien san)
  function isReviewPage() {
    return !!document.querySelector('.rightanswer, .specificfeedback, .feedback');
  }

  function pageType() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.includes('review.php')) return 'review';
    if (p.includes('attempt.php')) return 'attempt';
    return 'quiz';
  }

  // Parse tat ca .que -> [{el, index, question, choices[], choiceEls[], hasAnswered}]
  function parseQuestions() {
    const allQues = document.querySelectorAll('.que');
    if (!allQues || allQues.length === 0) return [];
    const out = [];
    allQues.forEach((queEl, idx) => {
      const qTextEl = queEl.querySelector('.qtext, .questiontext, .formulation .qtext');
      if (!qTextEl) return;
      const questionText = getConcatenatedText(qTextEl);
      if (!questionText) return;

      const answerContainer = queEl.querySelector('.ablock .answer, .answer');
      const choices = [];
      const choiceEls = [];
      if (answerContainer) {
        const seen = new Set();
        answerContainer.querySelectorAll(OPTION_SELECTOR).forEach((optionEl) => {
          let txt = (optionEl.textContent || '').trim();
          // Bo prefix "a. ", "1) "
          txt = txt.replace(/^\s*[A-Za-z0-9]\s*[.)\-:]\s*/u, '').trim();
          if (!txt) return;
          const key = txt.toLowerCase().replace(/\s+/g, ' ').trim();
          if (seen.has(key)) return;
          seen.add(key);
          choices.push(txt);
          choiceEls.push(optionEl);
        });
      }

      const inputs = queEl.querySelectorAll(INPUT_SELECTOR);
      const hasAnswered = Array.from(inputs).some((i) => i.checked);

      out.push({
        el: queEl,
        index: idx + 1,
        question: questionText,
        choices,
        choiceEls,
        inputs: Array.from(inputs),
        hasAnswered,
      });
    });
    return out;
  }

  // Tim choice element chua text gan nhat (normalize). Tra {el, idx, score}.
  function findChoiceByAnswer(pageChoices, answerText) {
    if (!answerText) return null;
    const ans = String(answerText).trim();
    let best = null;
    pageChoices.forEach((c, idx) => {
      const opt = String(c).trim();
      let score = 0;
      if (opt === ans) score = 100;
      else {
        const normOpt = opt.toLowerCase().replace(/\s+/g, ' ').trim();
        const normAns = ans.toLowerCase().replace(/\s+/g, ' ').trim();
        if (normOpt === normAns) score = 95;
        else if (normOpt && normAns && (normOpt.includes(normAns) || normAns.includes(normOpt))) score = 80;
      }
      if (score > 0 && (!best || score > best.score)) best = { idx, score };
    });
    return best;
  }

  window.tailieuQuizDetector = {
    parseQuestions,
    isReviewPage,
    pageType,
    findChoiceByAnswer,
    OPTION_SELECTOR,
    INPUT_SELECTOR,
  };
})();
