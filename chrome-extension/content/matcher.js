// src/content/matcher.js
// Match trang question <-> DB question (exact/clean/lenient index). Port tu content.js rebuildGlobalQuestionIndex.
(function () {
  'use strict';

  if (window.tailieuMatcher) return;

  const T = window.tailieuTextUtils || {};

  let exactIndex = new Map();   // makeKey(text) -> [dbIdx]
  let cleanIndex = new Map();    // cleanText -> [dbIdx]
  let lenientIndex = new Map();  // noSpaceKey -> [dbIdx]
  let dbRows = [];               // normalized cached rows

  // Normalize 1 row: tinh before make keys
  function prepRow(row) {
    const rawQ = (row && row.question) || '';
    const clean = T.cleanQuestionText ? T.cleanQuestionText(rawQ) : String(rawQ).toLowerCase().trim();
    const key = T.makeKey ? T.makeKey(clean) : clean.toLowerCase();
    const noSpace = key ? key.replace(/\s+/g, '') : '';
    return Object.assign({}, row, { _clean: clean, _key: key, _noSpace: noSpace });
  }

  function rebuild(rows) {
    dbRows = (Array.isArray(rows) ? rows : []).map(prepRow).filter(Boolean);
    exactIndex = new Map();
    cleanIndex = new Map();
    lenientIndex = new Map();
    dbRows.forEach((r, idx) => {
      if (r._key) {
        if (!exactIndex.has(r._key)) exactIndex.set(r._key, []);
        exactIndex.get(r._key).push(idx);
      }
      if (r._clean) {
        if (!cleanIndex.has(r._clean)) cleanIndex.set(r._clean, []);
        cleanIndex.get(r._clean).push(idx);
      }
      if (r._noSpace) {
        if (!lenientIndex.has(r._noSpace)) lenientIndex.set(r._noSpace, []);
        lenientIndex.get(r._noSpace).push(idx);
      }
    });
  }

  function pick(idxes) {
    return idxes.map((i) => dbRows[i]);
  }

  // Match 1 page question -> best matching db row object or null
  function matchOne(pageQuestionText) {
    const clean = T.cleanQuestionText ? T.cleanQuestionText(pageQuestionText) : String(pageQuestionText || '').toLowerCase().trim();
    const key = T.makeKey ? T.makeKey(clean) : clean;
    const noSpace = key ? key.replace(/\s+/g, '') : '';

    if (key && exactIndex.has(key)) {
      const r = pick(exactIndex.get(key))[0];
      return { matched: true, score: 100, row: r };
    }
    if (clean && cleanIndex.has(clean)) {
      const r = pick(cleanIndex.get(clean))[0];
      return { matched: true, score: 95, row: r };
    }
    if (noSpace && lenientIndex.has(noSpace)) {
      const r = pick(lenientIndex.get(noSpace))[0];
      return { matched: true, score: 85, row: r };
    }
    return { matched: false, score: 0, row: null };
  }

  // Match nhieu page question -> map
  function matchAll(pageQuestions) {
    const out = {};
    (Array.isArray(pageQuestions) ? pageQuestions : []).forEach((q) => {
      out[q.question] = matchOne(q.question);
    });
    return out;
  }

  function getStats() {
    return {
      total: dbRows.length,
      exactKeys: exactIndex.size,
      cleanKeys: cleanIndex.size,
      lenientKeys: lenientIndex.size,
    };
  }

  window.tailieuMatcher = { rebuild, matchOne, matchAll, getStats };
})();
