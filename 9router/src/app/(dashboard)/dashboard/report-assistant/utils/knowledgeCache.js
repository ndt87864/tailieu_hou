import {
  KNOWLEDGE_CACHE_PREFIX,
  KNOWLEDGE_SESSION_OWNER_KEY
} from "../constants";

export function getKnowledgeCacheKey(username, subject = "", filename = "") {
  const normalizedSubject = subject ? encodeURIComponent(subject) : "__all__";
  const normalizedFilename = filename ? encodeURIComponent(filename) : "";
  return `${KNOWLEDGE_CACHE_PREFIX}${username}.${normalizedSubject}${normalizedFilename ? `.${normalizedFilename}` : ""}`;
}

export function clearAllKnowledgeContentCaches() {
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(KNOWLEDGE_CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

export function ensureKnowledgeCacheSessionOwner(username) {
  if (typeof window === "undefined" || !username) return;
  const currentOwner = localStorage.getItem(KNOWLEDGE_SESSION_OWNER_KEY);
  if (currentOwner && currentOwner !== username) {
    clearAllKnowledgeContentCaches();
  }
  localStorage.setItem(KNOWLEDGE_SESSION_OWNER_KEY, username);
}

export function readKnowledgeContentCache(username, subject = "", filename = "") {
  if (typeof window === "undefined" || !username) return null;
  ensureKnowledgeCacheSessionOwner(username);
  const cacheKey = getKnowledgeCacheKey(username, subject, filename);
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
      return parsed.content;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeKnowledgeContentCache(username, subject, filename, content) {
  if (typeof window === "undefined" || !username || !content) return;
  ensureKnowledgeCacheSessionOwner(username);
  const cacheKey = getKnowledgeCacheKey(username, subject, filename);
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ content, timestamp: Date.now() }));
  } catch (err) {
    console.warn("[Knowledge cache] Failed to write to localStorage:", err.message);
  }
}

export async function fetchKnowledgeContentCached(username, options = {}) {
  const { subject = "", filename = "", force = false } = options;
  if (!username) return [];

  const cached = !force ? readKnowledgeContentCache(username, subject, filename) : null;
  if (cached) return cached;

  const params = new URLSearchParams({ username, includeContent: "1" });
  if (subject) params.set("subject", subject);
  if (filename) params.set("filename", filename);

  const res = await fetch(`/api/knowledge-content?${params.toString()}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`knowledge-content ${res.status}: ${errText.slice(0, 180)}`);
  }
  const data = await res.json();
  const rows = Array.isArray(data?.data) ? data.data : [];
  writeKnowledgeContentCache(username, subject, filename, rows);
  return rows;
}
