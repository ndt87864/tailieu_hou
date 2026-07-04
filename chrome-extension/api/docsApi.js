// src/api/docsApi.js
// Documents + categories qua backend Hono.
(function () {
  'use strict';

  const T = (typeof window !== 'undefined') ? (window.tailieuTextUtils || {}) : (self.tailieuTextUtils || {});

  function normalizeCategory(row) {
    if (!row) return row;
    return Object.assign({}, row, {
      id: row.id || row.category_id || row.categoryId || null,
      title: row.title || '',
      logo: row.logo || null,
      slug: row.slug || null,
      stt: row.stt,
      documentCount: row.document_count || row.documentCount || 0,
    });
  }

  function normalizeDocument(row) {
    if (!row) return row;
    return Object.assign({}, row, {
      id: row.id || row.document_id || row.documentId || null,
      title: row.title || '',
      categoryId: row.category_id || row.categoryId || null,
      slug: row.slug || null,
      active: row.active !== false,
      premium: row.premium === true,
    });
  }

  // GET /api/v1/documents/grouped?full=false -> { categories: [{ id, title, logo, stt, documents? }] }
  async function getCategoriesGrouped() {
    const r = await tailieuClient.request('/api/v1/documents/grouped', { query: { full: 'false' } });
    if (!r.ok) return { ok: false, error: r.error, categories: [] };
    const cats = (r.data && r.data.categories) || [];
    const normalized = cats.map((c) => {
      const docs = (c.documents || []).map(normalizeDocument);
      return Object.assign(normalizeCategory(c), { documents: docs });
    });
    return { ok: true, categories: normalized };
  }

  // GET /api/v1/documents?category_id=
  async function getDocumentsByCategory(categoryId) {
    if (!categoryId) return { ok: true, documents: [] };
    const r = await tailieuClient.request('/api/v1/documents', { query: { category_id: categoryId } });
    if (!r.ok) return { ok: false, error: r.error, documents: [] };
    const docs = (r.data && r.data.documents) || [];
    return { ok: true, documents: docs.map(normalizeDocument) };
  }

  async function getDocumentById(id) {
    if (!id) return { ok: false, error: 'id required' };
    const r = await tailieuClient.request(`/api/v1/documents/${encodeURIComponent(id)}`);
    if (!r.ok) return { ok: false, error: r.error, document: null };
    return { ok: true, document: normalizeDocument(r.data && r.data.document) };
  }

  // Match title trang <-> documents trong grouped (client-side). Port tu data-provider.js getDocumentsByTitle.
  async function getDocumentByTitle(title) {
    if (!title) return { ok: true, documents: [] };
    const grouped = await getCategoriesGrouped();
    if (!grouped.ok) return { ok: false, error: grouped.error, documents: [] };

    const allDocs = [];
    (grouped.categories || []).forEach((c) => {
      (c.documents || []).forEach((d) => allDocs.push(Object.assign({ categoryId: c.id }, d)));
    });

    const normalizedWebTitle = T.normalizeTitle ? T.normalizeTitle(title) : String(title || '').toLowerCase().trim();
    const trimmedTitle = String(title || '').trim();
    const baseWebTitle = T.getBaseTitle ? T.getBaseTitle(normalizedWebTitle) : normalizedWebTitle;

    const matched = [];
    allDocs.forEach((doc) => {
      const dbTitle = String(doc.title || '').trim();
      const normalizedDbTitle = T.normalizeTitle ? T.normalizeTitle(dbTitle) : dbTitle.toLowerCase();
      const dbParts = T.splitDbTitleParts ? T.splitDbTitleParts(dbTitle) : [normalizedDbTitle];
      let score = 0;
      if (dbTitle === trimmedTitle) score = 100;
      else if (normalizedDbTitle === normalizedWebTitle) score = 95;
      else {
        const baseDbTitle = T.getBaseTitle ? T.getBaseTitle(normalizedDbTitle) : normalizedDbTitle;
        if (baseWebTitle && baseDbTitle && baseWebTitle === baseDbTitle) score = Math.max(score, 85);
        dbParts.forEach((part) => {
          if (part === normalizedWebTitle) score = Math.max(score, 102);
          else {
            const basePart = T.getBaseTitle ? T.getBaseTitle(part) : part;
            if (baseWebTitle && basePart && baseWebTitle === basePart) score = Math.max(score, 80);
            if (part.length > 5 && normalizedWebTitle.includes(part)) score = Math.max(score, 75);
            else if (normalizedWebTitle.length > 5 && part.includes(normalizedWebTitle)) score = Math.max(score, 75);
          }
        });
      }
      if (score >= 75) matched.push(Object.assign({}, doc, { _score: score }));
    });
    matched.sort((a, b) => (b._score || 0) - (a._score || 0));
    return { ok: true, documents: matched.slice(0, 15) };
  }

  const api = {
    getCategoriesGrouped,
    getDocumentsByCategory,
    getDocumentById,
    getDocumentByTitle,
  };

  if (typeof window !== 'undefined') {
    window.tailieuDocsApi = api;
  }
  if (typeof self !== 'undefined') {
    self.tailieuDocsApi = api;
  }
})();
