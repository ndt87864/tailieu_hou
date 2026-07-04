/**
 * Quiz Mode Handler - Chế độ "Làm bài ngay" cho Tailieu HOU Extension
 * UI: Giống đúng extension gốc (ảnh mẫu)
 * - Nút 🚀 LÀM BÀI NGAY (floating, right center)
 * - Popup kết quả: header gradient xanh, stats màu sắc, chi tiết câu, footer "Trang Tiếp Theo"
 * - Action popup (Làm lại / Đóng) phía dưới popup kết quả
 */
(function () {
  'use strict';

  if (window.tailieuQuizModeLoaded) return;
  window.tailieuQuizModeLoaded = true;

  // ==================== CONSTANTS ====================
  const QUIZ_BUTTON_ID = 'tailieu-quiz-btn';
  const QUIZ_RESULT_POPUP_ID = 'tailieu-quiz-result-popup';
  const QUIZ_ACTION_POPUP_ID = 'tailieu-quiz-action-popup';

  // State
  let isQuizModeActive = false;
  let lastQuizResult = null;
  let quizAutoTriggerTimer = null;

  // ==================== UTILITY ====================

  function isQuizViewPage() {
    try { return String(window.location.pathname || '').indexOf('/mod/quiz/view.php') === 0; } catch (e) { return false; }
  }
  function isQuizAttemptPage() {
    try { return String(window.location.pathname || '').indexOf('/mod/quiz/attempt.php') === 0; } catch (e) { return false; }
  }
  function isQuizReviewPage() {
    try { return String(window.location.pathname || '').indexOf('/mod/quiz/review.php') === 0; } catch (e) { return false; }
  }

  function removeQuizButton() {
    const b = document.getElementById(QUIZ_BUTTON_ID);
    if (b) b.remove();
  }

  function clearQuizAutoTriggerTimer() {
    try { if (quizAutoTriggerTimer) { clearTimeout(quizAutoTriggerTimer); quizAutoTriggerTimer = null; } } catch (e) { quizAutoTriggerTimer = null; }
  }

  function safeAppendToBody(el, cb) {
    if (document.body) { document.body.appendChild(el); if (cb) cb(); }
    else { let n = 0; const t = () => { n++; if (document.body) { document.body.appendChild(el); if (cb) cb(); } else if (n < 50) setTimeout(t, 100); }; t(); }
  }

  function truncateText(text, maxLen) {
    if (!text) return '';
    text = String(text).replace(/<[^>]+>/g, '').trim();
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
  }

  function showNotification(message, type = 'info') {
    const colors = { info: '#3b82f6', success: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
    const n = document.createElement('div');
    n.textContent = message;
    n.style.cssText = `position:fixed;top:20px;right:20px;background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:8px;z-index:1000010;font-size:14px;font-family:Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25);`;
    safeAppendToBody(n, () => setTimeout(() => { if (n.parentNode) n.remove(); }, 3000));
  }

  // ==================== INJECT STYLES ====================
  function injectStyles() {
    if (document.getElementById('tlqm-global-styles')) return;
    const style = document.createElement('style');
    style.id = 'tlqm-global-styles';
    style.textContent = `
/* === QUIZ BUTTON === */
#${QUIZ_BUTTON_ID} {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 260px;
  height: 100px;
  background: linear-gradient(135deg, rgba(248,107,14,.9) 0%, rgba(255,15,83,.9) 50%, rgba(244,102,102,.9) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 52px;
  box-shadow: 0 12px 40px rgba(196,69,105,.5), 0 8px 18px rgba(0,0,0,.14), inset 0 -6px 20px rgba(0,0,0,.14);
  cursor: pointer;
  z-index: 999998;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow .25s ease, transform .2s ease;
  border: 3px solid rgba(255,255,255,.3);
  overflow: hidden;
}
#${QUIZ_BUTTON_ID}:hover { box-shadow: 0 22px 60px rgba(196,69,105,.65); }
#${QUIZ_BUTTON_ID}::after {
  content: '';
  position: absolute;
  top: 0; left: -60%;
  width: 45%; height: 100%;
  background: linear-gradient(120deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.96) 50%, rgba(255,255,255,.06) 100%);
  transform: skewX(-20deg) translateX(-120%);
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: overlay;
}
#${QUIZ_BUTTON_ID}:hover::after { opacity: 1; animation: tlqm-sheen .9s linear forwards; }
@keyframes tlqm-sheen {
  0%   { transform: skewX(-20deg) translateX(-120%); opacity: 0; }
  8%   { opacity: .85; }
  50%  { transform: skewX(-20deg) translateX(50%);  opacity: .95; }
  100% { transform: skewX(-20deg) translateX(220%); opacity: 0; }
}
#${QUIZ_BUTTON_ID} .qbtn-content { display: flex; align-items: center; gap: 8px; color: white; }
#${QUIZ_BUTTON_ID} .qbtn-icon {
  font-size: 34px;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,.3));
  display: inline-block;
  transform-origin: center;
  animation: tlqm-rocket 2.2s ease-in-out infinite;
}
#${QUIZ_BUTTON_ID}:hover .qbtn-title { transform: translateY(-2px); }
#${QUIZ_BUTTON_ID} .qbtn-text { display: flex; flex-direction: column; align-items: center; line-height: 1.05; }
#${QUIZ_BUTTON_ID} .qbtn-title { font-size: 24px; font-weight: 800; letter-spacing: .4px; text-shadow: 0 4px 12px rgba(0,0,0,.35); transition: transform .25s ease; }
#${QUIZ_BUTTON_ID} .qbtn-subtitle { font-size: 18px; font-weight: 700; margin-top: 2px; text-shadow: 0 3px 8px rgba(0,0,0,.28); }
@keyframes tlqm-rocket { 0% { transform: translateY(0); } 30% { transform: translateY(-10px); } 60% { transform: translateY(0); } 100% { transform: translateY(0); } }
@keyframes tlqm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* === RESULT POPUP === */
#${QUIZ_RESULT_POPUP_ID} {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 550px;
  max-height: 80vh;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.3);
  z-index: 1000000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
#${QUIZ_RESULT_POPUP_ID} .qr-header {
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
#${QUIZ_RESULT_POPUP_ID} .qr-header-icon { font-size: 20px; }
#${QUIZ_RESULT_POPUP_ID} .qr-header-title { flex: 1; font-size: 16px; font-weight: 600; }
#${QUIZ_RESULT_POPUP_ID} .qr-minimize,
#${QUIZ_RESULT_POPUP_ID} .qr-close {
  background: rgba(255,255,255,.2); border: none; color: white;
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  font-size: 16px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  transition: background .2s;
}
#${QUIZ_RESULT_POPUP_ID} .qr-minimize:hover,
#${QUIZ_RESULT_POPUP_ID} .qr-close:hover { background: rgba(255,255,255,.35); }
#${QUIZ_RESULT_POPUP_ID} .qr-body { padding: 20px; overflow-y: auto; flex: 1; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; font-size: 14px;
}
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.base  { color: #374151; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.filled { background: #ECFDF5; color: #059669; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.exact  { background: #ECFDF5; color: #059669; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.fuzzy  { background: #FEF3C7; color: #D97706; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.not-found { background: #FEE2E2; color: #DC2626; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.db    { background: #E0F2FE; color: #0284C7; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-item.ai    { background: #EDE9FE; color: #7C3AED; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-icon { font-size: 14px; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-label { flex: 1; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-value { font-weight: 600; }
#${QUIZ_RESULT_POPUP_ID} .qr-stat-desc { font-size: 12px; color: #9CA3AF; margin-left: 28px; margin-bottom: 10px; }
#${QUIZ_RESULT_POPUP_ID} .qr-divider { height: 1px; background: #E5E7EB; margin: 12px 0; }
#${QUIZ_RESULT_POPUP_ID} .qr-details-header { font-weight: 600; margin-bottom: 10px; color: #374151; }
#${QUIZ_RESULT_POPUP_ID} .qr-details-list {
  max-height: 200px; overflow-y: auto;
  border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px;
}
#${QUIZ_RESULT_POPUP_ID} .qr-detail-item {
  padding: 8px 10px; border-radius: 6px; margin-bottom: 4px;
  font-size: 12px; line-height: 1.4;
}
#${QUIZ_RESULT_POPUP_ID} .qr-detail-item.matched  { background: #ECFDF5; }
#${QUIZ_RESULT_POPUP_ID} .qr-detail-item.fuzzy    { background: #FEF3C7; }
#${QUIZ_RESULT_POPUP_ID} .qr-detail-item.not-found { background: #FEE2E2; }
#${QUIZ_RESULT_POPUP_ID} .qr-detail-num   { color: #6B7280; font-weight: 600; margin-right: 4px; }
#${QUIZ_RESULT_POPUP_ID} .qr-detail-text  { color: #374151; }
#${QUIZ_RESULT_POPUP_ID} .qr-detail-answer { color: #059669; font-size: 11px; }
#${QUIZ_RESULT_POPUP_ID} .qr-footer {
  padding: 16px 20px;
  background: #F9FAFB;
  border-top: 1px solid #E5E7EB;
  flex-shrink: 0;
}
#${QUIZ_RESULT_POPUP_ID} .qr-btn-next {
  width: 100%; padding: 12px 20px;
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  color: white; border: none; border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  transition: all .2s;
}
#${QUIZ_RESULT_POPUP_ID} .qr-btn-next:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59,130,246,.4);
}

/* === ACTION POPUP (Làm lại / Đóng) === */
#${QUIZ_ACTION_POPUP_ID} {
  position: fixed;
  right: 20px;
  top: calc(50% + 62px);
  display: flex; flex-direction: row;
  justify-content: center; align-items: center;
  gap: 10px; z-index: 999997;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${QUIZ_ACTION_POPUP_ID} .qa-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; padding: 10px 20px; border-radius: 20px;
  cursor: pointer; font-size: 14px; font-weight: 700;
  transition: all .2s; box-shadow: 0 6px 18px rgba(0,0,0,.16);
  border: none; min-width: 100px;
}
#${QUIZ_ACTION_POPUP_ID} .qa-retry { background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: white; }
#${QUIZ_ACTION_POPUP_ID} .qa-retry:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(249,115,22,.4); }
#${QUIZ_ACTION_POPUP_ID} .qa-close { background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white; }
#${QUIZ_ACTION_POPUP_ID} .qa-close:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(107,114,128,.4); }
    `;
    document.head.appendChild(style);
  }

  // ==================== QUIZ BUTTON ====================

  function createQuizButton() {
    if (isQuizViewPage()) { removeQuizButton(); return null; }
    removeQuizButton();
    injectStyles();

    const btn = document.createElement('div');
    btn.id = QUIZ_BUTTON_ID;
    btn.innerHTML = `
      <div class="qbtn-content">
        <span class="qbtn-icon">🚀</span>
        <div class="qbtn-text">
          <span class="qbtn-title">LÀM BÀI</span>
          <span class="qbtn-subtitle">NGAY</span>
        </div>
      </div>
    `;

    btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-50%) scale(1.05)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateY(-50%) scale(1)'; });
    btn.addEventListener('click', async () => {
      clearQuizAutoTriggerTimer();
      btn.style.transform = 'translateY(-50%) scale(0.95)';
      setTimeout(() => { btn.style.transform = 'translateY(-50%) scale(1)'; }, 150);
      await startQuizMode();
    });

    safeAppendToBody(btn);
    return btn;
  }

  function setButtonLoading() {
    const btn = document.getElementById(QUIZ_BUTTON_ID);
    if (!btn) return;
    btn.innerHTML = `
      <div class="qbtn-content">
        <span class="qbtn-icon" style="animation:tlqm-spin 1s linear infinite;">⏳</span>
        <div class="qbtn-text">
          <span class="qbtn-title">ĐANG</span>
          <span class="qbtn-subtitle">XỬ LÝ</span>
        </div>
      </div>
    `;
  }

  function resetQuizButton() {
    const btn = document.getElementById(QUIZ_BUTTON_ID);
    if (!btn) return;
    btn.innerHTML = `
      <div class="qbtn-content">
        <span class="qbtn-icon">🚀</span>
        <div class="qbtn-text">
          <span class="qbtn-title">LÀM BÀI</span>
          <span class="qbtn-subtitle">NGAY</span>
        </div>
      </div>
    `;
  }

  // ==================== TRIGGER COMPARE ====================

  async function triggerManualCompare() {
    return new Promise((resolve) => {
      const ms = 30000;
      if (typeof window._tailieu_manualCompare === 'function') {
        window._tailieu_manualCompare({ timeoutMs: ms }).then(resolve).catch(() => resolve({ matched: [], pageQuestions: [] }));
        return;
      }
      let settled = false;
      const finish = (d) => { if (settled) return; settled = true; document.removeEventListener('tailieu-compare-result', handler); resolve(d); };
      const handler = (e) => finish(e.detail || { matched: [], pageQuestions: [] });
      document.addEventListener('tailieu-compare-result', handler);
      document.dispatchEvent(new CustomEvent('tailieu-trigger-compare'));
      setTimeout(() => finish({ matched: [], pageQuestions: [], timedOut: true }), ms);
    });
  }

  // ==================== PROCESS RESULT (tính stats từ DOM) ====================

  function buildResultFromDOM(rawResult) {
    const containers = Array.from(document.querySelectorAll('div.que, div[id^="q"]')).filter(el =>
      !!(el.querySelector('.formulation') || el.querySelector('.qtext') || el.querySelector('.ablock') || el.querySelector('.answer'))
    );

    let totalFilled = 0;
    let exactMatch = 0;
    let notFound = 0;
    const details = [];

    containers.forEach((container, idx) => {
      let qno = idx + 1;
      const qnoEl = container.querySelector('.qno');
      if (qnoEl) { const n = parseInt((qnoEl.textContent || '').replace(/\D/g, ''), 10); if (!isNaN(n)) qno = n; }

      const qTextEl = container.querySelector('.qtext, .questiontext') || container.querySelector('.formulation');
      const displayText = qTextEl ? (qTextEl.textContent || '').trim() : '';

      const hasBadge = !!container.querySelector('.tailieu-answer-badge');
      const hasHighlight = !!container.querySelector('.tailieu-correct');
      const filled = hasBadge || hasHighlight;

      let answer = '';
      if (filled) {
        const badge = container.querySelector('.tailieu-answer-badge');
        if (badge) answer = (badge.textContent || '').replace(/[✓✅]/g, '').trim();
        if (!answer && hasHighlight) {
          const corr = container.querySelector('.tailieu-correct');
          if (corr) answer = (corr.textContent || '').replace(/^[A-Za-z0-9]\s*[.):\-]\s*/u, '').trim().substring(0, 60);
        }
        totalFilled++;
        exactMatch++;
        details.push({ qno, question: truncateText(displayText, 60), answer: truncateText(answer, 40), status: 'matched', statusIcon: '✅', confidence: 1 });
      } else {
        notFound++;
        details.push({ qno, question: truncateText(displayText, 60), answer: '', status: 'not-found', statusIcon: '❌', confidence: 0 });
      }
    });

    return {
      totalPageQuestions: containers.length,
      totalFilled,
      exactMatch,
      fuzzyMatch: 0,
      notFound,
      dbAnswers: totalFilled,
      aiAnswers: 0,
      details,
    };
  }

  // ==================== RESULT POPUP ====================

  function createResultPopup(result) {
    const existing = document.getElementById(QUIZ_RESULT_POPUP_ID);
    if (existing) existing.remove();
    injectStyles();

    const { totalPageQuestions, totalFilled, exactMatch, fuzzyMatch, notFound, dbAnswers, aiAnswers, details } = result;

    const popup = document.createElement('div');
    popup.id = QUIZ_RESULT_POPUP_ID;

    popup.innerHTML = `
      <div class="qr-header">
        <span class="qr-header-icon">📊</span>
        <span class="qr-header-title">Kết quả điền đáp án</span>
        <button class="qr-minimize" title="Thu nhỏ">—</button>
        <button class="qr-close" title="Đóng">×</button>
      </div>
      <div class="qr-body">
        <div class="qr-summary">
          <div class="qr-stat-item base">
            <span class="qr-stat-label">Tổng số câu hỏi:</span>
            <span class="qr-stat-value">${totalPageQuestions}</span>
          </div>
          <div class="qr-stat-item filled">
            <span class="qr-stat-icon">✅</span>
            <span class="qr-stat-label">Đã điền:</span>
            <span class="qr-stat-value">${totalFilled} câu</span>
          </div>
          <div class="qr-stat-item exact">
            <span class="qr-stat-icon">🎯</span>
            <span class="qr-stat-label">Khớp chính xác 100%:</span>
            <span class="qr-stat-value">${exactMatch} câu</span>
          </div>
          <div class="qr-stat-item fuzzy">
            <span class="qr-stat-icon">⚠️</span>
            <span class="qr-stat-label">Khớp fuzzy 99.5%:</span>
            <span class="qr-stat-value">${fuzzyMatch} câu</span>
          </div>
          <div class="qr-stat-desc">Vui lòng kiểm tra lại các câu này!</div>
          <div class="qr-stat-item not-found">
            <span class="qr-stat-icon">❌</span>
            <span class="qr-stat-label">Không tìm thấy:</span>
            <span class="qr-stat-value">${notFound} câu</span>
          </div>
          <div class="qr-divider"></div>
          <div class="qr-stat-item db">
            <span class="qr-stat-icon">🗄️</span>
            <span class="qr-stat-label">Đáp án từ Dữ liệu (DB/Cached):</span>
            <span class="qr-stat-value">${dbAnswers} câu</span>
          </div>
          <div class="qr-stat-item ai">
            <span class="qr-stat-icon">🤖</span>
            <span class="qr-stat-label">Đáp án từ AI (Mới):</span>
            <span class="qr-stat-value">${aiAnswers || 0} câu</span>
          </div>
        </div>
        <div class="qr-result-details">
          <div class="qr-details-header">Chi tiết:</div>
          <div class="qr-details-list">
            ${(details || []).map((d, idx) => `
              <div class="qr-detail-item ${d.status}">
                <span class="qr-stat-icon">${d.statusIcon}</span>
                <span class="qr-detail-num">Câu ${idx + 1}:</span>
                <span class="qr-detail-text">${d.question}</span>
                ${d.answer ? `<br><span class="qr-detail-answer">→ ${d.answer}${d.confidence ? ` (${(d.confidence * 100).toFixed(1)}%)` : ''}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="qr-footer">
        <button class="qr-btn-next">Trang Tiếp Theo →</button>
      </div>
    `;

    // Events
    popup.querySelector('.qr-close').addEventListener('click', () => { popup.remove(); removeActionPopup(); });
    popup.querySelector('.qr-minimize').addEventListener('click', () => { popup.remove(); });
    popup.querySelector('.qr-btn-next').addEventListener('click', () => {
      const next = document.querySelector('.mod_quiz-next-nav, [rel="next"], .nextpage a, input[name="next"]');
      if (next) { if (next.tagName === 'INPUT' || next.tagName === 'BUTTON') next.click(); else window.location.href = next.href; }
      else showNotification('Không tìm thấy nút trang tiếp theo.', 'warning');
    });

    safeAppendToBody(popup);
    return popup;
  }

  // ==================== ACTION POPUP ====================

  function removeActionPopup() {
    const e = document.getElementById(QUIZ_ACTION_POPUP_ID);
    if (e) e.remove();
  }

  function createActionPopup() {
    removeActionPopup();
    injectStyles();

    const popup = document.createElement('div');
    popup.id = QUIZ_ACTION_POPUP_ID;
    popup.innerHTML = `
      <div class="qa-btn qa-retry"><span>🔄</span><span>Làm lại</span></div>
      <div class="qa-btn qa-close"><span>✕</span><span>Đóng</span></div>
    `;

    popup.querySelector('.qa-retry').addEventListener('click', () => {
      popup.remove();
      const rp = document.getElementById(QUIZ_RESULT_POPUP_ID);
      if (rp) rp.remove();
      createQuizButton();
    });
    popup.querySelector('.qa-close').addEventListener('click', () => {
      popup.remove();
      const rp = document.getElementById(QUIZ_RESULT_POPUP_ID);
      if (rp) rp.remove();
    });

    safeAppendToBody(popup);
    return popup;
  }

  // ==================== MAIN FLOW ====================

  async function startQuizMode() {
    if (window._tailieuQuizModeProcessing) return;
    isQuizModeActive = true;
    window._tailieuQuizModeProcessing = true;
    clearQuizAutoTriggerTimer();
    setButtonLoading();

    try {
      const raw = await triggerManualCompare();

      if (raw && raw.timedOut) { showNotification('Hết thời gian chờ, vui lòng thử lại.', 'warning'); resetQuizButton(); return; }
      if (raw && raw.error) { showNotification('Lỗi khi so sánh: ' + raw.error, 'error'); resetQuizButton(); return; }

      const result = buildResultFromDOM(raw || {});
      lastQuizResult = result;

      createResultPopup(result);
      createActionPopup();
      resetQuizButton();
    } catch (err) {
      console.error('[QuizMode]', err);
      showNotification('Có lỗi: ' + (err && err.message ? err.message : String(err)), 'error');
      resetQuizButton();
    } finally {
      window._tailieuQuizModeProcessing = false;
      isQuizModeActive = false;
    }
  }

  // ==================== INIT ====================

  function initializeQuizMode() {
    if (isQuizAttemptPage() || isQuizReviewPage()) {
      injectStyles();
      createQuizButton();
    }

    window.tailieuQuizMode = {
      start: startQuizMode,
      isActive: () => isQuizModeActive,
      isEnabled: () => true,
      showResult: createResultPopup,
    };
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeQuizMode();
  } else {
    document.addEventListener('DOMContentLoaded', initializeQuizMode);
  }
})();
