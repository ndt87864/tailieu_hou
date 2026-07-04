// src/content/content.js
// Entry content script: detect quiz -> detect course -> tai dap an -> match -> highlight + panel.
(function () {
  'use strict';

  if (window.tailieuContentLoaded) return;
  window.tailieuContentLoaded = true;

  const T = window.tailieuTextUtils || {};
  const detector = window.tailieuQuizDetector;
  const course = window.tailieuCourseDetector;
  const matcher = window.tailieuMatcher;
  const highlighter = window.tailieuHighlighter;
  const panel = window.tailieuPanel;

  function sendMessage(msg) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage(msg, (r) => resolve(r)); } catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  function dbg(...a) { if (typeof safeDebugLog === 'function') safeDebugLog('[content]', ...a); }

  let currentDocumentId = null;

  async function loadAndHighlight(docId) {
    if (!docId) { dbg('no docId'); return; }
    if (!matcher || !highlighter || !detector) { dbg('modules missing'); return; }

    panel && panel.setBusy(true);
    try {
      const r = await sendMessage({ action: 'getQuestionsByDocument', documentId: docId, useCache: true });
      if (!r || !r.ok) { dbg('fetch questions failed', r && r.error); panel && panel.setStats(null); return; }
      const questions = r.questions || [];
      matcher.rebuild(questions);
      const stats = {
        questionsShown: questions.length,
        totalCount: r.totalCount || questions.length,
        ratioPercent: r.ratioPercent,
        limitApplied: r.limitApplied,
      };
      panel && panel.setStats(stats);
      dbg('index rebuilt', matcher.getStats());

      if (panel && panel.getState().highlightEnabled) {
        highlighter.clearMarks();
        const parsed = detector.parseQuestions();
        let matchMap = matcher.matchAll(parsed);

        // On-demand fallback: cau hoi chua match local -> search backend (exact+fuzzy).
        const unmatchedTexts = parsed
          .filter((p) => !(matchMap[p.question] && matchMap[p.question].matched))
          .map((p) => p.question)
          .filter(Boolean);
        if (unmatchedTexts.length > 0) {
          dbg('on-demand search for', unmatchedTexts.length, 'unmatched');
          const s = await sendMessage({ action: 'searchQuestions', questions: unmatchedTexts, documentIds: docId ? [docId] : [] });
          if (s && s.ok && s.results) {
            // Merge: dua ket qua search vao index roi match lai.
            const extra = [];
            Object.keys(s.results).forEach((k) => {
              (s.results[k] || []).forEach((row) => extra.push(row));
            });
            if (matcher && typeof matcher.rebuild === 'function' && questions.length === 0) {
              matcher.rebuild(extra);
            } else if (matcher) {
              // Rebuild voi questions ban dau + extra (dedup don gian).
              const seen = new Set((questions).map((q) => q.id).filter(Boolean));
              const merged = questions.concat(extra.filter((q) => q.id && !seen.has(q.id)));
              matcher.rebuild(merged);
            }
            matchMap = matcher.matchAll(parsed);
          }
        }

        const res = highlighter.highlightAll(parsed, matchMap);
        dbg('highlight', res);
      }
    } finally {
      panel && panel.setBusy(false);
    }
  }

  async function detectCourseAndLoad() {
    dbg('detectCourseAndLoad start');
    if (!course) { dbg('course detector missing'); buildPanelOnly(); return; }
    const info = course.detectCourseInfoFromPage();
    if (!info || !info.title) { dbg('no course title'); buildPanelOnly(); return; }
    dbg('course title', info.title);
    const r = await sendMessage({ action: 'getDocumentByTitle', title: info.title });
    if (!r || !r.ok) { dbg('getDocumentByTitle failed', r && r.error); buildPanelOnly(); return; }
    const docs = r.documents || [];
    panel && panel.setDocuments(docs, true);
    if (docs.length === 1) {
      currentDocumentId = docs[0].id;
      loadAndHighlight(currentDocumentId);
    } else {
      dbg('multiple/no docs', docs.length);
    }
  }

  function buildPanelOnly() {
    if (panel) {
      panel.buildPanel(
        (docId) => { currentDocumentId = docId; loadAndHighlight(docId); },
        () => { if (currentDocumentId) loadAndHighlight(currentDocumentId); },
        (enabled) => {
          if (enabled && currentDocumentId) loadAndHighlight(currentDocumentId);
          else if (highlighter) highlighter.clearMarks();
        },
      );
      // panel.show(); // Ẩn mặc định khi tải trang
      panel.loadHighlightPref().then(() => panel.setDocuments([], false));
    }
  }

  // Floating btn đã được thay thế bởi sidebar trong panel.js

  // Tu dong dong bo token tu web app Tailieu HOU neu nguoi dung dang truy cap
  async function syncAuthTokenFromWebApp() {
    const loc = window.location.href;
    const isTailieuWeb = loc.includes('localhost:3000') || loc.includes('tailieu-hou.onrender.com') || loc.includes('tailieu-hou.com');
    if (!isTailieuWeb) return;

    try {
      const supabaseProject = 'fsyvgoltjxfiimoivbwo';
      const key = `sb-${supabaseProject}-auth-token`;
      const sessionStr = localStorage.getItem(key);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.access_token) {
          const currentToken = await sendMessage({ action: 'auth:getToken' });
          if (!currentToken || currentToken.token !== session.access_token) {
            const r = await sendMessage({
              action: 'auth:setSession',
              token: session.access_token,
              refreshToken: session.refresh_token,
              user: session.user
            });
            if (r && r.ok) {
              dbg('Dong bo token tu web app thanh cong');
            }
          }
        }
      } else {
        const currentToken = await sendMessage({ action: 'auth:getToken' });
        if (currentToken && currentToken.token) {
          await sendMessage({ action: 'auth:logout' });
          dbg('Dong bo logout tu web app');
        }
      }
    } catch (e) {
      dbg('Loi syncAuthTokenFromWebApp', e);
    }
  }

  // Expose API cho quizMode.js: so sánh câu hỏi trên trang với DB và highlight đáp án
  window._tailieu_manualCompare = async function ({ timeoutMs = 30000 } = {}) {
    if (!detector || !matcher || !highlighter) {
      dbg('_tailieu_manualCompare: modules missing');
      return { matched: [], pageQuestions: [] };
    }
    try {
      // Nếu chưa có doc thì thử auto-detect trước
      if (!currentDocumentId && course) {
        const info = course.detectCourseInfoFromPage();
        if (info && info.title) {
          const r = await sendMessage({ action: 'getDocumentByTitle', title: info.title });
          if (r && r.ok) {
            const docs = r.documents || [];
            if (docs.length >= 1) {
              currentDocumentId = docs[0].id;
              // Load questions vào matcher
              const qr = await sendMessage({ action: 'getQuestionsByDocument', documentId: currentDocumentId, useCache: true });
              if (qr && qr.ok) matcher.rebuild(qr.questions || []);
            }
          }
        }
      }

      const parsed = detector.parseQuestions();
      if (!parsed || parsed.length === 0) {
        return { matched: [], pageQuestions: [] };
      }

      let matchMap = matcher.matchAll(parsed);

      // On-demand search cho câu chưa match
      const unmatchedTexts = parsed
        .filter((p) => !(matchMap[p.question] && matchMap[p.question].matched))
        .map((p) => p.question)
        .filter(Boolean);
      if (unmatchedTexts.length > 0) {
        const s = await sendMessage({ action: 'searchQuestions', questions: unmatchedTexts, documentIds: currentDocumentId ? [currentDocumentId] : [] });
        if (s && s.ok && s.results) {
          const extra = [];
          Object.keys(s.results).forEach((k) => { (s.results[k] || []).forEach((row) => extra.push(row)); });
          if (extra.length > 0) {
            const seen = new Set((matcher.getStats ? [] : []).map((q) => q.id).filter(Boolean));
            matcher.rebuild(extra);
            matchMap = matcher.matchAll(parsed);
          }
        }
      }

      // Highlight tất cả câu hỏi
      highlighter.clearMarks();
      const res = highlighter.highlightAll(parsed, matchMap);
      dbg('_tailieu_manualCompare highlight result:', res);

      const matched = parsed
        .filter((p) => matchMap[p.question] && matchMap[p.question].matched)
        .map((p) => ({ question: p.question, pageQuestion: p.question, row: matchMap[p.question].row }));

      return { matched, pageQuestions: parsed };
    } catch (err) {
      dbg('_tailieu_manualCompare error:', err);
      return { matched: [], pageQuestions: [], error: String(err) };
    }
  };

  async function init() {
    await syncAuthTokenFromWebApp();
    const isQuiz = detector && detector.pageType && (detector.pageType() === 'attempt' || detector.pageType() === 'review' || detector.pageType() === 'quiz');

    // Build sidebar panel (tự quản lý toggle, không cần floating btn)
    buildPanelOnly();

    // Fetch role
    sendMessage({ action: 'auth:getProfile' }).then((r) => {
      if (r && r.ok && r.data && r.data.role) panel && panel.setRole(r.data.role);
    }).catch(() => {});

    // Tự động tô đáp án khi load trang bị tắt. Người dùng cần bấm "LÀM BÀI NGAY" để tô đáp án.

    // Tu dong kiem tra va dong bo token moi 1.5 giay neu o trang web app
    const loc = window.location.href;
    const isTailieuWeb = loc.includes('localhost:3000') || loc.includes('tailieu-hou.onrender.com') || loc.includes('tailieu-hou.com');
    if (isTailieuWeb) {
      setInterval(syncAuthTokenFromWebApp, 1500);
    }
  }

  init();
})();
