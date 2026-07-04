// src/api/questionsApi.js
// Questions qua backend Hono - lay theo document id (limited auto-role).
(function () {
  'use strict';

  const CONCURRENCY = 5;
  const CACHE_PREFIX = 'tailieu_questions_';
  const CACHE_TTL_MS = 2 * 60 * 1000;

  const T = (typeof window !== 'undefined') ? (window.tailieuTextUtils || {}) : (self.tailieuTextUtils || {});

  function normalizeQuestion(row) {
    if (!row) return row;
    return Object.assign({}, row, {
      id: row.id || row.question_id || row.questionId || null,
      document_id: row.document_id || row.documentId || null,
      question: row.question || '',
      answer: row.answer || '',
      choices: Array.isArray(row.choices) ? row.choices : (row.choices || []),
      url_question: row.url_question || null,
      url_answer: row.url_answer || null,
      order_index: row.order_index != null ? row.order_index : row.stt,
      isPremiumLocked: row.isPremiumLocked === true,
    });
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(keys, (r) => resolve(r || {})); } catch (e) { resolve({}); }
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      try { chrome.storage.local.set(obj, () => resolve(true)); } catch (e) { resolve(false); }
    });
  }

  async function readCache(docId) {
    const r = await storageGet([CACHE_PREFIX + docId]);
    const c = r[CACHE_PREFIX + docId];
    if (!c) return null;
    if (Date.now() - (c.ts || 0) > CACHE_TTL_MS) return null;
    return c.value;
  }
  async function writeCache(docId, value) {
    await storageSet({ [CACHE_PREFIX + docId]: { ts: Date.now(), value } });
  }
  async function clearCache(docId) {
    await storageSet({ [CACHE_PREFIX + docId]: null });
  }

  // Lay cau hoi 1 document. Luon dung endpoint /limited (auto-role). withFull=true -> endpoint full.
  async function getQuestionsByDocument(documentId, opts = {}) {
    if (!documentId) return { ok: false, error: 'documentId required', questions: [] };
    if (opts.useCache !== false) {
      const cached = await readCache(documentId);
      if (cached) return Object.assign({}, cached, { cached: true });
    }
    const endpoint = opts.withFull
      ? `/api/v1/questions/document/${encodeURIComponent(documentId)}`
      : `/api/v1/questions/document/${encodeURIComponent(documentId)}/limited`;
    const r = await tailieuClient.request(endpoint);
    if (!r.ok) return { ok: false, error: r.error, questions: [] };
    const data = r.data || {};
    const rawQs = Array.isArray(data.questions) ? data.questions : [];
    const questions = rawQs.map(normalizeQuestion);
    const result = {
      ok: true,
      questions,
      documentId,
      totalCount: data.totalCount != null ? data.totalCount : questions.length,
      lockedCount: data.lockedCount || 0,
      ratioPercent: data.ratioPercent != null ? data.ratioPercent : 100,
      limitApplied: data.limitApplied === true,
    };
    if (opts.useCache !== false) await writeCache(documentId, result);
    return result;
  }

  // Lay nhieu document, giam concurrency de tranh rate-limit. Gop + khong trung.
  async function getQuestionsByDocuments(documentIds, opts = {}) {
    const ids = (Array.isArray(documentIds) ? documentIds : []).map((id) => String(id || '').trim()).filter(Boolean);
    if (ids.length === 0) return { ok: true, questions: [], stats: [], allLoaded: true };

    const results = [];
    const stats = [];
    let i = 0;
    async function worker() {
      while (i < ids.length) {
        const idx = i++;
        const id = ids[idx];
        try {
          const r = await getQuestionsByDocument(id, opts);
          results.push(...r.questions);
          stats.push({ documentId: id, ok: r.ok, count: r.questions.length, totalCount: r.totalCount, lockedCount: r.lockedCount, ratioPercent: r.ratioPercent, limitApplied: r.limitApplied });
        } catch (e) {
          stats.push({ documentId: id, ok: false, error: String((e && e.message) || e) });
        }
      }
    }
    const workers = [];
    const n = Math.min(CONCURRENCY, ids.length);
    for (let k = 0; k < n; k++) workers.push(worker());
    await Promise.all(workers);

    // Dedup theo question id (ung voi noSpace key neu dung cho matching)
    const uniq = [];
    const seen = new Set();
    results.forEach((q) => {
      const key = q.id || (q.question && q.document_id ? q.document_id + '|' + T.noSpace(q.question) : null);
      if (key && seen.has(key)) return;
      if (key) seen.add(key);
      uniq.push(q);
    });

    return { ok: true, questions: uniq, stats, allLoaded: stats.every((s) => s.ok) };
  }

  // SEARCH theo text (exact + fuzzy) qua POST /api/v1/questions/search.
  // texts: string[], documentIds?: string[] -> { results: { "<text>": Question[] } }
  async function searchQuestions(texts, documentIds) {
    const qs = (Array.isArray(texts) ? texts : []).map((t) => String(t || '')).filter(Boolean);
    if (qs.length === 0) return { ok: true, results: {} };
    const payload = { questions: qs };
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      payload.document_ids = documentIds;
    }
    const r = await tailieuClient.request('/api/v1/questions/search', { method: 'POST', body: payload });
    if (!r.ok) return { ok: false, error: r.error, results: {} };
    const raw = (r.data && r.data.results) || {};
    const out = {};
    Object.keys(raw).forEach((k) => {
      out[k] = (Array.isArray(raw[k]) ? raw[k] : []).map(normalizeQuestion);
    });
    return { ok: true, results: out };
  }

  const api = {
    getQuestionsByDocument,
    getQuestionsByDocuments,
    searchQuestions,
    clearCache,
  };

  if (typeof window !== 'undefined') {
    window.tailieuQuestionsApi = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuQuestionsApi = api;
  }
})();
