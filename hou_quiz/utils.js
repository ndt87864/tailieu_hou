(function () {
  "use strict";

  // Các hàm chuẩn hóa và so khớp chuỗi
  function normalizeTextForMatching(text) {
    if (!text) return '';
    try {
      let s = text.toString();
      s = s.replace(/[\u00A0\u2000-\u200B\uFEFF\u202F\xa0]/g, ' ');
      s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
      s = s.replace(/^[A-Za-z][\.\)](\S)/u, '$1');
      s = s.replace(/\n/g, ' ').replace(/[\s\t]+/g, ' ').replace(/[\s\xa0]{2,}/g, ' ').trim();
      s = s.replace(/^[\s\u2022•|]+|[\s\u2022•|]+$/g, '').trim();
      if (!/[._\u2026]{2,}\s*$/.test(s)) {
        s = s.replace(/[\.\u2026\-–—\s,;!\?\u2713\u2714]+$/g, '').trim();
      }
      return s;
    } catch (e) {
      let s = ('' + text).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
      return s.replace(/[\.\u2026\-–—\s]+$/g, '').trim();
    }
  }

  function stripVietnameseDiacritics(str) {
    if (!str) return "";
    let s = String(str);
    try { if (s.normalize) s = s.normalize('NFD').replace(/\p{M}/gu, ''); } catch (e) { s = s.replace(/[\u0300-\u036f]/g, ''); }
    return s;
  }

  function normalizeForCompare(str) {
    let s = String(str || '');
    try { if (s.normalize) s = s.normalize('NFKC'); } catch (e) { }
    s = s.toLowerCase();
    s = s.replace(/\s+/g, ' ').trim();
    let key = s;
    try {
      if (key.normalize) key = key.normalize('NFD').replace(/\p{M}/gu, '');
    } catch (e) { key = key.replace(/[\u0300-\u036f]/g, ''); }
    try {
      const unicodeLetterNumber = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
      key = key.replace(unicodeLetterNumber, '');
    } catch (e) {
      key = key.replace(/[^A-Za-z0-9\s]/g, '');
    }
    key = key.replace(/\s+/g, ' ').trim();
    return { raw: s, key };
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const v0 = new Array(bl + 1).fill(0);
    const v1 = new Array(bl + 1).fill(0);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }
    return v1[bl];
  }

  function compareNormalized(s1, s2) {
    if (!s1 || !s2) return false;
    
    const A = normalizeForCompare(s1);
    const B = normalizeForCompare(s2);
    if (!A.key || !B.key) return false;
    if (A.key === B.key) return true;
    if (A.key.replace(/\s+/g, '') === B.key.replace(/\s+/g, '') && A.key.replace(/\s+/g, '').length > 0) return true;
    if (A.key.includes(B.key) || B.key.includes(A.key)) return true;

    try {
      const lev = levenshtein(A.key, B.key);
      const maxLen = Math.max(A.key.length, B.key.length) || 1;
      const ratio = lev / maxLen;
      if (ratio <= 0.15 || lev <= 2) return true;
    } catch (e) { }

    return false;
  }

  function getSimilarityScore(s1, s2) {
    if (!s1 || !s2) return 0;
    const A = normalizeForCompare(s1);
    const B = normalizeForCompare(s2);
    if (!A.key || !B.key) return 0;
    if (A.key === B.key) return 1.0;
    if (A.key.replace(/\s+/g, '') === B.key.replace(/\s+/g, '')) return 0.99;

    // Nếu một chuỗi chứa chuỗi còn lại, tính theo tỷ lệ độ dài
    if (A.key.includes(B.key) || B.key.includes(A.key)) {
      return 0.8 * (Math.min(A.key.length, B.key.length) / Math.max(A.key.length, B.key.length));
    }

    try {
      const lev = levenshtein(A.key, B.key);
      const maxLen = Math.max(A.key.length, B.key.length) || 1;
      return 1.0 - (lev / maxLen);
    } catch (e) {
      return 0;
    }
  }

  window.houQuizUtils = {
    stripVietnameseDiacritics,
    compareNormalized,
    normalizeTextForMatching,
    getSimilarityScore
  };
})();
