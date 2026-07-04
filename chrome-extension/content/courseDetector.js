// src/content/courseDetector.js
// Detect ten mon hoc tu trang EHOU/NEU/lmshub. Port tu auto-select-docs.js.
(function () {
  'use strict';

  if (window.tailieuCourseDetector) return;

  function _normalizeDetectedCourseTitle(raw) {
    let title = String(raw || '').trim();
    if (!title) return '';

    // NEU suffix pattern: "Mon hoc_08032026"
    if (title.includes('_')) {
      const parts = title.split('_');
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (/^\d+$/.test(lastPart)) {
          title = parts.slice(0, -1).join('_').trim();
        }
      }
    }

    // Keep course name part cho patterns: "Ten mon hoc - EG56.001"
    const parts = title.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      title = parts[0].length > 10 ? parts[0] : parts[1];
    } else if (parts.length === 1) {
      title = title.split(/[-–—]/)[0].trim();
    }
    return title.trim();
  }

  function _detectLmsHubCourseInfo() {
    const host = (window.location.hostname || '').toLowerCase();
    if (host !== 'lmshub.hou.edu.vn') return null;
    const headerEl =
      document.querySelector('.page-header-headings h1') ||
      document.querySelector('#page-header h1');
    const rawHeader = (headerEl && headerEl.textContent ? headerEl.textContent : '').trim();
    const title = _normalizeDetectedCourseTitle(rawHeader);
    const courseLink = document.querySelector(
      'ol.breadcrumb a[href*="/course/view.php?id="], .breadcrumb a[href*="/course/view.php?id="]',
    );
    const href = (courseLink && courseLink.href) || null;
    if (!title) return null;
    return { title, raw: rawHeader || title, href };
  }

  function _detect() {
    try {
      const lmshubInfo = _detectLmsHubCourseInfo();
      if (lmshubInfo) return lmshubInfo;
      let el =
        document.querySelector('.coursename.home-coursename a') ||
        document.querySelector('.coursename a');
      if (!el) {
        el =
          document.querySelector('a[itemprop="url"] span[itemprop="title"]') ||
          document.querySelector('span[itemprop="title"]') ||
          document.querySelector('a[itemprop="url"][title]');
      }
      if (!el) return null;
      let raw = (el.textContent || el.getAttribute('title') || '').trim();
      let title = _normalizeDetectedCourseTitle(raw);
      const href = el.href || null;
      return { title, raw, href };
    } catch (e) {
      return null;
    }
  }

  function detectCourseInfoFromPage() {
    const info = _detect();
    try {
      if (info && chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ tailieu_course_info: info });
      }
    } catch (e) { /* ignore */ }
    return info;
  }

  window.tailieuCourseDetector = {
    detectCourseInfoFromPage,
    _normalizeDetectedCourseTitle,
  };
})();
