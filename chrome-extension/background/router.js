// src/background/router.js
// Dispatch message {action, ...} tu content/popup -> api.
(function () {
  'use strict';

  async function handle(req, sender) {
    const action = req.action;
    switch (action) {
      // === Documents ===
      case 'getCategories': {
        const r = await self.tailieuDocsApi.getCategoriesGrouped();
        return { ok: r.ok, categories: r.categories || [], error: r.error };
      }
      case 'getDocumentsByCategory': {
        const r = await self.tailieuDocsApi.getDocumentsByCategory(req.categoryId);
        return { ok: r.ok, documents: r.documents || [], error: r.error };
      }
      case 'getDocumentByTitle': {
        const r = await self.tailieuDocsApi.getDocumentByTitle(req.title);
        return { ok: r.ok, documents: r.documents || [], error: r.error };
      }
      case 'getDocumentById': {
        const r = await self.tailieuDocsApi.getDocumentById(req.id);
        return { ok: r.ok, document: r.document || null, error: r.error };
      }
      // === Questions ===
      case 'getQuestionsByDocument': {
        const r = await self.tailieuQuestionsApi.getQuestionsByDocument(req.documentId, { withFull: req.withFull === true, useCache: req.useCache !== false });
        return r;
      }
      case 'getQuestionsByDocuments': {
        const r = await self.tailieuQuestionsApi.getQuestionsByDocuments(req.documentIds, { withFull: req.withFull === true, useCache: req.useCache !== false });
        return { ok: r.ok, questions: r.questions || [], stats: r.stats || [], allLoaded: r.allLoaded, error: r.error };
      }
      case 'clearQuestionsCache': {
        await self.tailieuQuestionsApi.clearCache(req.documentId);
        return { ok: true };
      }
      case 'searchQuestions': {
        const r = await self.tailieuQuestionsApi.searchQuestions(req.questions || [], req.documentIds || []);
        return { ok: r.ok, results: r.results || {}, error: r.error };
      }
      // === Auth ===
      case 'auth:login': {
        const r = await self.tailieuAuthApi.login(req.email, req.password);
        return r;
      }
      case 'auth:loginWithGoogle': {
        return await self.tailieuAuthStore.loginWithGoogle();
      }
      case 'auth:refresh': {
        const r = await self.tailieuAuthStore.attemptRefresh();
        return r ? { ok: true, token: r } : { ok: false, error: 'refresh failed' };
      }
      case 'auth:logout': {
        return await self.tailieuAuthStore.logout();
      }
      case 'auth:setManualToken': {
        return await self.tailieuAuthStore.setManualToken(req.token);
      }
      case 'auth:setSession': {
        return await self.tailieuAuthStore.setSession(req.token, req.refreshToken, req.user);
      }
      case 'auth:getToken': {
        const token = await self.tailieuAuthStore.getToken();
        return { ok: true, token };
      }
      case 'auth:getProfile': {
        const r = await self.tailieuAuthApi.getProfile();
        return r;
      }
      case 'auth:getUiSettings': {
        return await self.tailieuAuthApi.getUiSettings();
      }
      case 'auth:putUiSettings': {
        return await self.tailieuAuthApi.putUiSettings(req.payload || {});
      }
      // === Unauthorized signal tu client (401) -> best-effort refresh ===
      case 'auth:unauthorized': {
        const t = await self.tailieuAuthStore.attemptRefresh();
        return { ok: !!t };
      }
      // === Env/base mode ===
      case 'env:getMode': {
        const mode = self.tailieuEnv ? await self.tailieuEnv.getMode() : 'auto';
        return { ok: true, mode };
      }
      case 'env:setMode': {
        if (self.tailieuEnv) await self.tailieuEnv.setMode(req.mode);
        return { ok: true };
      }
      case 'env:resolveBaseUrl': {
        const base = self.tailieuEnv ? await self.tailieuEnv.resolveBaseUrl() : '';
        return { ok: true, base };
      }
      // === Extension info ===
      case 'ping': {
        return { ok: true, pong: true, version: '0.1.0' };
      }
      default:
        return { ok: false, error: 'unknown action: ' + action };
    }
  }

  const api = { handle };
  if (typeof self !== 'undefined') self.tailieuRouter = api;
  if (typeof window !== 'undefined') window.tailieuRouter = api;
})();
