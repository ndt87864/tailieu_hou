// src/utils/textUtils.js
// Text normalization helpers - port tu data-provider.js + content-text-utils.js cua extension cu.
(function () {
  'use strict';

  const COMB_MARK = '[̀-ͯ]';

  // Normalize ve lowercase, loai dau tieng Viet, bo khoang trang trang thai
  function normalizeText(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(new RegExp(COMB_MARK, 'g'), '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function noSpace(str) {
    return normalizeText(str).replace(/\s+/g, '');
  }

  function makeKey(str) {
    return normalizeText(str);
  }

  function cleanQuestionText(raw) {
    if (!raw) return '';
    let s = String(raw);
    s = s.replace(/<[^>]+>/g, ' ');
    s = s.replace(/&nbsp;/g, ' ').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
    s = s.replace(/^\s*(cau|câu|question|q)\s*\d+\s*[:\.\)]\s*/i, '');
    s = s.replace(/^\s*[a-z0-9]\s*[:\.\)]\s*/i, '');
    return normalizeText(s);
  }

  function normalizeTitle(str) {
    if (!str) return '';
    let normalized = String(str).replace(/&/g, ' va ');
    normalized = normalized.normalize('NFD').replace(new RegExp(COMB_MARK, 'g'), '');
    normalized = normalized.toLowerCase();
    normalized = normalized.replace(/\bxac\s+xuat\b/g, 'xac suat');
    const noiseWords = [
      /\bhoc\s*phan\b/g, /\bmon\b/g, /\blop\b/g, /\bnhom\b/g,
      /\bma\s*hp\b/g, /\bky\s*he\b/g, /\bhk\d+\b/g, /\bky\s*\d+\b/g, /\btong\s*hop\b/g,
    ];
    noiseWords.forEach((regex) => { normalized = normalized.replace(regex, ' '); });
    return normalized.replace(/[^a-z0-9\s+#-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getBaseTitle(normalizedStr) {
    if (!normalizedStr) return '';
    const base = normalizedStr.replace(/\s+\d+$/g, '').trim();
    return base.length > 2 ? base : normalizedStr;
  }

  function splitDbTitleParts(dbTitle) {
    if (!dbTitle) return [];
    const normalizedDb = normalizeTitle(dbTitle);
    const rawParts = dbTitle.split(/[+&\/]/).map((p) => p.trim()).filter(Boolean);
    if (rawParts.length <= 1) return [normalizedDb];
    const results = new Set();
    results.add(normalizedDb);
    const firstPart = rawParts[0];
    const prefixMatch = firstPart.match(/^(.*?\D)\s*\d+$/);
    const prefix = prefixMatch ? prefixMatch[1].trim() : null;
    rawParts.forEach((part) => {
      const normPart = normalizeTitle(part);
      results.add(normPart);
      if (/^\d+$/.test(part) && prefix) {
        results.add(normalizeTitle(prefix + ' ' + part));
      }
    });
    return Array.from(results);
  }

  const api = {
    normalizeText,
    noSpace,
    makeKey,
    cleanQuestionText,
    normalizeTitle,
    getBaseTitle,
    splitDbTitleParts,
  };

  if (typeof window !== 'undefined') {
    window.tailieuTextUtils = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuTextUtils = api;
  }
})();
