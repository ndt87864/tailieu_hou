// src/content/highlighter.js
// To dap an dung + badge + floating button. No inline styles (CSS o content.css).
(function () {
  'use strict';

  if (window.tailieuHighlighter) return;

  const MARK_ATTR = 'data-tailieu-marked';
  const BADGE_CLASS = 'tailieu-answer-badge';

  // Xoa toan bo marking cu
  function clearMarks() {
    document.querySelectorAll('.tailieu-correct, .tailieu-incorrect, .tailieu-neutral').forEach((el) => {
      el.classList.remove('tailieu-correct', 'tailieu-incorrect', 'tailieu-neutral');
    });
    document.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());
    document.querySelectorAll('[' + MARK_ATTR + ']').forEach((el) => el.removeAttribute(MARK_ATTR));
  }

  // Tao badge element
  function makeBadge(text, kind) {
    const b = document.createElement('span');
    b.className = BADGE_CLASS + (kind ? ' tailieu-badge-' + kind : '');
    b.textContent = text;
    return b;
  }

  // To dap an dung vao 1 .que may.
  function highlightQuestion(parsedQ, matchedRow) {
    if (!parsedQ || !parsedQ.el) return { ok: false };
    const queEl = parsedQ.el;

    if (!matchedRow || !matchedRow.row || !matchedRow.matched) {
      // Khong match: badge neutral
      const info = queEl.querySelector('.qtext, .questiontext') || queEl;
      if (info.getAttribute(MARK_ATTR)) return { ok: true, status: 'already' };
      info.setAttribute(MARK_ATTR, '1');
      info.appendChild(makeBadge('chưa có đáp án', 'neutral'));
      return { ok: true, status: 'no-match' };
    }

    const db = matchedRow.row;
    const info = queEl.querySelector('.qtext, .questiontext') || queEl;
    info.setAttribute(MARK_ATTR, '1');

    // Neu la multi-choice: to choice trung khop
    if (parsedQ.choices && parsedQ.choices.length > 0) {
      const ansText = String(db.answer || '').trim();
      const best = window.tailieuQuizDetector
        ? window.tailieuQuizDetector.findChoiceByAnswer(parsedQ.choices, ansText)
        : null;
      if (best && parsedQ.choiceEls && parsedQ.choiceEls[best.idx]) {
        const target = parsedQ.choiceEls[best.idx];
        target.classList.add('tailieu-correct');
        // tick input neu o attempt page va chua duoc tick
        if (!parsedQ.hasAnswered) {
          const inp = target.querySelector('input');
          if (inp && !inp.checked) inp.checked = true;
        }
        info.appendChild(makeBadge('✓', 'correct'));
        return { ok: true, status: 'highlighted', score: matchedRow.score };
      }
    }

    // Single / text answer: badge text thay the
    const ansText = String(db.answer || '').trim();
    if (ansText) {
      info.appendChild(makeBadge(ansText, 'correct'));
      return { ok: true, status: 'badge', score: matchedRow.score };
    }

    info.appendChild(makeBadge('?', 'neutral'));
    return { ok: true, status: 'no-answer' };
  }

  // To hang loat
  function highlightAll(parsedQuestions, matchMap) {
    let count = 0;
    let matched = 0;
    parsedQuestions.forEach((q) => {
      const m = matchMap[q.question] || { matched: false };
      const res = highlightQuestion(q, m);
      count++;
      if (res.status === 'highlighted' || res.status === 'badge') matched++;
    });
    return { total: count, matched };
  }

  // Floating button
  let _btn = null;
  function ensureFloatingButton(onClick) {
    if (_btn && document.body.contains(_btn)) return _btn;
    const btn = document.createElement('button');
    btn.id = 'tailieu-floating-btn';
    btn.type = 'button';
    btn.title = 'Tailieu HOU';
    btn.textContent = 'T';
    btn.addEventListener('click', () => { try { onClick && onClick(); } catch (e) {} });
    document.body.appendChild(btn);
    _btn = btn;
    return btn;
  }
  function removeFloatingButton() {
    if (_btn) { _btn.remove(); _btn = null; }
  }

  window.tailieuHighlighter = {
    clearMarks,
    highlightQuestion,
    highlightAll,
    ensureFloatingButton,
    removeFloatingButton,
    MARK_ATTR,
  };
})();
