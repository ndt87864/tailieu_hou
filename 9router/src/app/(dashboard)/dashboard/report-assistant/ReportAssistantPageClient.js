"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Legacy effects synchronize UI state with browser storage, persisted sessions, and async resources. */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);
import { cn } from "@/shared/utils/cn";
import { supabase } from "@/lib/supabaseClient";
import { getRestrictedReportAssistantSubjects, isRestrictedReportAssistantSubject } from "@/lib/userResourceMapping";
import useUserStore from "@/store/userStore";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";
import { LOGO_HOU_BASE64 } from "./logo-hou";
import { useRouter } from "next/navigation";


// ─── Constants & Key Storage Helpers ──────────────────────────────────────────
const FALLBACK_SYSTEM_PROMPT = "";
function getAssistantOnlyFallbackPrompt(username) {
  const displayName = String(username || "người dùng").trim() || "người dùng";
  return `Bạn là một trợ lý AI thân thiện. Hãy trả lời bằng tiếng Việt tự nhiên, rõ ràng và dễ hiểu. Nếu người dùng không yêu cầu tạo báo cáo, hãy trò chuyện như một trợ lý bình thường, giúp giải đáp thắc mắc và hướng dẫn từng bước.
- Khi giao tiếp, hãy xưng danh, xưng hô phù hợp với vai trò của trợ lý đang phục vụ tài khoản đó.
- Nếu người dùng hỏi về dnah tính của họ hoặc tương tự, hãy trả lời theo tên tài khoản đang đăng nhập là "${displayName}".
- Không tự nhận là người khác, không đổi danh xưng sang model/provider khác.`;
}
const DEFAULT_TEMPERATURE = 0.7;
const REPORT_MAX_TOKENS = 4096;
const CHAT_MAX_TOKENS = 2048;
const OUTLINE_MAX_TOKENS = 2048;
const MAX_OUTLINE_CONTEXT_CHARS = 6000;
const MAX_STAGE_CONTEXT_CHARS = 6000;
const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
const RESTRICTED_REPORT_ASSISTANT_SUBJECTS = getRestrictedReportAssistantSubjects();
const MAX_GLOBAL_OUTLINE_KNOWLEDGE_CHARS = 14000;
const MAX_SAMPLE_KNOWLEDGE_CHARS = 18000;
const SAMPLE_CHUNK_CHARS = 1800;
const SAMPLE_TOP_K = 8;
const KNOWLEDGE_CACHE_PREFIX = "report-assistant.knowledge-content.";
const KNOWLEDGE_SESSION_OWNER_KEY = "report-assistant.knowledge-content.sessionOwner";
const REPORT_ASSISTANT_LUNA_MODEL_PREFIX = "ln/";
const REPORT_ASSISTANT_ARENA_MODEL_PREFIX = "ar/";
const A4_PAGE_WIDTH = "8.27in";
const A4_PAGE_HEIGHT = "11.69in";
const A4_MARGIN_TOP = "2.5cm";
const A4_MARGIN_RIGHT = "2cm";
const A4_MARGIN_BOTTOM = "2.5cm";
const A4_MARGIN_LEFT = "3cm";

function tryParseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractAgentErrorMessage(errorText) {
  const parsed = tryParseJsonText(errorText);
  const message =
    parsed?.error?.message ||
    parsed?.error ||
    parsed?.message ||
    errorText ||
    "";
  return String(message || "").trim();
}

function classifyAgentDraftError(status, errorText, fallbackError = null) {
  const rawMessage = extractAgentErrorMessage(errorText) || fallbackError?.message || "";
  const normalized = rawMessage.toLowerCase();
  const statusCode = Number(status) || 0;

  if ([400, 429, 501, 503].includes(statusCode)) {
    return {
      title: "Lỗi quá tải hệ thống",
      message:
        "Hệ thống đang quá tải hoặc model/API key hiện tại không thể xử lý yêu cầu tạo báo cáo.",
      detail: rawMessage || `HTTP ${statusCode}`,
    };
  }

  if ([502, 504].includes(statusCode) || /timeout|timed out|aborted|fetch failed|econnrefused|api|json|unexpected end|no content/i.test(rawMessage)) {
    return {
      title: "Hệ thống không tạo được nội dung",
      message:
        "API không trả về nội dung hợp lệ cho bước soạn thảo này. Quy trình Agent đã được dừng để tránh chạy tiếp với trạng thái lỗi.",
      detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "API không phản hồi"),
    };
  }

  if (normalized.includes("quota") || normalized.includes("resource_exhausted") || normalized.includes("credits")) {
    return {
      title: "Hết hạn mức API",
      message:
        "API key hoặc tài khoản model đã hết hạn mức nên không thể tiếp tục tạo nội dung báo cáo.",
      detail: rawMessage,
    };
  }

  return {
    title: "Soạn thảo mục báo cáo thất bại",
    message:
      "Quy trình Agent đã được dừng vì bước soạn thảo hiện tại gặp lỗi.",
    detail: rawMessage || (statusCode ? `HTTP ${statusCode}` : "Không có thông tin lỗi chi tiết"),
  };
}

const getSK = (username) => {
  const prefix = `report-assistant.${username}`;
  return {
    sessions: `${prefix}.sessions`,
    activeSession: `${prefix}.activeSession`,
    activeModel: `${prefix}.activeModel`,
    systemPrompt: `${prefix}.systemPrompt`,
    temperature: `${prefix}.temperature`,
    assistantOnlyMode: `${prefix}.assistantOnlyMode`,
    enabledModels: `${prefix}.enabledModels`,
    knownModels: `${prefix}.knownModels`,
    knowledgeSubject: `${prefix}.knowledgeSubject`,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractTargetCompany(text) {
  if (!text) return "";
  const match = text.match(
    /(?:cho|của|về|tại)\s+(?:công ty|ngân hàng|tập đoàn|doanh nghiệp|đơn vị|cửa hàng|chuỗi)?\s*([A-ZÀ-Ỹa-zà-ỹ0-9\s\.\-]+?)(?:\s+mà|\s+nhưng|\s+để|\s+hoặc|\s+và|\s+theo|\s+ở|\s+tại|\s*$)/i,
  );
  return match ? match[1].trim() : "";
}

/**
 * Parse PDF file to text using pdf.js (loaded from CDN dynamically).
 * Returns: { text: string, pageCount: number }
 * The text includes page markers like: "[Trang 1]\n..."
 */
async function parsePdfText(file) {
  return new Promise((resolve, reject) => {
    const PDFJS_CDN =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const WORKER_CDN =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const doExtract = async (pdfjsLib) => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        let fullText = "";
        let lineNumber = 1;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const items = (textContent.items || []).filter(
            (it) => it && typeof it.str === "string" && it.transform
          );

          let pageLines = [];
          if (items.length > 0) {
            // Find boundaries to detect 2-column layout
            const xCoords = items.map((it) => it.transform[4]);
            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const width = maxX - minX;

            let isTwoColumn = false;
            let midX = minX + width / 2;

            if (width > 200) {
              const numSlices = 20;
              const sliceWidth = width / numSlices;
              const sliceCounts = new Array(numSlices).fill(0);

              for (const item of items) {
                const x = item.transform[4];
                const sliceIdx = Math.floor((x - minX) / sliceWidth);
                if (sliceIdx >= 0 && sliceIdx < numSlices) {
                  sliceCounts[sliceIdx]++;
                }
              }

              let leftCount = 0;
              for (let i = 2; i <= 7; i++) leftCount += sliceCounts[i];

              let rightCount = 0;
              for (let i = 12; i <= 17; i++) rightCount += sliceCounts[i];

              let midCount = 0;
              for (let i = 8; i <= 11; i++) midCount += sliceCounts[i];

              if (leftCount > 5 && rightCount > 5 && midCount < (leftCount + rightCount) * 0.15) {
                isTwoColumn = true;
                midX = minX + 10 * sliceWidth;
              }
            }

            const processGroup = (groupItems) => {
              const sorted = [...groupItems].sort((a, b) => b.transform[5] - a.transform[5]);
              const lines = [];
              let currentLine = [];
              let lastY = null;

              for (const item of sorted) {
                const y = item.transform[5];
                if (lastY === null) {
                  currentLine.push(item);
                  lastY = y;
                } else if (Math.abs(y - lastY) <= 8) {
                  currentLine.push(item);
                } else {
                  currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                  lines.push(currentLine);
                  currentLine = [item];
                  lastY = y;
                }
              }
              if (currentLine.length > 0) {
                currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                lines.push(currentLine);
              }

              const groupLines = [];
              for (const line of lines) {
                let lineStr = "";
                for (const it of line) {
                  if (lineStr && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
                    lineStr += " ";
                  }
                  lineStr += it.str;
                }
                if (lineStr.trim()) groupLines.push(lineStr.trim());
              }
              return groupLines;
            };

            if (isTwoColumn) {
              const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
              const linesGrouped = [];
              let currentLine = [];
              let lastLineY = null;
              for (const item of sortedItems) {
                const y = item.transform[5];
                if (lastLineY === null) {
                  currentLine.push(item);
                  lastLineY = y;
                } else if (Math.abs(y - lastLineY) <= 8) {
                  currentLine.push(item);
                } else {
                  linesGrouped.push(currentLine);
                  currentLine = [item];
                  lastLineY = y;
                }
              }
              if (currentLine.length > 0) {
                linesGrouped.push(currentLine);
              }

              const classifiedLines = linesGrouped.map((lineItems) => {
                lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                if (lineItems.length <= 1) {
                  return { type: "single", items: lineItems };
                }
                const midLeft = midX - 15;
                const midRight = midX + 15;
                let hasOverlap = false;
                for (const it of lineItems) {
                  const itemLeft = it.transform[4];
                  const itemRight = itemLeft + (it.width || 0);
                  if (itemLeft < midRight && itemRight > midLeft) {
                    hasOverlap = true;
                    break;
                  }
                }
                if (hasOverlap) {
                  return { type: "single", items: lineItems };
                }
                const leftItems = lineItems.filter((it) => it.transform[4] < midX);
                const rightItems = lineItems.filter((it) => it.transform[4] >= midX);
                if (leftItems.length > 0 && rightItems.length > 0) {
                  const rightMostLeft = leftItems[leftItems.length - 1];
                  const leftMostRight = rightItems[0];
                  const gap = leftMostRight.transform[4] - (rightMostLeft.transform[4] + (rightMostLeft.width || 0));
                  if (gap >= 20) {
                    return { type: "two", items: lineItems };
                  }
                }
                return { type: "two", items: lineItems };
              });

              const zones = [];
              let currentZone = null;
              for (const line of classifiedLines) {
                if (!currentZone) {
                  currentZone = { type: line.type, lines: [line.items] };
                } else if (currentZone.type === line.type) {
                  currentZone.lines.push(line.items);
                } else {
                  zones.push(currentZone);
                  currentZone = { type: line.type, lines: [line.items] };
                }
              }
              if (currentZone) {
                zones.push(currentZone);
              }

              const finalLines = [];
              for (const zone of zones) {
                if (zone.type === "single") {
                  for (const lineItems of zone.lines) {
                    let lineStr = "";
                    for (const it of lineItems) {
                      if (lineStr && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
                        lineStr += " ";
                      }
                      lineStr += it.str;
                    }
                    if (lineStr.trim()) finalLines.push(lineStr.trim());
                  }
                } else {
                  const allZoneItems = zone.lines.flat();
                  const leftItems = allZoneItems.filter((it) => it.transform[4] < midX);
                  const rightItems = allZoneItems.filter((it) => it.transform[4] >= midX);
                  finalLines.push(...processGroup(leftItems));
                  finalLines.push(...processGroup(rightItems));
                }
              }
              pageLines = finalLines;
            } else {
              pageLines = processGroup(items);
            }
          }

          fullText += `[Trang ${pageNum}]\n`;
          for (const line of pageLines) {
            if (line) {
              fullText += `Dòng ${lineNumber}: ${line}\n`;
              lineNumber++;
            }
          }
          fullText += "\n";
        }

        resolve({ text: fullText.trim(), pageCount });
      } catch (err) {
        reject(err);
      }
    };

    if (window.pdfjsLib) {
      doExtract(window.pdfjsLib);
    } else {
      const script = document.createElement("script");
      script.src = PDFJS_CDN;
      script.onload = () => doExtract(window.pdfjsLib);
      script.onerror = () => reject(new Error("Không thể tải pdf.js"));
      document.head.appendChild(script);
    }
  });
}

async function parseDocxText(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const doc = zip.file("word/document.xml");
  if (!doc) return { text: "", pageCount: 1 };
  const xml = await doc.async("text");
  const parser = new DOMParser();
  const parsed = parser.parseFromString(xml, "application/xml");
  const paragraphs = Array.from(parsed.getElementsByTagName("w:p"))
    .map((p) =>
      Array.from(p.getElementsByTagName("w:t"))
        .map((t) => t.textContent || "")
        .join("")
        .trim(),
    )
    .filter(Boolean);
  return { text: paragraphs.join("\n"), pageCount: 1 };
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse(val, fallback) {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function isReportAssistantLunaModel(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX);
}

function isReportAssistantArenaModel(modelId) {
  return String(modelId || "").startsWith(REPORT_ASSISTANT_ARENA_MODEL_PREFIX);
}

function hasAgentResultCards(messages) {
  return (Array.isArray(messages) ? messages : []).some(
    (message) => message?.kind === "agent_result_cards",
  );
}

function shouldAutoRestoreReportSession(session) {
  if (!session) return false;
  const modelId = String(session.modelId || "");
  if (!modelId.startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX) && !modelId.startsWith(REPORT_ASSISTANT_ARENA_MODEL_PREFIX)) {
    return false;
  }
  return !hasAgentResultCards(session.messages);
}

function isAgentFinishedState(state) {
  if (!state) return false;
  if (state.current_step === "COMPLETED" || state.current_step === "CANCELLED") {
    return true;
  }

  const progress = Array.isArray(state.sections_progress) ? state.sections_progress : [];
  if (progress.length === 0) return false;

  return !progress.some(
    (section) => section?.status === "todo" || section?.status === "drafting",
  );
}

function getReportAssistantLunaModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((model) => isReportAssistantLunaModel(model?.id));
}

function getReportAssistantArenaModels(models) {
  if (!Array.isArray(models)) return [];
  return models.filter((model) => isReportAssistantArenaModel(model?.id));
}

function getReportAssistantChatModels(models) {
  if (!Array.isArray(models)) return [];
  const lunaModels = getReportAssistantLunaModels(models);
  if (lunaModels.length > 0) {
    return lunaModels;
  }

  const arenaModels = getReportAssistantArenaModels(models);
  if (arenaModels.length > 0) {
    return arenaModels;
  }

  // Fallback only when Luna/Arena are not available at all.
  return models.filter((model) => {
    const modelId = String(model?.id || "");
    return modelId && !isReportAssistantLunaModel(modelId) && !isReportAssistantArenaModel(modelId);
  });
}

function getReportWorkflowDefaultModelId(models) {
  if (!Array.isArray(models) || models.length === 0) return "";
  return models[0]?.id || "";
}

function getKnowledgeCacheKey(username, subject = "", filename = "") {
  const normalizedSubject = subject ? encodeURIComponent(subject) : "__all__";
  const normalizedFilename = filename ? encodeURIComponent(filename) : "";
  return `${KNOWLEDGE_CACHE_PREFIX}${username}.${normalizedSubject}${normalizedFilename ? `.${normalizedFilename}` : ""}`;
}

function clearAllKnowledgeContentCaches() {
  if (typeof window === "undefined") return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(KNOWLEDGE_CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

function ensureKnowledgeCacheSessionOwner(username) {
  if (typeof window === "undefined" || !username) return;
  const currentOwner = localStorage.getItem(KNOWLEDGE_SESSION_OWNER_KEY);
  if (currentOwner && currentOwner !== username) {
    clearAllKnowledgeContentCaches();
  }
  localStorage.setItem(KNOWLEDGE_SESSION_OWNER_KEY, username);
}

function readKnowledgeContentCache(username, subject = "", filename = "") {
  if (typeof window === "undefined" || !username) return null;
  const cached = safeParse(localStorage.getItem(getKnowledgeCacheKey(username, subject, filename)), null);
  if (!cached || !Array.isArray(cached.data)) return null;
  return cached.data;
}

function writeKnowledgeContentCache(username, subject = "", filename = "", rows) {
  if (typeof window === "undefined" || !username || !Array.isArray(rows)) return;
  try {
    localStorage.setItem(
      getKnowledgeCacheKey(username, subject, filename),
      JSON.stringify({ cachedAt: Date.now(), subject, filename, data: rows }),
    );
  } catch {
    localStorage.removeItem(getKnowledgeCacheKey(username, subject, filename));
  }
}

async function fetchKnowledgeContentCached(username, options = {}) {
  const { subject = "", filename = "", force = false } = options;
  if (!username) return [];

  const cached = !force ? readKnowledgeContentCache(username, subject, filename) : null;
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    username,
    includeContent: "1",
  });
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

function clearKnowledgeContentCache(username, subject = "", filename = "") {
  if (typeof window !== "undefined" && username) {
    if (subject || filename) {
      localStorage.removeItem(getKnowledgeCacheKey(username, subject, filename));
      localStorage.removeItem(getKnowledgeCacheKey(username));
      return;
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${KNOWLEDGE_CACHE_PREFIX}${username}.`)) {
        localStorage.removeItem(key);
      }
    }
  }
}

function hasStreamingMessage(sessions) {
  return (Array.isArray(sessions) ? sessions : []).some((session) =>
    (Array.isArray(session?.messages) ? session.messages : []).some(
      (message) => message?.status === "streaming",
    ),
  );
}

function historySyncSignature(username, sessions) {
  return JSON.stringify({
    username,
    sessions: Array.isArray(sessions) ? sessions : [],
  });
}

function textValue(v) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean).join(" ");
  if (typeof v === "object") {
    if (typeof v.message === "string") return v.message;
    if (typeof v.error === "string") return v.error;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function isReportIntent(text) {
  if (!text) return false;
  const normalized = textValue(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\btao bao cao\b/.test(normalized);
}

function getDocTitle(content, fallbackTitle) {
  if (!content) return fallbackTitle;
  const titleMatch = content.match(/^(?:#|##)\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim().replace(/\*|_/g, "") : fallbackTitle;
}

function normalizeForMatch(text) {
  return removeVietnameseTones(textValue(text))
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAssistantPreamble(content) {
  return textValue(content)
    .split(/\n{2,}/)
    .map((paragraph) => {
      const normalized = normalizeForMatch(paragraph.slice(0, 500));
      const isPreamble =
        normalized.includes("supervisor agent") ||
        /\bagent [1-5]\b/.test(normalized) ||
        normalized.includes("multi agent") ||
        normalized.includes("toi da phoi hop cung cac agent") ||
        normalized.startsWith("chao ban toi la supervisor") ||
        normalized.startsWith("chao ban toi la he thong") ||
        normalized.startsWith("toi la he thong") ||
        normalized.startsWith("he thong da tiep nhan") ||
        normalized.startsWith("he thong da phoi hop") ||
        normalized.startsWith("duoi day la tom tat") ||
        normalized.startsWith("duoi day la noi dung");
      if (!isPreamble) return paragraph;

      const lines = paragraph.split(/\r?\n/);
      const contentStart = lines.findIndex((line) => {
        const lineText = normalizeForMatch(line);
        return /^(bo giao duc|truong dai hoc|bao cao|loi mo dau|chuong|ket luan|danh muc tai lieu|tai lieu tham khao)\b/.test(
          lineText,
        );
      });
      return contentStart >= 0 ? lines.slice(contentStart).join("\n") : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function cleanReportStageContent(content, startMatchers = []) {
  let cleaned = textValue(content)
    .replace(/\[START_REPORT\]/gi, "")
    .replace(/\[END_REPORT\]/gi, "")
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  cleaned = cleaned
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = normalizeForMatch(line);
      if (!normalized) return true;
      if (/^noi dung chuong \d+ se tiep noi/.test(normalized)) return false;
      if (/^\(?noi dung .* se tiep noi tai day\)?/.test(normalized)) {
        return false;
      }
      if (/^chuong \d+ .*se tiep noi tai day/.test(normalized)) return false;
      if (/\bagent \d+\b/.test(normalized)) return false;
      if (normalized.includes("toi da phoi hop cung cac agent")) return false;
      if (normalized.startsWith("duoi day la tom tat")) return false;
      if (normalized.startsWith("chao ban toi la supervisor")) return false;
      return true;
    })
    .join("\n")
    .trim();

  if (startMatchers.length > 0) {
    const lines = cleaned.split(/\r?\n/);
    const startIdx = lines.findIndex((line) => {
      const normalized = normalizeForMatch(line);
      return startMatchers.some((matcher) => matcher.test(normalized));
    });
    if (startIdx > 0) cleaned = lines.slice(startIdx).join("\n").trim();
  }

  return stripAssistantPreamble(cleaned);
}

function stripLeadingPageBreak(content) {
  return textValue(content).replace(/^\s*\[PAGE_BREAK\]\s*/i, "");
}

function stripAllPageBreaks(content) {
  return textValue(content)
    .replace(/\s*\[PAGE_BREAK\]\s*/gi, "\n")
    .trim();
}

function ensurePageBreakSuffix(content) {
  const cleaned = stripLeadingPageBreak(content).trim();
  if (!cleaned) return "";
  const withoutTrailing = cleaned.replace(/\n*\[PAGE_BREAK\]\s*$/gi, "");
  return `${withoutTrailing.trim()}\n[PAGE_BREAK]`;
}

function removeTrailingPageBreak(content) {
  const cleaned = stripLeadingPageBreak(content).trim();
  if (!cleaned) return "";
  return cleaned.replace(/\n*\[PAGE_BREAK\]\s*$/gi, "").trim();
}

function ensurePageBreakBeforeReferences(content) {
  const lines = textValue(content).split(/\r?\n/);
  const targetIdx = lines.findIndex((line) =>
    isReferenceHeadingLine(line),
  );
  if (targetIdx <= 0) return textValue(content).trim();

  for (let i = targetIdx - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.toUpperCase() === "[PAGE_BREAK]")
      return textValue(content).trim();
    break;
  }

  lines.splice(targetIdx, 0, "[PAGE_BREAK]");
  return lines.join("\n").trim();
}

function ensurePageBreakBeforeConclusion(content) {
  const lines = textValue(content).split(/\r?\n/);
  const targetIdx = lines.findIndex((line) => {
    const normalized = normalizeMajorHeadingLine(line);
    return /^ket luan\b/.test(normalized) || /^phan ket luan\b/.test(normalized);
  });
  if (targetIdx <= 0) return textValue(content).trim();

  for (let i = targetIdx - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.toUpperCase() === "[PAGE_BREAK]") return textValue(content).trim();
    break;
  }

  lines.splice(targetIdx, 0, "[PAGE_BREAK]");
  return lines.join("\n").trim();
}

function stripSupabaseReportLinks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const filtered = lines.filter(
    (line) =>
      !/supabase\.co\/storage\/v1\/object\/public\/report[_-]assistant/i.test(
        line,
      ),
  );
  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampTextForContext(text, maxChars) {
  const value = textValue(text).trim();
  if (!value) return "";
  if (value.length <= maxChars) return value;
  return value.slice(-maxChars);
}

function normalizeKnowledgeText(text) {
  return textValue(text).replace(/\s+/g, " ").trim();
}

function tokenizeForRetrieval(text) {
  const normalized = normalizeForMatch(textValue(text));
  const stop = new Set([
    "bao",
    "cao",
    "mau",
    "de",
    "cuong",
    "hay",
    "viet",
    "tao",
    "cho",
    "toi",
    "cac",
    "mot",
    "nhung",
    "trong",
    "theo",
    "va",
    "la",
    "ve",
    "cua",
    "co",
  ]);
  return normalized
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function chunkKnowledge(content, chunkSize = SAMPLE_CHUNK_CHARS) {
  const text = normalizeKnowledgeText(content);
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize).trim());
  }
  return chunks.filter(Boolean);
}

function selectRelevantSampleChunks(
  samples,
  query,
  maxChars = MAX_SAMPLE_KNOWLEDGE_CHARS,
) {
  const queryTokens = tokenizeForRetrieval(query);
  const querySet = new Set(queryTokens);
  const scored = [];

  for (const sample of samples || []) {
    for (const chunk of chunkKnowledge(sample.content)) {
      const chunkTokens = tokenizeForRetrieval(
        `${sample.subject} ${sample.name} ${chunk}`,
      );
      let score = 0;
      for (const token of chunkTokens) {
        if (querySet.has(token)) score += 3;
      }
      if (
        queryTokens.some((token) =>
          normalizeForMatch(sample.subject || "").includes(token),
        )
      )
        score += 8;
      if (
        queryTokens.some((token) =>
          normalizeForMatch(sample.name || "").includes(token),
        )
      )
        score += 5;
      scored.push({ ...sample, content: chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const selected = [];
  let total = 0;
  for (const item of scored.slice(
    0,
    Math.max(SAMPLE_TOP_K * 2, SAMPLE_TOP_K),
  )) {
    if (selected.length >= SAMPLE_TOP_K || total >= maxChars) break;
    if (!item.content) continue;
    selected.push(item);
    total += item.content.length;
  }
  return selected;
}

function buildStageContext(outline, previous) {
  const outlineText = clampTextForContext(outline, MAX_OUTLINE_CONTEXT_CHARS);
  const previousText = clampTextForContext(
    cleanReportStageContent(previous),
    MAX_STAGE_CONTEXT_CHARS,
  );
  const parts = [];
  if (outlineText) {
    parts.push(`Dàn ý chi tiết (tóm lược):\n${outlineText}`);
  }
  if (previousText) {
    parts.push(`Nội dung đã viết (trích đoạn gần nhất):\n${previousText}`);
  }
  return parts.join("\n\n").trim();
}

function isRetriableStatus(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function reportProgressMessage(step, detail, partial = "") {
  const cleanedPartial = cleanReportStageContent(partial).trim();
  const preview = cleanedPartial
    ? `\n\n${cleanedPartial.slice(0, 1600)}${cleanedPartial.length > 1600 ? "\n\n..." : ""}`
    : "";
  return `✨ **[${step}] ${detail}**${preview}`;
}
function normalizeMajorHeadingLine(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\d+(?:\.\d+)*\s*/, "")
      .replace(/^(?:[ivxlcdm]+|[IVXLCDM]+)\.?\s*/i, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}
function isListItemLine(line) {
  const trimmed = textValue(line).trim();
  return /^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

function isMajorSectionHeadingLine(line) {
  if (isListItemLine(line)) return false;

  const trimmed = textValue(line).trim();
  if (trimmed.length > 150) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("đóng vai trò") ||
    lower.includes("là kết quả") ||
    lower.includes("chương này") ||
    lower.includes("tác giả") ||
    lower.includes("được chia thành") ||
    lower.includes("chúng ta") ||
    lower.includes("nghiên cứu này") ||
    lower.includes("xin cam đoan") ||
    lower.includes("cam đoan rằng") ||
    (trimmed.endsWith(".") && !/\d+\.$/.test(trimmed) && !/chương\s+\d+\.$/i.test(trimmed))
  ) {
    return false;
  }

  const normalized = normalizeMajorHeadingLine(line);
  if (!normalized) return false;
  return (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^phan mo dau\b/.test(normalized) ||
    /^phan noi dung\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(
      normalized,
    ) ||
    /^chapter\s+\d+\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^muc luc\b/.test(normalized) ||
    /^nhan xet kien tap\b/.test(normalized) ||
    /^xac nhan cua can bo huong dan\b/.test(normalized)
  );
}

function isReferenceHeadingLine(line) {
  if (isListItemLine(line)) return false;
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^references?\b/.test(normalized) ||
    /^bibliograph/.test(normalized)
  );
}

function canonicalizeMajorHeading(line) {
  const raw = textValue(line).trim();
  const normalized = normalizeMajorHeadingLine(raw);
  if (!normalized) return raw;
  const title = raw
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*(.+?)\*\*:?\s*$/, "$1")
    .trim();

  if (isReferenceHeadingLine(raw)) return "## DANH M\u1ee4C T\u00c0I LI\u1ec6U THAM KH\u1ea2O";
  if (/^ket luan\b/.test(normalized) || /^phan ket luan\b/.test(normalized)) {
    return `# ${title.replace(/^phan\s+/i, "")}`;
  }
  if (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^phan mo dau\b/.test(normalized) ||
    /^phan noi dung\b/.test(normalized) ||
    /^nhan xet kien tap\b/.test(normalized) ||
    /^xac nhan cua can bo huong dan\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(normalized) ||
    /^chapter\s+\d+\b/.test(normalized)
  ) {
    return `# ${title}`;
  }
  return raw;
}

function normalizeMajorHeadingLevels(content) {
  return textValue(content)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return line;
      return isMajorSectionHeadingLine(trimmed) ? canonicalizeMajorHeading(trimmed) : line;
    })
    .join("\n")
    .trim();
}

function normalizeNumberedHeadingLevels(content) {
  return textValue(content)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return line;

      // Extract raw text by stripping leading hashes, bold, and italic markers
      let cleanText = trimmed.replace(/^(###*|#+)\s+/, "");
      cleanText = cleanText.replace(/^\*\*|\*\*$/g, "");
      cleanText = cleanText.replace(/^\*|\*$/g, "");
      cleanText = cleanText.trim();

      // Check if the cleaned text starts with a numbered pattern (e.g., 1.1 or 1.1.1)
      const numberMatch = cleanText.match(/^(\d+(?:\.\d+)+)\.?\s+(.*)$/);
      if (!numberMatch) return line;

      const numberPart = numberMatch[1];
      const titlePart = numberMatch[2].replace(/^\*\*|\*\*$/g, "").replace(/^\*|\*$/g, "").trim();
      const dotCount = numberPart.split(".").length; // e.g. "1.1" -> 2 dots/parts, "1.1.1" -> 3

      const targetLevel = Math.min(6, Math.max(2, dotCount));
      const targetHashes = "#".repeat(targetLevel);
      return `${targetHashes} ${numberPart}. ${titlePart}`.trim();
    })
    .join("\n")
    .trim();
}

function splitReferenceBlocks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const body = [];
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (isReferenceHeadingLine(line)) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      body.push(line);
    }
  }
  if (current) blocks.push(current);
  return { body: body.join("\n").trim(), blocks };
}

function normalizeReferenceListItem(line, nextIndex) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return "";
  if (isReferenceHeadingLine(trimmed)) return "";
  const match = trimmed.match(/^(?:[-*]\s+|\d+[.)]\s+)?(.+)$/);
  const item = (match?.[1] || trimmed).trim();
  if (!item) return "";
  return `${nextIndex}. ${item}`;
}

function mergeDuplicateReferenceSections(content) {
  const { body, blocks } = splitReferenceBlocks(content);
  if (!blocks.length) return textValue(content).trim();

  const seen = new Set();
  const items = [];
  for (const block of blocks) {
    for (const rawLine of block.lines) {
      const item = normalizeReferenceListItem(rawLine, items.length + 1);
      if (!item) continue;
      const key = normalizeForMatch(item.replace(/^\d+[.)]\s*/, ""));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  const referenceSection = [
    "[PAGE_BREAK]",
    "## DANH M\u1ee4C T\u00c0I LI\u1ec6U THAM KH\u1ea2O",
    ...items.map((item, index) => item.replace(/^\d+[.)]\s*/, `${index + 1}. `)),
  ].join("\n");

  return body ? `${body.trim()}\n\n${referenceSection}` : referenceSection;
}

function isTocHeadingLine(line) {
  const normalized = normalizeMajorHeadingLine(line);
  return (
    /^muc luc\b/.test(normalized) || /^table of contents\b/.test(normalized)
  );
}

function isLikelyTocEntryLine(line) {
  const raw = textValue(line).trim();
  const normalized = normalizeMajorHeadingLine(raw);
  if (!normalized) return false;
  if (/[.\u2026]{3,}\s*\d*\s*$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)*\s+/.test(raw)) return true;
  return (
    /^phan\s+/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized)
  );
}

function injectSectionPageBreaks(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastMajorHeading = "";
  let inTableOfContents = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      inTableOfContents = false;
      continue;
    }

    if (isTocHeadingLine(trimmed)) {
      inTableOfContents = true;
      out.push(line);
      continue;
    }

    if (inTableOfContents && isLikelyTocEntryLine(trimmed)) {
      out.push(line);
      continue;
    }

    if (isMajorSectionHeadingLine(trimmed)) {
      const normalizedHeading = normalizeMajorHeadingLine(trimmed);
      if (normalizedHeading && normalizedHeading === lastMajorHeading) {
        continue;
      }

      const nextMeaningful =
        lines
          .slice(idx + 1)
          .map((nextLine) => nextLine.trim())
          .find(Boolean) || "";
      const previousMeaningful =
        out
          .slice()
          .reverse()
          .map((prevLine) => textValue(prevLine).trim())
          .find(Boolean) || "";
      const looksLikeChapterList =
        (nextMeaningful &&
          (isMajorSectionHeadingLine(nextMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(nextMeaningful))) ||
        (previousMeaningful &&
          previousMeaningful.toUpperCase() !== "[PAGE_BREAK]" &&
          (isMajorSectionHeadingLine(previousMeaningful) ||
            /[.\u2026]{3,}\s*\d*\s*$/.test(previousMeaningful)));

      if (looksLikeChapterList) {
        out.push(line);
        lastMajorHeading = normalizedHeading;
        continue;
      }

      // Find the last *meaningful* (non-blank) line in out to correctly detect existing PAGE_BREAKs
      const lastMeaningful = out
        .slice()
        .reverse()
        .map((l) => textValue(l).trim().toUpperCase())
        .find((l) => l !== "") || "";
      if (out.length > 0 && lastMeaningful !== "[PAGE_BREAK]") {
        out.push("[PAGE_BREAK]");
      }

      lastMajorHeading = normalizedHeading;
    } else if (trimmed) {
      lastMajorHeading = "";
      inTableOfContents = false;
    }

    out.push(line);
  }

  return out.join("\n").trim();
}

function normalizeDisplayLineForDedup(line) {
  return normalizeForMatch(
    textValue(line)
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.+?)\*\*:?$/, "$1")
      .replace(/^\d+(?:\.\d+)*\s*/, "")
      .replace(/^[\-*•]\s+/, "")
      .replace(/\s+/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function stripDuplicateAdjacentDisplayLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let lastKey = "";
  let lastHeadingKey = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      lastKey = "";
      continue;
    }

    const normalized = normalizeDisplayLineForDedup(trimmed);
    const headingLike =
      isMajorSectionHeadingLine(trimmed) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(trimmed);

    if (
      headingLike &&
      normalized &&
      (normalized === lastKey || normalized === lastHeadingKey)
    ) {
      continue;
    }

    out.push(line);
    lastKey = normalized;
    lastHeadingKey = headingLike ? normalized : "";
  }

  return out.join("\n").trim();
}

function isStandaloneSeparatorLine(line) {
  const trimmed = textValue(line).trim();
  if (!trimmed || trimmed.toUpperCase() === "[PAGE_BREAK]") return false;
  return /^[-*_]{3,}$/.test(trimmed) || /^[-*_](?:\s*[-*_]){2,}$/.test(trimmed);
}

function stripStandaloneSeparatorLines(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "[PAGE_BREAK]") {
      out.push("[PAGE_BREAK]");
      continue;
    }
    if (isStandaloneSeparatorLine(trimmed)) continue;
    out.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removePageBreaksAfterHeadingOnly(content) {
  const lines = textValue(content).split(/\r?\n/);
  const out = [];
  let segmentLines = [];

  for (const line of lines) {
    if (line.trim().toUpperCase() === "[PAGE_BREAK]") {
      if (!isHeadingOnlyReportBlock(segmentLines.join("\n"))) {
        out.push("[PAGE_BREAK]");
        segmentLines = [];
      }
      continue;
    }

    out.push(line);
    if (line.trim()) segmentLines.push(line);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMetadataFromContent(content, title = "") {
  const result = {
    studentName: "..................................................",
    studentId: "..................................................",
    class: "..................................................",
    advisor: "..................................................",
    advisorRole: "Cán bộ hướng dẫn",
    company: "..................................................",
    reportTitle: "BÁO CÁO THỰC TẬP",
    year: "2026",
    dob: "..................................................",
    major: "..................................................",
    internshipDuration: "..................................................",
    courseId: "..................................................",
  };

  let rawTitle = "";
  if (title) {
    rawTitle = title.replace(/^(?:Báo cáo tạm dừng|Merged|Copy|Bản nháp|Bản xem trước)\s*-\s*/i, "").trim();
  }
  if (!rawTitle) {
    const headingMatch = content.match(/^\s*#\s+(.+)$/m);
    if (headingMatch) {
      rawTitle = headingMatch[1].trim();
    }
  }

  const normalizedText = String(content + " " + title).toLowerCase();
  if (normalizedText.includes("ba49") || normalizedText.includes("b49") || normalizedText.includes("kiến tập thực tế") || normalizedText.includes("kiến tập")) {
    result.reportTitle = "BÁO CÁO KIẾN TẬP THỰC TẾ";
  } else if (normalizedText.includes("định hướng nghề nghiệp") || normalizedText.includes("career orientation") || normalizedText.includes("sl06") || normalizedText.includes("sl07") || normalizedText.includes("el67")) {
    result.reportTitle = "BÁO CÁO THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP 2";
  } else if (rawTitle) {
    result.reportTitle = rawTitle.toUpperCase();
  } else {
    result.reportTitle = "BÁO CÁO KHÓA LUẬN TỐT NGHIỆP";
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/[#*`_\-\[\]()]/g, "").trim();

    // Student Name
    if (result.studentName.includes("...")) {
      const match = cleanLine.match(/^(?:Họ\s+tên\s+)?sinh\s+viên(?:\s+thực\s+hiện)?:\s*(.+)$/i);
      if (match) result.studentName = match[1].trim();
    }
    // Student ID
    if (result.studentId.includes("...")) {
      const match = cleanLine.match(/^(?:Mã\s+số\s+sinh\s+viên|MSSV):\s*(.+)$/i);
      if (match) result.studentId = match[1].trim();
    }
    // Class
    if (result.class.includes("...")) {
      const match = cleanLine.match(/^Lớp:\s*(.+)$/i);
      if (match) result.class = match[1].trim();
    }
    // Advisor
    if (result.advisor.includes("...")) {
      const match = cleanLine.match(/^(?:Giảng\s+viên\s+hướng\s+dẫn|Cán\s+bộ\s+hướng\s+dẫn|GVHD):\s*(.+)$/i);
      if (match) result.advisor = match[1].trim();
    }
    // Advisor Role
    if (result.advisorRole === "Cán bộ hướng dẫn") {
      const match = cleanLine.match(/^Chức\s+vụ:\s*(.+)$/i);
      if (match) result.advisorRole = match[1].trim();
    }
    // Company
    if (result.company.includes("...")) {
      // Use original line to parse so we can easily remove parentheses content
      const origMatch = line.match(/^(?:Tại\s+đơn\s+vị|Tên\s+công\s+ty|Đơn\s+vị\s+kiến\s+tập|Đơn\s+vị\s+thực\s+tập|Cơ\s+quan\s+thực\s+tập):\s*(.+)$/i);
      if (origMatch) {
        let rawCompany = origMatch[1].replace(/[#*`_\-\[\]]/g, "").trim();
        // Remove parenthesis contents (e.g. English name)
        rawCompany = rawCompany.replace(/\s*[([].*?[\])]\s*/g, " ").replace(/\s+/g, " ").trim();
        result.company = rawCompany;
      }
    }
    // Ngày sinh
    if (result.dob.includes("...")) {
      const match = cleanLine.match(/^(?:Ngày\s+sinh):\s*(.+)$/i);
      if (match) result.dob = match[1].trim();
    }
    // Ngành đào tạo
    if (result.major.includes("...")) {
      const match = cleanLine.match(/^(?:Ngành\s+đào\s+tạo|Ngành):\s*(.+)$/i);
      if (match) result.major = match[1].trim();
    }
    // Thời gian thực tập
    if (result.internshipDuration.includes("...")) {
      const match = cleanLine.match(/^(?:Thời\s+gian\s+thực\s+tập|Thời\s+gian\s+thực\s+hiện|Thời\s+gian):\s*(.+)$/i);
      if (match) result.internshipDuration = match[1].trim();
    }
    // Mã course học
    if (result.courseId.includes("...")) {
      const match = cleanLine.match(/^(?:Mã\s+course\s+học|Mã\s+course|Mã\s+khóa\s+học):\s*(.+)$/i);
      if (match) result.courseId = match[1].trim();
    }
    // Year
    const yearMatch = cleanLine.match(/năm\s+(202[4-9])/i);
    if (yearMatch) {
      result.year = yearMatch[1].trim();
    }
  }

  return result;
}

function injectCoverPage(content, title = "") {
  const meta = extractMetadataFromContent(content, title);
  const isBa49 = meta.reportTitle.toUpperCase().includes("KIẾN TẬP") ||
    title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    content.toLowerCase().includes("ba49") ||
    content.toLowerCase().includes("b49");

  if (content.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") || content.includes("logo-hou.png") || content.includes("[LOGO_HOU]")) {
    if (isBa49) {
      if (content.includes("TRUNG TÂM ĐÀO TẠO TRỰC TUYẾN") || !content.includes("VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI")) {
        const parts = content.split("[PAGE_BREAK]");
        const remainingPart = parts.slice(1).join("[PAGE_BREAK]");
        const coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center; text-decoration: underline;">
      VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI
    </div>
  </div>

  <div style="margin: 1.5cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5cm;">
    <div style="font-size: 18pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${meta.reportTitle}
    </div>
    <div style="font-size: 14pt; font-weight: bold; text-align: center; max-width: 90%;">
      Tại đơn vị: ${meta.company}
    </div>
  </div>

  <table style="width: 85%; margin: 0 auto 2.5cm auto; border-collapse: collapse; border: none; font-size: 13pt; line-height: 2.0; text-align: left;">
    <tr><td style="width: 35%; padding: 8px; font-weight: bold;">Họ và tên sinh viên:</td><td style="width: 65%; padding: 8px;">${meta.studentName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Lớp:</td><td style="padding: 8px;">${meta.class}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Ngày sinh:</td><td style="padding: 8px;">${meta.dob}</td></tr>
  </table>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
        return coverHtml.trim() + "\n\n" + remainingPart.trim();
      }
    }
    return content;
  }
  const isCareerOrientation = meta.reportTitle.toUpperCase().includes("ĐỊNH HƯỚNG NGHỀ NGHIỆP") ||
    title.toLowerCase().includes("định hướng nghề nghiệp") ||
    content.toLowerCase().includes("định hướng nghề nghiệp");

  let coverHtml = "";

  if (isBa49) {
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center; text-decoration: underline;">
      VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI
    </div>
  </div>

  <div style="margin: 1.5cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5cm;">
    <div style="font-size: 24pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${meta.reportTitle}
    </div>
    <div style="font-size: 14pt; text-align: center; max-width: 90%;">
      Tại đơn vị: ${meta.company}
    </div>
  </div>

  <table style="width: 85%; margin: 0 auto 2.5cm auto; border-collapse: collapse; border: none; font-size: 13pt; line-height: 2.0; text-align: left;">
    <tr><td style="width: 35%; padding: 8px; font-weight: bold;">Họ và tên sinh viên:</td><td style="width: 65%; padding: 8px;">${meta.studentName}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Lớp:</td><td style="padding: 8px;">${meta.class}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Ngày sinh:</td><td style="padding: 8px;">${meta.dob}</td></tr>
  </table>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  } else if (isCareerOrientation) {
    let subTitle = "THỰC TẬP ĐỊNH HƯỚNG NGHỀ NGHIỆP 2";
    if (meta.reportTitle.toUpperCase().includes("ĐỊNH HƯỚNG NGHỀ NGHIỆP")) {
      subTitle = meta.reportTitle.toUpperCase()
        .replace(/^BÁO CÁO\s+/i, "")
        .replace(/^HỌC PHẦN\s+/i, "");
    }
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center;">
      VIỆN ĐT & PT HỌC TẬP SUỐT ĐỜI
    </div>
    <div style="width: 120px; height: 1px; background-color: #000; margin: 8px auto 0 auto;"></div>
  </div>

  <div style="margin: 1.5cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5cm;">
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 5px;">
      BÁO CÁO THỰC TẬP
    </div>
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 5px;">
      HỌC PHẦN
    </div>
    <div style="font-size: 16pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${subTitle}
    </div>
  </div>

  <div style="width: 85%; margin: 0 auto 2.5cm 15%; text-align: left; font-size: 13pt; line-height: 2.0; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Cán bộ hướng dẫn:</strong> ${meta.advisor}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Sinh viên thực hiện:</strong> ${meta.studentName}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Ngày sinh:</strong> ${meta.dob}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Lớp:</strong> ${meta.class}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Ngành đào tạo:</strong> ${meta.major}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Thời gian thực tập:</strong> ${meta.internshipDuration}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Mã course học:</strong> ${meta.courseId}</div>
  </div>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  } else {
    coverHtml = `
<div class="cover-page-container" style="display: flex; flex-direction: column; align-items: center; text-align: center; font-family: 'Times New Roman', Times, serif; min-height: 240mm; box-sizing: border-box; justify-content: space-between; padding: 1.5cm 1cm 1cm 1cm; position: relative;">
  
  <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-bottom: 5px; text-align: center;">
      TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI
    </div>
    <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; line-height: 1.3; text-align: center;">
      TRUNG TÂM ĐÀO TẠO TRỰC TUYẾN
    </div>
    <div style="width: 120px; height: 1px; background-color: #000; margin: 8px auto 0 auto;"></div>
  </div>

  <div style="margin: 2cm 0; display: flex; justify-content: center; align-items: center; width: 100%;">
    [LOGO_HOU]
  </div>

  <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-bottom: 2cm;">
    <div style="font-size: 18pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; max-width: 90%; text-align: center; margin-bottom: 10px;">
      ${meta.reportTitle}
    </div>
    <div style="font-size: 14pt; font-weight: bold; font-style: italic; text-align: center; max-width: 90%;">
      Tại đơn vị: ${meta.company}
    </div>
  </div>

  <div style="width: 85%; margin: 0 auto 3cm 15%; text-align: left; font-size: 13pt; line-height: 2.0; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Họ tên cán bộ hướng dẫn:</strong> ${meta.advisor}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Chức vụ:</strong> ${meta.advisorRole}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Họ tên sinh viên:</strong> ${meta.studentName}</div>
    <div style="text-indent: 0; text-align: left; margin: 4px 0;"><strong style="display: inline-block; width: 220px;">Lớp:</strong> ${meta.class}</div>
  </div>

  <div style="width: 100%; text-align: center; font-size: 13pt; font-weight: bold; text-transform: uppercase; margin-top: auto;">
    HÀ NỘI, NĂM ${meta.year}
  </div>

</div>

[PAGE_BREAK]
`;
  }

  const hasAbbreviation = /\b(?:DANH MỤC TỪ VIẾT TẮT|DANH MUC TU VIET TAT|TU VIET TAT|TỪ VIẾT TẮT)\b/i.test(content);
  let finalContent = content;
  if (!hasAbbreviation) {
    const abbreviationTable = [
      "<center>",
      "",
      "## DANH MỤC TỪ VIẾT TẮT",
      "",
      "</center>",
      "",
      "| Từ viết tắt | Chữ viết đầy đủ (Tiếng Việt) | Chữ viết đầy đủ (Tiếng Anh) |",
      "|---|---|---|",
      ...Array.from({ length: 20 }, () => "| &nbsp; | &nbsp; | &nbsp; |"),
      "",
      "[PAGE_BREAK]",
      ""
    ].join("\n");
    finalContent = abbreviationTable + content;
  }

  return coverHtml.trim() + "\n\n" + finalContent;
}

function stripTrailingProseAfterSignature(content, title = "") {
  if (!content) return "";
  const lines = textValue(content).split(/\r?\n/);
  const cleanLines = [];
  let seen43Signature = false;
  let stopKeeping = false;
  let in43 = /4\.3\b/i.test(title) || /d[áâ]nh\s+gi[áa]|danh\s+gia/i.test(title);

  for (let line of lines) {
    const trimmed = line.trim();

    // Check if we entered section 4.3 in the content text
    if (/^\s*(?:#{1,6}\s*)?4\.3\b/i.test(trimmed) || /d[áâ]nh\s+gi[áa]|danh\s+gia/i.test(trimmed)) {
      in43 = true;
    }

    // Look for the signature table in 4.3 directly
    if (in43 && trimmed.startsWith("|") && /c[áâ]n\s+b[ộo]\s+h[ưúu]ớng\s+dẫn|c[áâ]n\s+b[ộo]\s+huong\s+dan/i.test(trimmed)) {
      seen43Signature = true;
    }

    // If we've seen the signature block, we stop keeping lines as soon as the table ends
    if (seen43Signature) {
      if (!trimmed.startsWith("|") && trimmed !== "") {
        // If we hit a new major section heading, we can resume keeping lines
        if (trimmed.startsWith("#")) {
          seen43Signature = false;
          stopKeeping = false;
          in43 = false;
        } else {
          stopKeeping = true;
        }
      }
    }

    if (!stopKeeping) {
      cleanLines.push(line);
    }
  }
  return cleanLines.join("\n");
}

function shouldExcludeReferences(title = "", content = "") {
  const normalizedText = String((title || "") + " " + (content || "")).toLowerCase();
  return (
    normalizedText.includes("ba49") ||
    normalizedText.includes("b49") ||
    normalizedText.includes("kiến tập") ||
    normalizedText.includes("định hướng nghề nghiệp") ||
    normalizedText.includes("career orientation") ||
    normalizedText.includes("sl06") ||
    normalizedText.includes("sl07") ||
    normalizedText.includes("el67")
  );
}

function generateEvaluationForm(meta) {
  const majorText = meta.major && !meta.major.includes("...") ? meta.major : "Quản trị kinh doanh";
  const courseText = meta.courseId && !meta.courseId.includes("...") ? meta.courseId : "Trung tâm Đào tạo trực tuyến - Trường Đại học Mở Hà Nội";
  const durationText = meta.internshipDuration && !meta.internshipDuration.includes("...") ? meta.internshipDuration : "Từ ngày 01 tháng 06 năm 2026 đến ngày 30 tháng 06 năm 2026";
  const yearText = "2026";

  return `[PAGE_BREAK]

<center>

**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**
**Độc lập - Tự do - Hạnh phúc**
**---------------***---------------**

</center>

<center>

## NHẬN XÉT KIẾN TẬP

</center>

Họ và tên sinh viên: ${meta.studentName}
Ngày sinh: ${meta.dob}
Lớp: ${meta.class}
Ngành đào tạo: ${majorText}
Đơn vị đào tạo: ${courseText}
Kiến tập tại: ${meta.company}
Địa chỉ: ............................................................................
Người hướng dẫn kiến tập: ${meta.advisor}
Chức vụ: ${meta.advisorRole}
SĐT: ........................................
Thời gian kiến tập: ${durationText}

**1-Các nội dung kiến tập:**
......................................................................................................................................................
......................................................................................................................................................
......................................................................................................................................................

**2-Tinh thần, thái độ, ý thức kiến tập:**
......................................................................................................................................................
......................................................................................................................................................
......................................................................................................................................................

| | |
| :--- | :--- |
| | ......, ngày    tháng   năm ${yearText} |
| **Cán bộ hướng dẫn Kiến tập** | **Xác nhận của đơn vị kiến tập** |
| *(Kí tên và ghi rõ họ tên)* | *(Kí tên, đóng dấu và ghi rõ họ tên)* |
`;
}

function getReportTitleWithDownloadCounter() {
  if (typeof window === "undefined") return "Báo cáo hoàn chỉnh";
  try {
    const now = new Date();
    const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const countKey = `report_download_count_${dateKey}`;
    let count = parseInt(localStorage.getItem(countKey) || "0", 10);
    if (count === 0) {
      count = 1;
      localStorage.setItem(countKey, "1");
    }
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `bc_${count}_${dd}_${mm}_${yyyy}`;
  } catch (e) {
    const now = new Date();
    return `bc_1_${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  }
}

function prepareReportContent(content, title = "", isDocx = false) {
  if (!content) return "";
  let cleanedContent = stripTrailingProseAfterSignature(content, title);
  cleanedContent = cleanedContent.replace(/\|\s*([^|]*?xác\s+nhận\s+của\s+cơ\s+quan[^|]*?)\s*\|/gi, "| **XÁC NHẬN CỦA CƠ QUAN**<br>*(Kí tên và đóng dấu)* |");

  if (shouldExcludeReferences(title, content)) {
    cleanedContent = cleanedContent.replace(/\[PAGE_BREAK\]\s*(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
    cleanedContent = cleanedContent.replace(/(?:#+\s*(?:danh\s+mục\s+)?tài\s+liệu\s+tham\s+khảo[\s\S]*)$/i, "");
  }

  const isBa49 = title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    title.toLowerCase().includes("kiến tập") ||
    content.toLowerCase().includes("ba49") ||
    content.toLowerCase().includes("b49") ||
    content.toLowerCase().includes("kiến tập");

  // Remove lines that literally say "no text", "[no text]", etc. or contain only non-alphanumeric formatting symbols, or are completely empty
  cleanedContent = cleanedContent
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return !isDocx; // Keep empty lines only if NOT docx!

      // Keep markdown table lines (starts and ends with '|')
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) return true;

      // Keep markdown code blocks (starts with ```)
      if (trimmed.startsWith("```")) return true;

      // If it is a valid horizontal rule, keep it
      if (/^[-*_]{3,}$/.test(trimmed)) return true;

      const cleanLine = trimmed
        .replace(/^[-*+•#\s|]+|[-*+•\s|]+$/g, "")
        .replace(/[\[\]()]/g, "")
        .trim();

      // Check if the cleaned line has any alphanumeric characters (Vietnamese included)
      const hasAlphanumeric = /[a-zA-Z0-9\u00C0-\u1EF9]/u.test(cleanLine);
      if (!hasAlphanumeric) {
        return false; // Remove line with no alphanumeric content (e.g. lone '|', '-', etc.)
      }

      const lower = cleanLine.toLowerCase();
      return lower !== "no text" &&
        lower !== "no_text" &&
        lower !== "notext" &&
        lower !== "no content" &&
        lower !== "no_content" &&
        lower !== "nocontent";
    })
    .map((line) => {
      const trimmed = line.trim();

      // Strip bold markers inside Heading 3 (###) to keep it strictly italic
      if (trimmed.startsWith("###")) {
        return line.replace(/\*\*/g, "");
      }

      // Check for table captions (e.g., "Bảng 1.1:...", "Bảng 1:...") -> Bold
      if (/^\s*(?:Bảng|BẢNG)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
        return `**${cleanText}**`;
      }

      // Check for image/chart captions (e.g., "Hình 1.1:...", "Hình 1:...", "Sơ đồ 1.1:...", "Biểu đồ 1.1:...") -> Italic
      if (/^\s*(?:Hình|HÌNH|Sơ đồ|SƠ ĐỒ|Biểu đồ|BIỂU ĐỒ)\s+\d+(?:\.\d+)*[:.-]?\s+\S/i.test(trimmed)) {
        const cleanText = trimmed.replace(/^\*|\*$/g, "").replace(/^\*\*|\*\*$/g, "").trim();
        return `*${cleanText}*`;
      }

      // Normalize paragraph indentation: convert combinations of tabs and spaces to a single tab
      const isHeader = trimmed.startsWith("#");
      const isList = /^(?:[-*•+]|\d+[.)])\s/.test(trimmed);
      const isTable = trimmed.startsWith("|");
      const isCode = trimmed.startsWith("```");
      const isPageBreak = trimmed.toUpperCase() === "[PAGE_BREAK]";
      const isHtml = trimmed.startsWith("<");

      if (isHtml) {
        return trimmed;
      }

      if (!isHeader && !isList && !isTable && !isCode && !isPageBreak && !isHtml && trimmed) {
        if (/^[\t ]+/.test(line)) {
          return line.replace(/^[\t ]+/, "\t");
        }
      }

      return line;
    })
    .join("\n");

  if (isBa49 && !cleanedContent.includes("NHẬN XÉT KIẾN TẬP")) {
    const meta = extractMetadataFromContent(content, title);
    cleanedContent = cleanedContent.trim() + "\n" + generateEvaluationForm(meta);
  }

  const contentWithCover = injectCoverPage(cleanedContent, title);
  let finalContent = ensurePageBreakBeforeReferences(
    ensurePageBreakBeforeConclusion(
      removePageBreaksAfterHeadingOnly(
        normalizeNumberedHeadingLevels(
          normalizeMajorHeadingLevels(
            mergeDuplicateReferenceSections(
              stripDuplicateAdjacentDisplayLines(
                stripStandaloneSeparatorLines(stripSupabaseReportLinks(contentWithCover)),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  if (isDocx) {
    return finalContent.replace(/\n+/g, "\n");
  }

  finalContent = finalContent.replace(/\n{2,}/g, "\n\n");

  // Dynamically restore/insert a blank line before and after tables
  const lines = finalContent.split("\n");
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const prev = lines[i - 1];

    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (prev !== undefined && !(prev.trim().startsWith("|") && prev.trim().endsWith("|")) && prev.trim() !== "") {
        processedLines.push("");
      }
    }

    processedLines.push(current);

    const next = lines[i + 1];
    if (current.trim().startsWith("|") && current.trim().endsWith("|")) {
      if (next !== undefined && !(next.trim().startsWith("|") && next.trim().endsWith("|")) && next.trim() !== "") {
        processedLines.push("");
      }
    }
  }
  return processedLines.join("\n");
}

function isB49OpeningSection(section) {
  const reportContext = section?.reportContext || null;
  if (!reportContext?.internshipReport && !reportContext?.careerOrientationReport) return false;
  const normalizedTitle = normalizeForMatch(String(section?.title || ""));
  return /^\s*(?:loi mo dau|phan mo dau|mo dau|i phan mo dau)\b/.test(normalizedTitle);
}

// Only internship B49 opening sections need preamble stripping;
// career orientation "I. PHẦN MỞ ĐẦU" has real content (1.1, 1.2, 1.3 subsections).
function isB49InternshipOpeningSection(section) {
  const reportContext = section?.reportContext || null;
  if (!reportContext?.internshipReport) return false;
  const normalizedTitle = normalizeForMatch(String(section?.title || ""));
  return /^\s*(?:loi mo dau|phan mo dau|mo dau|i phan mo dau)\b/.test(normalizedTitle);
}

function stripB49OpeningPreamble(content) {
  const lines = textValue(content).split(/\r?\n/);
  const firstSubsectionIdx = lines.findIndex((line) =>
    /^\s*(?:#{1,6}\s*)?\d+(?:\.\d+)+\.?\s+\S/.test(line.trim()),
  );

  if (firstSubsectionIdx < 0) return "";
  return lines.slice(firstSubsectionIdx).join("\n").trim();
}

function isHeadingOnlyReportBlock(block) {
  const meaningfulLines = textValue(block)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (meaningfulLines.length === 0 || meaningfulLines.length > 3) return false;
  return meaningfulLines.every((line) => {
    if (line.toUpperCase() === "[PAGE_BREAK]") return true;
    return (
      isMajorSectionHeadingLine(line) ||
      /^#{1,6}\s+/.test(line) ||
      /^\*\*(.+?)\*\*:?\s*$/.test(line)
    );
  });
}

function paginateReportContent(content, charsPerPage = 5000) {
  const prepared = injectSectionPageBreaks(content);
  const manualSections = prepared.includes("[PAGE_BREAK]")
    ? prepared
      .split("[PAGE_BREAK]")
      .map((p) => p.trim())
      .filter(Boolean)
    : [prepared.trim()].filter(Boolean);

  const pages = [];
  for (const section of manualSections) {
    const rawBlocks = section
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const blocks = [];
    for (let idx = 0; idx < rawBlocks.length; idx += 1) {
      const block = rawBlocks[idx];
      const firstLine =
        block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) || "";
      if (isReferenceHeadingLine(firstLine) && rawBlocks[idx + 1]) {
        blocks.push(`${block}\n${rawBlocks[idx + 1]}`);
        idx += 1;
      } else {
        blocks.push(block);
      }
    }
    let page = "";

    for (const block of blocks) {
      const chapterStart = isMajorSectionHeadingLine(
        textValue(block)
          .split(/\r?\n/)
          .find((line) => line.trim()) || "",
      );
      if (page && chapterStart) {
        pages.push(page.trim());
        page = block;
        continue;
      }

      const next = page ? `${page}\n\n${block}` : block;
      if (page && next.length > charsPerPage) {
        if (isHeadingOnlyReportBlock(page)) {
          page = next;
        } else {
          pages.push(page.trim());
          page = block;
        }
      } else {
        page = next;
      }
    }

    if (page.trim()) pages.push(page.trim());
  }

  return pages.length > 0 ? pages : [""];
}

function prepareReportContentForDocx(content, title = "") {
  // Inject page breaks before major sections (chapters) for DOCX export
  const withPageBreaks = injectSectionPageBreaks(content);
  return prepareReportContent(withPageBreaks, title, true);
}

function normalizeMarkdownTables(content) {
  const lines = textValue(content).split(/\r?\n/);
  return lines
    .map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      const separatorOnly =
        cells.length > 0 && cells.every((cell) => /^[\s:-]+$/.test(cell));
      if (!separatorOnly) return line;

      const prev = lines[idx - 1]?.trim() || "";
      const prevCellCount =
        prev.startsWith("|") && prev.endsWith("|")
          ? prev.split("|").slice(1, -1).length
          : cells.length;

      return `| ${Array.from({ length: Math.max(prevCellCount, 1) }, () => "---").join(" | ")} |`;
    })
    .join("\n");
}

function makeTitle(text = "") {
  const t = textValue(text).replace(/\s+/g, " ").trim();
  return t ? (t.length > 48 ? t.slice(0, 48) + "…" : t) : "New Chat";
}

function relTime(iso) {
  if (!iso) return "now";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

const ATTACHMENT_TEXT_EXT_RE =
  /\.(txt|json|csv|md|js|ts|tsx|jsx|py|html|css|yaml|yml|xml|sh|log|ini|toml|env)$/i;

function isImageAttachment(file) {
  return String(file?.type || "").startsWith("image/");
}

function isPdfAttachment(file) {
  return (
    /\.pdf$/i.test(String(file?.name || "")) ||
    String(file?.type || "").toLowerCase() === "application/pdf"
  );
}

function isDocxAttachment(file) {
  return (
    /\.docx$/i.test(String(file?.name || "")) ||
    String(file?.type || "").toLowerCase() ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isTextAttachment(file) {
  return (
    String(file?.type || "").startsWith("text/") ||
    ATTACHMENT_TEXT_EXT_RE.test(String(file?.name || ""))
  );
}

async function fileFromAttachmentMeta(file) {
  if (file?.file instanceof File || file?.file instanceof Blob) {
    return file.file;
  }

  if (!file?.url) return null;
  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(`Không thể tải nội dung tệp (${response.status})`);
  }

  const blob = await response.blob();
  return new File([blob], file.name || "attachment", {
    type: file.type || blob.type || "",
  });
}

async function extractAttachmentContent(file) {
  if (!file || isImageAttachment(file)) {
    return { content: "", pageCount: 0 };
  }

  const sourceFile = await fileFromAttachmentMeta(file);
  if (!sourceFile) {
    return { content: "", pageCount: 0 };
  }

  if (isPdfAttachment(file) || String(sourceFile.type || "").includes("pdf")) {
    const result = await parsePdfText(sourceFile);
    return { content: result.text || "", pageCount: result.pageCount || 0 };
  }

  if (isDocxAttachment(file)) {
    const result = await parseDocxText(sourceFile);
    return { content: result.text || "", pageCount: result.pageCount || 0 };
  }

  if (isTextAttachment(file) || String(sourceFile.type || "").startsWith("text/")) {
    if (typeof sourceFile.text === "function") {
      return { content: (await sourceFile.text()) || "", pageCount: 1 };
    }
    const content = await readTextFile(sourceFile);
    return { content: content || "", pageCount: 1 };
  }

  return { content: "", pageCount: 0 };
}

async function buildSerializedAttachments(files) {
  const list = Array.isArray(files) ? files : [];
  const serialized = await Promise.all(
    list.map(async (file) => {
      const base = {
        name: file.name,
        type: file.type,
        size: file.size,
      };

      if (isImageAttachment(file)) {
        return file.url ? { ...base, url: file.url } : base;
      }

      try {
        const extracted = await extractAttachmentContent(file);
        return {
          ...base,
          content: extracted.content || "",
          pageCount: extracted.pageCount || 0,
        };
      } catch (err) {
        console.error("Error extracting attachment content:", file.name, err);
        return base;
      }
    }),
  );

  return serialized;
}

async function buildContentWithAttachments(baseText, files) {
  const list = Array.isArray(files) ? files : [];
  const imageFiles = list.filter(isImageAttachment);
  const nonImageFiles = list.filter((file) => !isImageAttachment(file));

  let finalContent = String(baseText || "");

  if (imageFiles.length > 1) {
    const multiImageInstruction = `[HƯỚNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghép lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
    finalContent = `${multiImageInstruction}${finalContent ? `\n${finalContent}` : ""}`;
  }

  if (nonImageFiles.length > 0) {
    finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
    for (const file of nonImageFiles) {
      let content = String(file?.content || "").trim();
      if (!content) {
        try {
          const extracted = await extractAttachmentContent(file);
          content = String(extracted.content || "").trim();
        } catch (err) {
          console.error("Error re-extracting attachment content:", file?.name, err);
        }
      }

      finalContent += `\n[${file?.name || "attachment"}]`;
      if (content) {
        finalContent += `\n${content}`;
      }
    }
    finalContent += "\n------------------------";
  }

  if (imageFiles.length === 0) {
    return finalContent;
  }

  const parts = [{ type: "text", text: finalContent }];
  for (const img of imageFiles) {
    if (img?.url) {
      parts.push({ type: "image_url", image_url: { url: img.url } });
    }
  }
  return parts;
}

function removeVietnameseTones(str) {
  if (typeof str !== "string") return "";
  let s = str;
  s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  s = s.replace(/đ/g, "d");
  s = s.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  s = s.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  s = s.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  s = s.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  s = s.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  s = s.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  s = s.replace(/Đ/g, "D");
  s = s.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  s = s.replace(/\u02C6|\u0306|\u031B/g, "");
  return s;
}

function cleanWebSearchQuery(text) {
  if (!text) return "";
  let clean = textValue(text)
    .replace(
      /\b(tao|viet|lap|lam|xuat|soan|create|generate|write|make)\b/gi,
      "",
    )
    .replace(/\b(bao cao|report|de cuong|outline)\b/gi, "")
    .replace(
      /\b(can|muon|xin|hay|giup(?: toi| minh)?|cho toi|cho minh)\b/gi,
      "",
    )
    .replace(/\b(dai|length|khoang)\s+\d+\s*(trang|pages?)\b/gi, "")
    .replace(/\b(ve|about|cho|for)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || text;
}

function sanitizeStoragePathSegment(str) {
  if (typeof str !== "string") return "";
  let ascii = removeVietnameseTones(str);
  ascii = ascii.replace(/[^a-zA-Z0-9\s\-\_\.]/g, "");
  ascii = ascii.replace(/\s+/g, " ").trim();
  return ascii;
}

function printReportDoc(title, htmlContent) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(
    "<html>" +
    "<head>" +
    "<title>" +
    title +
    "</title>" +
    "<style>" +
    `@page { size: ${A4_PAGE_WIDTH} ${A4_PAGE_HEIGHT}; margin: ${A4_MARGIN_TOP} ${A4_MARGIN_RIGHT} ${A4_MARGIN_BOTTOM} ${A4_MARGIN_LEFT}; }` +
    "html, body { margin: 0; padding: 0; }" +
    "body {" +
    "font-family: 'Times New Roman', Times, serif;" +
    "font-size: 13pt;" +
    "line-height: 1.5;" +
    "color: #000;" +
    "}" +
    "h1 { text-align: center; text-transform: uppercase; font-size: 1.75em; margin-bottom: 1.2em; }" +
    "h2, h3, h4 { font-size: 13pt; line-height: 1.5; margin-top: 1.2em; margin-bottom: 0.6em; }" +
    "h2, h4 { font-weight: bold; }" +
    "h3 { font-weight: normal; font-style: italic; }" +
    ".report-view > p { text-align: justify; text-indent: 1.25cm; margin: 0.8em 0; }" +
    ".report-view > p:has(> strong:first-child) { text-indent: 0; }" +
    "li p { text-indent: 0; margin: 0; }" +
    "table:not(.borderless) { width: 100%; border-collapse: collapse; margin: 1.2em 0; }" +
    "table:not(.borderless) th, table:not(.borderless) td { border: 1px solid #000; padding: 8px 12px; }" +
    "table.borderless { width: 100%; border-collapse: collapse; margin: 1.2em 0; border: none; }" +
    "table.borderless th, table.borderless td { border: none; padding: 8px 12px; background: transparent !important; background-color: transparent !important; }" +
    "table.borderless th { background: transparent !important; background-color: transparent !important; }" +
    "th { font-weight: bold; background-color: #f2f2f2; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="report-view">' +
    htmlContent.replace(/<table>/g, (match, offset, string) => {
      const tableEnd = htmlContent.indexOf("</table>", offset);
      const tableContent = htmlContent.slice(offset, tableEnd);
      if (isSignatureTable(tableContent)) {
        return '<table class="borderless">';
      }
      return '<table>';
    }) +
    "</div>" +
    "</body>" +
    "</html>",
  );
  printWindow.document.close();
  printWindow.print();
}

// Load JSZip from CDN (once)
async function loadJSZip() {
  if (typeof window !== "undefined" && window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error("Cannot load JSZip"));
    document.head.appendChild(s);
  });
}

// Escape XML special characters
function escXml(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toRuns(text) {
  if (!text) return "";
  // Split on ***bold-italic***, **bold**, *italic*
  const parts = text.split(
    /(\*\*\*(?:[^*]|\*(?!\*\*))+\*\*\*|\*\*(?:[^*]|\*(?!\*))+\*\*|\*(?:[^*\n]+)\*)/g,
  );
  return parts
    .map((p) => {
      if (!p) return "";
      if (p.startsWith("***") && p.endsWith("***") && p.length > 6)
        return `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(3, -3))}</w:t></w:r>`;
      if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
        return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(2, -2))}</w:t></w:r>`;
      if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
        return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${escXml(p.slice(1, -1))}</w:t></w:r>`;
      return `<w:r><w:t xml:space="preserve">${escXml(p)}</w:t></w:r>`;
    })
    .join("");
}

// Pre-process markdown+HTML content before OOXML conversion:
// strips <br>, converts <center>...</center> to center-marker, strips other HTML tags
const DOCX_CENTER = "\u0002CENTER\u0002";
function preprocessForDocx(content) {
  let text = normalizeMarkdownTables(content);
  // <center>...</center> → mark each non-empty inner line as centered
  text = text.replace(/<center>([\s\S]*?)<\/center>/gi, (_, inner) =>
    inner
      .split("\n")
      .map((l) => {
        const t = l.trim();
        return t ? `${DOCX_CENTER}${t}` : "";
      })
      .join("\n"),
  );
  // Replace <br> / <br/> with newline, except when they are within table rows.
  // To do this simply, we replace <br> with a temporary token if they are inside `|` lines,
  // then do the normal replace, then restore them inside cell strings before table split.
  text = text.split("\n").map(line => {
    if (line.trim().startsWith("|")) {
      return line.replace(/<br\s*\/?>/gi, "DOCXCELLBREAKTOKEN");
    }
    return line.replace(/<br\s*\/?>/gi, "\n");
  }).join("\n");

  // <hr> is removed so DOCX matches preview/copy output
  text = text.replace(/<hr\s*\/?>/gi, "\n");
  // strip all remaining HTML tags
  text = text.replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "");
  // collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Remove blank lines immediately before or after [PAGE_BREAK] to prevent empty pages in Word
  text = text.replace(/\n+(?=\s*\[PAGE_BREAK\])/gi, "\n");
  text = text.replace(/(?<=\[PAGE_BREAK\])\s*\n+/gi, "\n");
  // Collapse consecutive [PAGE_BREAK] markers (possibly separated by whitespace/newlines) into one
  text = text.replace(/(\[PAGE_BREAK\](\s*\n)*\s*)+\[PAGE_BREAK\]/gi, "[PAGE_BREAK]");
  return text;
}

// Returns true ONLY for real signature/approval tables (BA49 NHAN XET KIEN TAP sign-off block).
// Must contain BOTH a role keyword AND a sign-action keyword to avoid false positives on data tables.
function isSignatureTable(tableTextContent) {
  const raw = String(tableTextContent || "").toLowerCase();
  // Normalize Vietnamese diacritics for robust matching
  const norm = raw
    .replace(/[\u00e0\u00e1\u1ea1\u1ea3\u00e3\u00e2\u1ea7\u1ea5\u1ead\u1ea9\u1eab\u0103\u1eb1\u1eaf\u1eb7\u1eb3\u1eb5]/g, "a")
    .replace(/[\u00e8\u00e9\u1eb9\u1ebb\u1ebd\u00ea\u1ec1\u1ebf\u1ec7\u1ec3\u1ec5]/g, "e")
    .replace(/[\u00ec\u00ed\u1ecb\u1ec9\u0129]/g, "i")
    .replace(/[\u00f2\u00f3\u1ecd\u1ecf\u00f5\u00f4\u1ed3\u1ed1\u1ed9\u1ed5\u1ed7\u01a1\u1edd\u1edb\u1ee3\u1edf\u1ee1]/g, "o")
    .replace(/[\u00f9\u00fa\u1ee5\u1ee7\u0169\u01b0\u1eeb\u1ee9\u1ef1\u1eed\u1eef]/g, "u")
    .replace(/[\u1ef3\u00fd\u1ef5\u1ef7\u1ef9]/g, "y")
    .replace(/\u0111/g, "d");
  // Must have a sign action (kí tên / ký tên / chữ ký / đóng dấu / kí và ghi rõ họ tên / ký và ghi rõ họ tên)
  const hasSignAction = /(?:ky|ki)\s+ten|dong\s+dau|chu\s+(?:ky|ki)|ki\s+va\s+ghi\s+ro|ky\s+va\s+ghi\s+ro/.test(norm);
  // Must have an authority/role keyword (xác nhận, cán bộ hướng dẫn, cbhd, cơ quan, vv.)
  const hasAuthRole = /xac\s+nhan|can\s+bo\s+huong\s+dan|nguoi\s+huong\s+dan|don\s+vi\s+kien\s+tap|cbhd|nguoi\s+xac\s+nhan|co\s+quan|giang\s+vien|can\s+bo|chuc\s+vu|co\s+quan\s+thuc\s+tap/.test(norm);
  return hasSignAction && hasAuthRole;
}
// Render collected table rows as a proper OOXML <w:tbl> element
function tableRowsToOoxml(rows) {
  if (!rows.length) return "";
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(9071 / colCount);

  // Use isSignatureTable() which requires BOTH a sign action AND authority role keyword
  const isBorderless = isSignatureTable(rows.flat().join(" "));

  const bdrVal = isBorderless ? "nil" : "single";
  const bdrColor = isBorderless ? "auto" : "000000";
  const bdrSz = isBorderless ? "0" : "4";
  const bdr = `w:val="${bdrVal}" w:sz="${bdrSz}" w:space="0" w:color="${bdrColor}"`;

  let xml = `<w:tbl><w:tblPr>
    <w:tblW w:w="9071" w:type="dxa"/>
    <w:jc w:val="center"/>
    <w:tblBorders>
      <w:top ${bdr}/><w:left ${bdr}/><w:bottom ${bdr}/>
      <w:right ${bdr}/><w:insideH ${bdr}/><w:insideV ${bdr}/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>`;
  rows.forEach((row, rowIdx) => {
    const isHeader = rowIdx === 0;
    xml += `<w:tr>`;
    for (let c = 0; c < colCount; c++) {
      let cellText = row[c] || "";
      // Restore cell breaks and split into paragraphs
      cellText = cellText.replace(/DOCXCELLBREAKTOKEN/g, "\n");
      const cellParagraphs = cellText.split("\n").map(p => p.trim());

      xml += `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${(isHeader && !isBorderless) ? '<w:shd w:val="clear" w:color="auto" w:fill="E8E8E8"/>' : ""}</w:tcPr>`;

      cellParagraphs.forEach(paraText => {
        const alignCenter = isHeader || isBorderless;
        xml += `<w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/>${alignCenter ? '<w:jc w:val="center"/>' : ""}</w:pPr>${isHeader
          ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(paraText.replace(/\*\*/g, ""))}</w:t></w:r>`
          : toRuns(paraText)
          }</w:p>`;
      });

      xml += `</w:tc>`;
    }
    xml += `</w:tr>`;
  });
  xml += `</w:tbl>`;
  return xml;
}

// Generate structured OOXML for the cover page (from raw text lines or stripped HTML)
function generateCoverPageOoxmlFromLines(coverPart, logoActuallyExists = false) {
  let text = coverPart;

  // Mark logo token
  text = text.replace(/\[LOGO_HOU\]/gi, "LOGOTOKENHOU");
  text = text.replace(/<img[^>]*logo-hou\.png[^>]*>/gi, "LOGOTOKENHOU");
  text = text.replace(/logo-hou\.png/gi, "LOGOTOKENHOU");

  // Strip all other HTML tags
  text = text.replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "");

  // Strip markdown formatting symbols
  text = text.replace(/[*#_`~]/g, "");

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let xml = "";

  const topLines = [];
  let hasLogo = false;
  const titleLines = [];
  const detailLines = [];
  const bottomLines = [];

  let state = "top";

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    if (line.includes("LOGOTOKENHOU")) {
      hasLogo = true;
      state = "title";
      continue;
    }

    const isDetailKeyword = /^(?:cán\s+bộ\s+hướng\s+dẫn|sinh\s+viên\s+thực\s+hiện|ngày\s+sinh|lớp|ngành\s+đào\s+tạo|thời\s+gian\s+thực\s+tập|mã\s+course\s+học|giảng\s+viên\s+hướng\s+dẫn|chức\s+vụ|mã\s+số\s+sinh\s+viên|mssv|họ\s+tên\s+sinh\s+viên|họ\s+tên\s+cán\s+bộ\s+hướng\s+dẫn)(?:\s|:|$)/i.test(line);
    const hasSeparator = line.includes(":") || line.includes("..");
    const isTitleOrHeader = /^(?:báo\s+cáo|học\s+phần|trường\s+đại\s+học|viện\s+đt|trung\s+tâm\s+đào\s+tạo|tại\s+đơn\s+vị)(?:\s|:|$)/i.test(line);

    if ((isDetailKeyword || hasSeparator) && !isTitleOrHeader) {
      if (state !== "top") {
        state = "details";
      }
    }

    if (idx >= lines.length - 2 && (/hà\s+nội/i.test(line) || /năm\s+202/i.test(line) || /^\d{4}$/.test(line))) {
      state = "bottom";
    }

    if (state === "top") {
      topLines.push(line);
    } else if (state === "title") {
      titleLines.push(line);
    } else if (state === "details") {
      detailLines.push(line);
    } else if (state === "bottom") {
      bottomLines.push(line);
    }
  }

  const isBa49 = text.includes("BÁO CÁO KIẾN TẬP THỰC TẾ") || text.includes("VIỆN ĐÀO TẠO VÀ PHÁT TRIỂN HỌC TẬP SUỐT ĐỜI");

  // 1. Top header (centered, bold, 14pt/13pt)
  topLines.forEach((line, index) => {
    const sz = index === 0 ? "28" : "26";
    const underlineElement = (isBa49 && index === 1) ? '<w:u w:val="single"/>' : '';
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/>${underlineElement}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t>${escXml(line)}</w:t></w:r></w:p>`;
  });

  // Line separator under top header
  if (!isBa49) {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="800"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>___________</w:t></w:r></w:p>`;
  } else {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="400"/></w:pPr></w:p>`;
  }

  // 2. Logo HOU
  if (logoActuallyExists && hasLogo) {
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="800"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing"><wp:extent cx="1560000" cy="1800000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1560000" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  } else {
    // If no logo, add vertical spacing to maintain cover page proportions
    xml += `<w:p><w:pPr><w:spacing w:before="1200" w:after="1200"/></w:pPr></w:p>`;
  }

  // 3. Title block (centered, bold, larger size)
  titleLines.forEach((line, index) => {
    const isMainTitle = /báo\s+cáo/i.test(line);
    const sz = isMainTitle ? "36" : "28";
    const before = index === 0 ? "240" : "120";
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="${before}" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t>${escXml(line)}</w:t></w:r></w:p>`;
  });

  // Spacing before details
  xml += `<w:p><w:pPr><w:spacing w:before="600" w:after="0"/></w:pPr></w:p>`;

  // 4. Details block
  if (isBa49 && detailLines.length > 0) {
    const bdr = `w:val="single" w:sz="4" w:space="0" w:color="FFFFFF"`;
    xml += `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="7344" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top ${bdr}/><w:left ${bdr}/><w:bottom ${bdr}/>
          <w:right ${bdr}/><w:insideH ${bdr}/><w:insideV ${bdr}/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/><w:right w:w="160" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>`;

    detailLines.forEach(line => {
      const colonIdx = line.indexOf(":");
      let key = line;
      let val = "";
      if (colonIdx > 0) {
        key = line.slice(0, colonIdx + 1);
        val = line.slice(colonIdx + 1).trim();
      }
      xml += `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2570" w:type="dxa"/>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(key)}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="4774" w:type="dxa"/>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    });
    xml += `</w:tbl>`;
  } else {
    const infoStyle = `<w:pPr><w:ind w:left="1440"/><w:spacing w:before="120" w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>`;
    detailLines.forEach(line => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx + 1);
        const val = line.slice(colonIdx + 1);
        xml += `<w:p>${infoStyle}<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(key)} </w:t></w:r><w:r><w:rPr><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r></w:p>`;
      } else {
        xml += `<w:p>${infoStyle}<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r></w:p>`;
      }
    });
  }

  // 5. Bottom block (centered, bold, year and place)
  const cleanBottomText = bottomLines.join(", ").replace(/HÀ\s+NỘI,\s*/gi, "").trim();
  let spacingXml = "";
  if (isBa49) {
    for (let p = 0; p < 7; p++) {
      spacingXml += `<w:p><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr></w:p>`;
    }
  }
  const bottomBeforeSpacing = isBa49 ? "240" : "3800";
  xml += spacingXml;
  xml += `<w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="${bottomBeforeSpacing}" w:after="0"/>
      <w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701"/>
        <w:pgBorders w:offsetFrom="page">
          <w:top w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:left w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:bottom w:val="double" w:sz="12" w:space="24" w:color="000000"/>
          <w:right w:val="double" w:sz="12" w:space="24" w:color="000000"/>
        </w:pgBorders>
      </w:sectPr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:b/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
      </w:rPr>
      <w:t xml:space="preserve">${escXml(cleanBottomText ? cleanBottomText : "NĂM 2026")}</w:t>
    </w:r>
  </w:p>`;

  return xml;
}

// Convert markdown text to OOXML paragraph list (full-featured)
function mdToOoxml(rawContent, title = "", logoActuallyExists = false) {
  const isCoverPage = rawContent.includes("cover-page-container") ||
    (rawContent.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") && rawContent.indexOf("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") < 1000);

  const isBa49 = title.toLowerCase().includes("ba49") ||
    title.toLowerCase().includes("b49") ||
    title.toLowerCase().includes("kiến tập") ||
    rawContent.toLowerCase().includes("ba49") ||
    rawContent.toLowerCase().includes("b49") ||
    rawContent.toLowerCase().includes("kiến tập");

  if (isCoverPage) {
    const parts = rawContent.split("[PAGE_BREAK]");
    const coverPart = parts[0];
    const remainingPart = parts.slice(1).join("[PAGE_BREAK]");

    const coverOoxml = generateCoverPageOoxmlFromLines(coverPart, logoActuallyExists);
    const remainingOoxml = mdToOoxml(remainingPart, title, logoActuallyExists);

    return coverOoxml + "\n" + remainingOoxml;
  }

  const content = preprocessForDocx(rawContent);
  const lines = content.split("\n");
  const ps = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "[LOGO_HOU]") {
      if (logoActuallyExists) {
        ps.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing"><wp:extent cx="1560000" cy="1800000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1560000" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
        );
      } else {
        ps.push(`<w:p><w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr></w:p>`);
      }
      i++;
      continue;
    }
    // Empty line
    if (!t) {
      ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
      i++;
      continue;
    }
    // Page break — skip blank lines AND duplicate PAGE_BREAKs after to avoid empty pages
    if (t.includes("[PAGE_BREAK]")) {
      ps.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      i++;
      // Consume trailing blank lines and any extra [PAGE_BREAK] tokens after this one
      while (i < lines.length && (
        !lines[i].trim() ||
        lines[i].trim().toUpperCase() === "[PAGE_BREAK]"
      )) i++;
      continue;
    }
    // Centered line (from <center>...</center>)
    if (t.startsWith(DOCX_CENTER)) {
      const ct = t.slice(DOCX_CENTER.length).trim();
      const hm = ct.match(/^(#{1,6})\s+(.+)/);
      if (hm) {
        const lvl = Math.min(hm[1].length, 3);
        const style = ["Heading1", "Heading2", "Heading3"][lvl - 1];
        ps.push(
          `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:jc w:val="center"/><w:keepNext/></w:pPr>${toRuns(hm[2])}</w:p>`,
        );
      } else {
        ps.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>${toRuns(ct)}</w:p>`,
        );
      }
      i++;
      continue;
    }
    // Heading
    const hm = t.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = Math.min(hm[1].length, 3);
      const style = ["Heading1", "Heading2", "Heading3"][lvl - 1];
      ps.push(
        `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:keepNext/></w:pPr>${toRuns(hm[2])}</w:p>`,
      );
      i++;
      continue;
    }
    // Horizontal rule
    if (/^[-*]{3,}$/.test(t)) {
      i++;
      continue;
    }
    const boldOnly = t.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (boldOnly) {
      const isTableCaption = /^(?:Bảng|BẢNG)\s+\d+/i.test(boldOnly[1]);
      ps.push(
        `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr>${isTableCaption ? "<w:r><w:tab/></w:r>" : ""
        }<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(boldOnly[1])}</w:t></w:r></w:p>`,
      );
      i++;
      continue;
    }
    // Table — collect consecutive table lines into a proper OOXML table
    if (t.startsWith("|")) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
        if (!/^[|:\s\-]+$/.test(row)) {
          // skip separator rows |---|---|
          tableRows.push(
            row
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim()),
          );
        }
        i++;
      }
      if (tableRows.length) {
        ps.push(tableRowsToOoxml(tableRows));
        ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
      }
      continue;
    }
    // Unordered list
    const ul = t.match(/^[-*•]\s+(.+)/);
    if (ul) {
      ps.push(
        `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="0"/></w:pPr>${toRuns(ul[1])}</w:p>`,
      );
      i++;
      continue;
    }
    // Ordered list
    const ol = t.match(/^(\d+)[.):]\s+(.+)/);
    if (ol) {
      ps.push(
        `<w:p><w:pPr><w:ind w:left="360"/><w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>${toRuns(ol[1] + ". " + ol[2])}</w:p>`,
      );
      i++;
      continue;
    }
    // Normal paragraph — justify + tab character + 1.5 line spacing
    ps.push(
      `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:before="0" w:after="160" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:tab/></w:r>${toRuns(t)}</w:p>`,
    );
    i++;
  }
  return ps.join("\n");
}

// Copy report content as rich HTML (for paste into Word/Google Docs with formatting)
async function copyReportRichText(rawContent, title = "") {
  const preparedContent = prepareReportContent(rawContent, title);
  // Strip HTML tags for clean plain text version
  const plainText = preparedContent
    .replace(/\[PAGE_BREAK\]/g, "\n\n")
    .replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();

  const formattedHtml = renderMarkdownAndMath(preparedContent).replace(
    /\[PAGE_BREAK\]/g,
    '<div style="page-break-after: always; break-after: page;"></div>',
  );

  // Build HTML version
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{size:${A4_PAGE_WIDTH} ${A4_PAGE_HEIGHT};margin:${A4_MARGIN_TOP} ${A4_MARGIN_RIGHT} ${A4_MARGIN_BOTTOM} ${A4_MARGIN_LEFT};}
    html,body{margin:0;padding:0;}
    body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;color:#000;}
    h1{font-size:1.75em;font-weight:bold;text-align:center;text-transform:uppercase;margin:1.2em 0 0.6em;}
    h2{font-size:1.4em;font-weight:bold;margin:1em 0 0.5em;}
    h3{font-size:1.2em;font-weight:bold;margin:0.9em 0 0.4em;}
    body > p{text-align:justify;text-indent:1.25cm;margin:0.6em 0;}
    body > p:has(> strong:first-child){text-indent:0;}
    li p{text-indent:0;margin:0;}
    table:not(.borderless){border-collapse:collapse;width:100%;margin:1em 0;}
    table:not(.borderless) th, table:not(.borderless) td{border:1px solid #000;padding:6px 10px;font-size:14px;}
    table.borderless{border-collapse:collapse;width:100%;margin:1em 0;border:none;}
    table.borderless th, table.borderless td{border:none;padding:6px 10px;font-size:14px;background:transparent !important;background-color:transparent !important;}
    table.borderless th{background:transparent !important;background-color:transparent !important;}
    th{background:#f2f2f2;font-weight:bold;text-align:center;}
    hr{border:none;border-top:1px solid #000;margin:1em 0;}
    ul{padding-left:2em;margin:0.5em 0;}ol{padding-left:2em;margin:0.5em 0;}
    em{font-style:italic;}strong{font-weight:bold;}
  </style></head><body>${formattedHtml.replace(/<table>/g, (match, offset, string) => {
    // Check if the table markdown block contains signature/borderless keywords
    const tableEnd = formattedHtml.indexOf("</table>", offset);
    const tableContent = formattedHtml.slice(offset, tableEnd);
    if (isSignatureTable(tableContent)) {
      return '<table class="borderless">';
    }
    return '<table>';
  })}</body></html>`;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([htmlContent], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    // Fallback: copy clean plain text
    await navigator.clipboard.writeText(plainText);
    return false;
  }
}

// Generate and download a real .docx file (Office Open XML)
async function dlDocx(content, filename) {
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const PKGREL =
      "http://schemas.openxmlformats.org/package/2006/relationships";
    const OFFREL =
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    // [Content_Types].xml
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Default Extension="png"  ContentType="image/png"/>
  <Override PartName="/word/document.xml"  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`,
    );

    // _rels/.rels
    zip.folder("_rels").file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );

    const word = zip.folder("word");

    const docxContent = prepareReportContentForDocx(content, filename);

    // word/_rels/document.xml.rels
    let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/styles"    Target="styles.xml"/>
  <Relationship Id="rId2" Type="${OFFREL}/numbering" Target="numbering.xml"/>
</Relationships>`;

    word.folder("_rels").file("document.xml.rels", relsXml);

    // word/document.xml
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const WP = "http://schemas.openxmlformats.org/wordprocessingml/2006/wordprocessingDrawing";
    const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

    word.file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}">
  <w:body>
${mdToOoxml(docxContent, filename, false)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701"/>
    </w:sectPr>
  </w:body>
</w:document>`,
    );

    // word/styles.xml
    word.file(
      "styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
    <w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`,
    );

    // word/numbering.xml (bullet + decimal)
    word.file(
      "numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">
    <w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
    <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
    <w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
    <w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr>
  </w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`,
    );

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);

    try {
      const now = new Date();
      const dateKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
      const countKey = `report_download_count_${dateKey}`;
      const currentCount = parseInt(localStorage.getItem(countKey) || "1", 10);
      localStorage.setItem(countKey, String(currentCount + 1));
    } catch (e) {
      console.error("Failed to increment download count:", e);
    }

    return true;
  } catch (err) {
    console.error("docx generation failed:", err);
    return false;
  }
}

// ─── Markdown and Math helper ───
function renderMarkdownAndMath(text) {
  if (typeof text !== "string") return "";

  text = text.replace(/\[LOGO_HOU\]/g, '<div style="display:flex;justify-content:center;align-items:center;width:100%;margin:1.5cm 0;"><img src="/logo-hou.png" style="width:110px;height:auto;" alt="HOU Logo" /></div>');

  // Pre-render <center>...</center> so marked doesn't ignore markdown inside it
  text = text.replace(/<center>([\s\S]*?)<\/center>/gi, (match, p1) => {
    try {
      const innerHtml = marked.parse(p1.trim(), { gfm: true, breaks: true });
      return `<div style="text-align: center;">${innerHtml}</div>`;
    } catch (err) {
      return `<div style="text-align: center;">${p1}</div>`;
    }
  });

  const mathBlocks = [];
  text = normalizeMarkdownTables(text);

  // 1. Extract block math: \[ ... \]
  let processedText = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, math) => {
    const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: true, placeholder });
    return placeholder;
  });

  // 2. Extract block math: $$ ... $$
  processedText = processedText.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (match, math) => {
      const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
      mathBlocks.push({ math: math.trim(), isBlock: true, placeholder });
      return placeholder;
    },
  );

  // 3. Extract inline math: \( ... \) (double-escaped and single-escaped)
  processedText = processedText.replace(
    /\\\\\(([\s\S]+?)\\\\\)/g,
    (match, math) => {
      const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
      mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
      return placeholder;
    },
  );
  processedText = processedText.replace(
    /\\\(([\s\S]+?)\\\)/g,
    (match, math) => {
      const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
      mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
      return placeholder;
    },
  );

  // 4. Extract inline math: $ ... $
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    if (!math.trim()) return match;
    const placeholder = `MATHINLINEPLACEHOLDER${mathBlocks.length}`;
    mathBlocks.push({ math: math.trim(), isBlock: false, placeholder });
    return placeholder;
  });

  processedText = processedText.replace(/^\s*•\s+/gm, "- ");

  // 5. Render Markdown using marked
  let html = "";
  try {
    html = marked.parse(processedText, {
      gfm: true,
      breaks: true,
    });
  } catch (err) {
    console.error("Marked parsing error:", err);
    html = processedText;
  }

  // 6. Restore math blocks and render them with KaTeX
  for (const item of mathBlocks) {
    try {
      const mathHtml = katex.renderToString(item.math, {
        displayMode: item.isBlock,
        throwOnError: false,
      });
      html = html.replace(item.placeholder, mathHtml);
    } catch (e) {
      console.error("KaTeX rendering error:", e);
      html = html.replace(
        item.placeholder,
        `<span class="text-red-500 font-mono">${item.math}</span>`,
      );
    }
  }

  // 7. Mark borderless tables (signature tables)
  html = html.replace(/<table>/g, (match, offset, string) => {
    const tableEnd = html.indexOf("</table>", offset);
    const tableContent = html.slice(offset, tableEnd);
    if (isSignatureTable(tableContent)) {
      return '<table class="borderless">';
    }
    return '<table>';
  });

  // 8. Add indentation to table captions (starting with "Bảng" or "BẢNG")
  html = html.replace(/<p><strong>((?:Bảng|BẢNG)\s+\d+[^<]*)<\/strong><\/p>/gi, '<p style="text-indent: 1.25cm !important;"><strong>$1</strong></p>');

  return html;
}

function handlePrintReport(title, content) {
  const htmlContent = renderMarkdownAndMath(prepareReportContent(content, title));
  printReportDoc(title, htmlContent);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, className }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => { });
      }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] font-medium transition-all",
        "border border-border text-text-muted hover:text-text-main hover:border-brand-500/40 hover:bg-bg",
        copied &&
        "text-green-600 border-green-500/30 bg-green-50 dark:bg-green-950/30",
        className,
      )}
    >
      <span className="material-symbols-outlined text-[13px]">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 size-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-[var(--shadow-warm)]">
      <span className="material-symbols-outlined text-white text-[14px]">
        description
      </span>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex-shrink-0 size-7 rounded-full bg-surface-2 border border-border flex items-center justify-center">
      <span className="material-symbols-outlined text-text-muted text-[14px]">
        person
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-text-muted"
          style={{ animation: `asstDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

function MessageFilesGrid({ files }) {
  const images = files.filter((f) => f.type?.startsWith("image/"));
  const nonImages = files.filter((f) => !f.type?.startsWith("image/"));

  return (
    <div className="flex flex-col gap-1.5 max-w-full">
      {/* Images Grid */}
      {images.length > 0 && (
        <div
          className={cn(
            "grid gap-1.5 max-w-sm sm:max-w-md",
            images.length === 1
              ? "grid-cols-1"
              : images.length === 2
                ? "grid-cols-2"
                : "grid-cols-3",
          )}
        >
          {images.map((img, idx) => (
            <a
              key={idx}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative rounded-[8px] overflow-hidden border border-border bg-bg group flex items-center justify-center aspect-square"
            >
              <img
                src={img.url}
                alt={img.name}
                className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
              />
            </a>
          ))}
        </div>
      )}

      {/* Document chips */}
      {nonImages.length > 0 && (
        <div className="flex flex-col gap-1 max-w-xs sm:max-w-sm">
          {nonImages.map((file, idx) => {
            const isText =
              file.type?.startsWith("text/") ||
              /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
                file.name,
              );
            const icon = isText ? "description" : "draft";
            const hasUrl = !!file.url;
            const content = (
              <>
                <span className="material-symbols-outlined text-[16px] text-text-muted">
                  {icon}
                </span>
                <span className="truncate flex-1" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-text-subtle flex-shrink-0 font-mono">
                  ({formatBytes(file.size)})
                </span>
                <span className="material-symbols-outlined text-[14px] text-text-subtle">
                  {hasUrl ? "download" : "lock"}
                </span>
              </>
            );

            if (!hasUrl) {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] border border-border bg-surface-2 text-text-main text-[12px] font-medium"
                  title={
                    file.content
                      ? "Nội dung đã được trích xuất và không kèm URL."
                      : "Tệp đính kèm không hiển thị URL công khai."
                  }
                >
                  {content}
                </div>
              );
            }
            return (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] border border-border bg-surface-2 text-text-main hover:bg-surface-3 transition-colors text-[12px] font-medium"
              >
                {content}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourceFilePill({ item }) {
  const isLink = !!item.url;

  const content = (
    <>
      <span className="material-symbols-outlined text-[13px]">description</span>
      <span className="truncate max-w-[140px] font-medium">{item.name}</span>
      {item.subject && (
        <span className="text-[9px] font-semibold opacity-75 bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1.5 py-0.2 rounded border border-brand-500/15 flex-shrink-0">
          {item.subject}
        </span>
      )}
      {item.details && (
        <span
          className="text-[9px] font-semibold opacity-85 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 flex-shrink-0"
          title={item.details}
        >
          {item.details}
        </span>
      )}
    </>
  );

  if (isLink) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface hover:text-brand-500 hover:border-brand-500/30 hover:shadow-sm transition-all cursor-pointer select-none max-w-full"
        title={`Môn học: ${item.subject || "Khác"}${item.details ? ` | Chi tiết: ${item.details}` : ""}. Nhấp để xem/tải tài liệu.`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface text-text-subtle select-none max-w-full"
      title={
        item.details
          ? `Chi tiết: ${item.details}`
          : "Tài liệu chưa được liên kết URL"
      }
    >
      {content}
    </div>
  );
}

function PreviewCard({
  title,
  dateLabel,
  icon,
  iconClassName,
  buttonClassName,
  onOpen,
}) {
  return (
    <div
      className="my-3 w-full max-w-[390px] rounded-[18px] border border-[#e4e9ef] bg-[#fbfbfa] px-4 py-3.5 flex items-center justify-between gap-3 shadow-[0_8px_24px_rgba(16,24,40,0.08)] hover:border-[#d4dde6] hover:shadow-[0_10px_28px_rgba(16,24,40,0.12)] transition-all duration-200"
      style={{ animation: "asstSlideUp 0.25s ease both" }}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={cn(
            "size-11 rounded-[12px] flex items-center justify-center shrink-0",
            iconClassName,
          )}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-900 truncate">
            {title}
          </h4>
          <p className="text-[11px] text-neutral-500 mt-0.5">{dateLabel}</p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className={cn(
          "px-4 py-1.5 shrink-0 rounded-full text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer",
          buttonClassName,
        )}
      >
        Open
      </button>
    </div>
  );
}

function AgentResultCards({ cards = [], onOpenAgentRun, onOpenReport }) {
  if (!Array.isArray(cards) || cards.length === 0) return null;

  return (
    <div className="my-3 flex flex-col gap-3 w-full max-w-[390px]">
      {cards.map((card, index) => {
        const isRun = card.type === "agent_run";
        return (
          <PreviewCard
            key={`${card.type || "card"}-${index}`}
            title={card.title}
            dateLabel={card.dateLabel || ""}
            icon={isRun ? "format_list_bulleted" : "article"}
            iconClassName={
              isRun
                ? "bg-[#e8f6ef] text-[#17a96d]"
                : "bg-[#f7e8e2] text-[#e25533]"
            }
            buttonClassName={
              isRun
                ? "bg-[#bde4d0] text-[#1e6b49] hover:bg-[#abdcc2]"
                : "bg-[#a8ceff] text-[#114f86] hover:bg-[#91bef6]"
            }
            onOpen={() => {
              if (isRun) {
                onOpenAgentRun?.(card.chatId);
              } else {
                onOpenReport?.({
                  title: card.report?.title || card.title,
                  content: card.report?.content || "",
                  sections_progress: card.report?.sections_progress || [],
                });
              }
            }}
          />
        );
      })}
    </div>
  );
}

function MessageBlock({
  msg,
  isStreaming,
  filesBySubject,
  onEditSubmit,
  onRegenerate,
  onOpenOutline,
  onOpenReport,
  onOpenAgentRun,
}) {
  const isUser = msg.role === "user";
  const [isSeeAllOpen, setIsSeeAllOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content || "");

  // Update edit value if message content changes
  useEffect(() => {
    setEditVal(msg.content || "");
  }, [msg.content]);

  // Extract sources list, clean content, and report blocks from msg.content
  const { cleanContent, sources, reports, outlines } = useMemo(() => {
    if (isUser || !msg.content || isStreaming || msg.status === "streaming") {
      return {
        cleanContent: msg.content,
        sources: [],
        reports: [],
        outlines: [],
      };
    }

    const outlines = [];
    const reports = [];
    let text = msg.content;

    // Loop to extract all [START_OUTLINE] ... [END_OUTLINE]
    let outlineMatch;
    while (
      (outlineMatch = text.match(/\[START_OUTLINE\]([\s\S]*?)\[END_OUTLINE\]/))
    ) {
      const content = outlineMatch[1].trim();
      const title = getDocTitle(content, "Dàn ý báo cáo");
      outlines.push({ title, content });
      text = text
        .replace(/\[START_OUTLINE\]([\s\S]*?)\[END_OUTLINE\]/, "")
        .trim();
    }

    // Loop to extract all [START_REPORT] ... [END_REPORT]
    let reportMatch;
    while (
      (reportMatch = text.match(/\[START_REPORT\]([\s\S]*?)\[END_REPORT\]/))
    ) {
      const content = reportMatch[1].trim();
      const titleMatch = content.match(/^(?:#|##)\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1].trim().replace(/\*|_/g, "")
        : "Báo cáo Kiến tập";
      reports.push({ title, content });
      text = text.replace(/\[START_REPORT\][\s\S]*?\[END_REPORT\]/, "").trim();
    }

    // Extract any fallback markdown code blocks as reports if no reports are found
    if (reports.length === 0) {
      let mdBlockMatch;
      while ((mdBlockMatch = text.match(/```markdown\n([\s\S]*?)\n```/))) {
        const content = mdBlockMatch[1].trim();
        const titleMatch = content.match(/^(?:#|##)\s+(.+)$/m);
        const title = titleMatch
          ? titleMatch[1].trim().replace(/\*|_/g, "")
          : "Báo cáo Kiến tập";
        reports.push({ title, content });
        text = text.replace(/```markdown\n[\s\S]*?\n```/, "").trim();
      }
    }

    // Extract sources
    const match = text.match(
      /(.*)(?:\r?\n|^)(?:sources|source|nguồn|nguồn tham khảo)\s*:\s*(.*)$/is,
    );
    let parsedSources = [];
    let clean = text;
    if (match) {
      clean = match[1].trimEnd();
      const sourcesPart = match[2].trim();
      const items = (sourcesPart.match(/[^,(]+(?:\([^)]*\))?/g) || [])
        .map((s) => s.trim())
        .filter(Boolean);

      parsedSources = items.map((item) => {
        const matchItem = item.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (matchItem) {
          return {
            name: matchItem[1].trim(),
            details: matchItem[2] ? matchItem[2].trim() : null,
          };
        }
        return { name: item, details: null };
      });
    }

    return { cleanContent: clean, sources: parsedSources, reports, outlines };
  }, [msg.content, isUser, isStreaming, msg.status]);

  // Match sources to actual files with URLs and subjects
  const sourceItems = useMemo(() => {
    if (isUser || !sources || sources.length === 0) return [];

    // Flatten files list
    const allFiles = [];
    for (const [subj, files] of Object.entries(filesBySubject || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allFiles.push({ ...f, subject: subj });
        }
      }
    }

    return sources.map((src) => {
      const matched = allFiles.find(
        (af) => af.name.toLowerCase().trim() === src.name.toLowerCase().trim(),
      );
      return {
        name: src.name,
        url: matched?.url || null,
        subject: matched?.subject || null,
        matched: !!matched,
        details: src.details,
      };
    });
  }, [sources, filesBySubject, isUser]);

  const hasAssistantActions =
    !isStreaming &&
    (msg.kind === "agent_result_cards" || !!msg.content || !!cleanContent);

  const renderContent = useCallback(() => {
    if (msg.kind === "agent_result_cards") {
      return (
        <AgentResultCards
          cards={msg.cards || []}
          onOpenAgentRun={onOpenAgentRun}
          onOpenReport={onOpenReport}
        />
      );
    }

    if (!cleanContent && reports.length === 0 && outlines.length === 0)
      return isStreaming ? <TypingDots /> : null;

    let rendered = [];
    if (cleanContent) {
      const parts = cleanContent.split(/(```[\w]*\n?[\s\S]*?```)/g);
      rendered = parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const lang = codeMatch[1] || "code";
          const code = codeMatch[2].trimEnd();
          return (
            <div
              key={i}
              className="my-2 rounded-[10px] overflow-hidden border border-border bg-bg"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2">
                <span className="text-[11px] text-text-muted font-mono">
                  {lang}
                </span>
                <CopyButton text={code} />
              </div>
              <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed text-text-main font-mono">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        const html = renderMarkdownAndMath(part);
        return (
          <div
            key={i}
            className="asst-md"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      });
    }

    // Add Document Cards if outlines exist
    outlines.forEach((outlineData, index) => {
      const formattedDate = msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        " " +
        new Date(msg.createdAt).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "short",
        })
        : "";
      rendered.push(
        <PreviewCard
          key={`outline-card-${index}`}
          title={outlineData.title}
          dateLabel={formattedDate}
          icon="format_list_bulleted"
          iconClassName="bg-[#e8f6ef] text-[#17a96d]"
          buttonClassName="bg-[#bde4d0] text-[#1e6b49] hover:bg-[#abdcc2]"
          onOpen={() => onOpenOutline?.(outlineData)}
        />,
      );
    });

    // Add Document Cards if reports exist
    reports.forEach((reportData, index) => {
      const formattedDate = msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        " " +
        new Date(msg.createdAt).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "short",
        })
        : "";
      rendered.push(
        <PreviewCard
          key={`report-card-${index}`}
          title={reportData.title}
          dateLabel={formattedDate}
          icon="article"
          iconClassName="bg-[#f7e8e2] text-[#e25533]"
          buttonClassName="bg-[#a8ceff] text-[#114f86] hover:bg-[#91bef6]"
          onOpen={() => onOpenReport?.(reportData)}
        />,
      );
    });

    return rendered;
  }, [
    cleanContent,
    reports,
    outlines,
    isStreaming,
    onOpenOutline,
    onOpenReport,
    onOpenAgentRun,
    msg.createdAt,
    msg.kind,
    msg.cards,
  ]);

  if (isUser) {
    if (isEditing) {
      return (
        <div
          className="flex justify-end gap-2 items-start"
          style={{ animation: "asstSlideUp 0.2s ease both" }}
        >
          <div className="max-w-[78%] min-w-0 flex flex-col items-end gap-1.5">
            <div className="w-full flex flex-col gap-2 min-w-[280px] bg-surface border border-border p-3 rounded-[16px] shadow-[var(--shadow-warm)]">
              <textarea
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                className="w-full p-2.5 rounded-[12px] border border-border bg-bg text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 custom-scrollbar resize-y min-h-[80px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditVal(msg.content || "");
                  }}
                  className="px-2.5 py-1 text-xs rounded-[8px] border border-border text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-semibold"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (editVal.trim() && editVal.trim() !== msg.content) {
                      onEditSubmit?.(msg.id, editVal);
                    }
                    setIsEditing(false);
                  }}
                  className="px-3 py-1 text-xs rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white transition-all font-semibold shadow-sm"
                >
                  Lưu & Gửi
                </button>
              </div>
            </div>
          </div>
          <UserAvatar />
        </div>
      );
    }

    return (
      <div
        className="flex justify-end gap-2 items-end group"
        style={{ animation: "asstSlideUp 0.2s ease both" }}
      >
        <div className="max-w-[78%] min-w-0 flex flex-col items-end gap-1.5">
          {msg.files && msg.files.length > 0 && (
            <MessageFilesGrid files={msg.files} />
          )}
          {msg.content && (
            <div
              className="px-4 py-2.5 rounded-[16px] rounded-br-[4px] bg-brand-500 text-white text-sm leading-relaxed shadow-[var(--shadow-warm)] asst-md-user"
              dangerouslySetInnerHTML={{
                __html: renderMarkdownAndMath(msg.content),
              }}
            />
          )}

          {/* Action Row for User message */}
          <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
            <CopyButton
              text={msg.content}
              className="!border-none !bg-transparent hover:!bg-surface-2 p-1 rounded-full text-text-muted hover:text-text-main text-[11px]"
            />
            <button
              onClick={() => {
                setEditVal(msg.content || "");
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-medium"
              title="Sửa câu hỏi"
            >
              <span className="material-symbols-outlined text-[13px]">
                edit
              </span>
              <span>Sửa</span>
            </button>
          </div>
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div
      className="flex gap-2.5 items-start group"
      style={{ animation: "asstSlideUp 0.2s ease both" }}
    >
      <AssistantAvatar />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-main leading-relaxed">
          {msg.files && msg.files.length > 0 && (
            <div className="mb-2">
              <MessageFilesGrid files={msg.files} />
            </div>
          )}
          {isStreaming && !cleanContent ? <TypingDots /> : renderContent()}
          {isStreaming && cleanContent && (
            <span
              className="inline-block w-[2px] h-[14px] bg-brand-500 ml-0.5 rounded align-middle"
              style={{ animation: "asstBlink 1s infinite" }}
            />
          )}

          {/* Action Row for Assistant message */}
          {hasAssistantActions && (
            <div className="flex items-center gap-2 mt-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
              {msg.kind !== "agent_result_cards" && (
                <CopyButton
                  text={cleanContent || msg.content}
                  className="!border-none !bg-transparent hover:!bg-surface-2 px-2 py-0.5 rounded-[6px] text-text-muted hover:text-text-main text-[11px]"
                />
              )}
              <button
                onClick={() => onRegenerate?.(msg.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-all font-medium"
                title="Trả lời lại (tải lại)"
              >
                <span className="material-symbols-outlined text-[13px]">
                  refresh
                </span>
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {/* Sources Section */}
          {sourceItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-subtle flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-text-subtle font-medium">
                <span className="material-symbols-outlined text-[15px] text-brand-500">
                  menu_book
                </span>
                <span>Kiến thức áp dụng từ tài liệu:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sourceItems.length <= 5 ? (
                  sourceItems.map((item, idx) => (
                    <SourceFilePill key={idx} item={item} />
                  ))
                ) : (
                  <>
                    {sourceItems.slice(0, 4).map((item, idx) => (
                      <SourceFilePill key={idx} item={item} />
                    ))}
                    <button
                      onClick={() => setIsSeeAllOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-brand-500/20 bg-brand-500/10 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 hover:border-brand-500/35 transition-all cursor-pointer select-none"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        visibility
                      </span>
                      <span>+ {sourceItems.length - 4} Xem tất cả</span>
                    </button>
                  </>
                )}
              </div>

              {isSeeAllOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    animation: "asstFadeIn 0.15s ease",
                  }}
                  onClick={(e) =>
                    e.target === e.currentTarget && setIsSeeAllOpen(false)
                  }
                >
                  <div
                    className="w-full max-w-md bg-surface border border-border rounded-[16px] shadow-[var(--shadow-elev)] flex flex-col max-h-[70vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-brand-500 text-[20px]">
                          menu_book
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-text-main">
                            Tài liệu kiến thức đã dùng
                          </h3>
                          <p className="text-[10.5px] text-text-muted font-medium">
                            Tổng cộng {sourceItems.length} tài liệu được sử dụng
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsSeeAllOpen(false)}
                        className="p-1.5 rounded-[8px] hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          close
                        </span>
                      </button>
                    </div>
                    {/* Content */}
                    <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                      {sourceItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-[12px] border border-border bg-surface hover:bg-surface-2 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-1.5 rounded-[8px] bg-brand-500/10 text-brand-500">
                              <span className="material-symbols-outlined text-[18px]">
                                description
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-xs font-semibold text-text-main truncate max-w-[200px]"
                                title={item.name}
                              >
                                {item.name}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {item.subject && (
                                  <span className="text-[9px] font-semibold opacity-75 bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1 py-0.2 rounded border border-brand-500/15">
                                    {item.subject}
                                  </span>
                                )}
                                {item.details && (
                                  <span className="text-[9px] font-semibold opacity-85 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20">
                                    {item.details}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-brand-500 text-white hover:bg-brand-600 text-[11px] font-semibold transition-all cursor-pointer shadow-sm select-none"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                download
                              </span>
                              <span>Tải xuống</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-text-subtle italic bg-surface-2 px-2 py-0.5 rounded-[6px]">
                              Không có link
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {msg.status === "error" && (
          <p className="text-xs text-danger mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            Failed to get response
          </p>
        )}
        {msg.latencyMs && !isStreaming && (
          <p className="text-[11px] text-text-subtle mt-1">
            {(msg.latencyMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SubjectItem({ subj, outlines, templates, handleDelete }) {
  const [showAllOutlines, setShowAllOutlines] = useState(false);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const displayedOutlines = showAllOutlines ? outlines : outlines.slice(0, 3);
  const displayedTemplates = showAllTemplates
    ? templates
    : templates.slice(0, 3);

  return (
    <div
      key={subj}
      className="border border-border rounded-[12px] overflow-hidden bg-bg shadow-sm"
    >
      {/* Subject Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[17px] text-brand-500 flex-shrink-0">
            menu_book
          </span>
          <span
            className="text-xs font-bold text-text-main truncate"
            title={subj}
          >
            {subj}
          </span>
          <span className="text-[10px] text-text-subtle font-mono flex-shrink-0">
            ({outlines.length} đề cương, {templates.length} mẫu)
          </span>
        </div>
      </div>

      {/* Subject Content - Collapsible Columns */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface">
        {/* Outlines Column */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wide border-b border-border-subtle pb-1">
            <span className="material-symbols-outlined text-[14px]">
              menu_book
            </span>
            <span>Đề cương ({outlines.length})</span>
          </div>
          <div className="space-y-1">
            {outlines.length === 0 ? (
              <p className="text-[11px] text-text-subtle italic p-1">
                Chưa có đề cương
              </p>
            ) : (
              <>
                {displayedOutlines.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between px-2 py-1 rounded-[6px] bg-bg hover:bg-surface-2 border border-border-subtle transition-colors text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[14px] text-text-muted flex-shrink-0">
                        description
                      </span>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-text-main hover:text-brand-500 transition-colors hover:underline"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      <span className="text-[9px] text-text-subtle font-mono flex-shrink-0">
                        ({formatBytes(file.metadata?.size || file.size || 0)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(subj, file.name, "outlines")}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-text-subtle hover:text-danger transition-all ml-2 flex-shrink-0"
                      title="Xoá đề cương"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
                {outlines.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllOutlines(!showAllOutlines)}
                    className="w-full text-center px-2 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 hover:bg-brand-500/5 dark:hover:bg-brand-500/10 rounded transition-all flex items-center justify-center gap-1 mt-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle">
                      {showAllOutlines
                        ? "keyboard_arrow_up"
                        : "keyboard_arrow_down"}
                    </span>
                    <span className="align-middle">
                      {showAllOutlines
                        ? "Thu gọn"
                        : `Xem thêm ${outlines.length - 3} đề cương`}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Templates Column */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide border-b border-border-subtle pb-1">
            <span className="material-symbols-outlined text-[14px]">
              assignment
            </span>
            <span>Báo cáo mẫu ({templates.length})</span>
          </div>
          <div className="space-y-1">
            {templates.length === 0 ? (
              <p className="text-[11px] text-text-subtle italic p-1">
                Chưa có báo cáo mẫu
              </p>
            ) : (
              <>
                {displayedTemplates.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between px-2 py-1 rounded-[6px] bg-bg hover:bg-surface-2 border border-border-subtle transition-colors text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[14px] text-text-muted flex-shrink-0">
                        description
                      </span>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-text-main hover:text-brand-500 transition-colors hover:underline"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      <span className="text-[9px] text-text-subtle font-mono flex-shrink-0">
                        ({formatBytes(file.metadata?.size || file.size || 0)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(subj, file.name, "templates")}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-text-subtle hover:text-danger transition-all ml-2 flex-shrink-0"
                      title="Xoá báo cáo mẫu"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
                {templates.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTemplates(!showAllTemplates)}
                    className="w-full text-center px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 rounded transition-all flex items-center justify-center gap-1 mt-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px] align-middle">
                      {showAllTemplates
                        ? "keyboard_arrow_up"
                        : "keyboard_arrow_down"}
                    </span>
                    <span className="align-middle">
                      {showAllTemplates
                        ? "Thu gọn"
                        : `Xem thêm ${templates.length - 3} mẫu`}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeManager({
  subjectsOutlines,
  filesOutlines,
  loadingOutlines,
  loadOutlines,
  subjectsTemplates,
  filesTemplates,
  loadingTemplates,
  loadTemplates,
  username,
  isSupabaseConfigured,
  isRestrictedUser,
}) {
  const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [docType, setDocType] = useState("outlines"); // 'outlines' or 'templates'
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState("");

  const allSubjects = useMemo(() => {
    if (isRestrictedUser) return [...RESTRICTED_REPORT_ASSISTANT_SUBJECTS];
    const set = new Set([
      ...(subjectsOutlines || []),
      ...(subjectsTemplates || []),
    ]);
    return Array.from(set).sort();
  }, [subjectsOutlines, subjectsTemplates, isRestrictedUser]);

  useEffect(() => {
    if (isRestrictedUser && selectedSubjectForUpload === "__new__") {
      setSelectedSubjectForUpload(RESTRICTED_REPORT_ASSISTANT_SUBJECTS[0] || "");
      return;
    }
    if (allSubjects.length > 0 && !selectedSubjectForUpload) {
      setSelectedSubjectForUpload(allSubjects[0]);
    } else if (allSubjects.length === 0) {
      setSelectedSubjectForUpload("__new__");
    }
  }, [allSubjects, selectedSubjectForUpload, isRestrictedUser]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (uploadingFiles.length === 0) return;
    const subjName =
      selectedSubjectForUpload === "__new__"
        ? newSubjectName.trim()
        : selectedSubjectForUpload;
    if (!subjName) {
      setLocalError("Vui lòng nhập tên chủ đề / môn học.");
      return;
    }

    setIsUploading(true);
    setLocalError("");
    try {
      const cleanSubject = sanitizeStoragePathSegment(subjName);
      if (!cleanSubject) {
        setLocalError(
          "Tên chủ đề không hợp lệ sau khi làm sạch ký tự đặc biệt.",
        );
        return;
      }

      const existingFiles =
        (docType === "outlines" ? filesOutlines : filesTemplates)[
        cleanSubject
        ] || [];
      const existingNames = existingFiles.map((f) => f.name);
      const assignedNames = [...existingNames];

      for (const file of uploadingFiles) {
        let cleanFileName =
          sanitizeStoragePathSegment(file.name) || `file_${Date.now()}`;

        const dotIndex = cleanFileName.lastIndexOf(".");
        let baseName = cleanFileName;
        let ext = "";
        if (dotIndex !== -1) {
          baseName = cleanFileName.substring(0, dotIndex);
          ext = cleanFileName.substring(dotIndex);
        }

        let counter = 1;
        let finalFileName = cleanFileName;
        while (assignedNames.includes(finalFileName)) {
          finalFileName = `${baseName}(${counter})${ext}`;
          counter++;
        }
        cleanFileName = finalFileName;
        assignedNames.push(cleanFileName);

        // Upload to Backend API
        const formData = new FormData();
        formData.append("username", REPORT_KNOWLEDGE_GLOBAL_USER);
        formData.append("subject", cleanSubject);
        formData.append("filename", cleanFileName);
        formData.append("file", file);
        formData.append("type", docType); // 'outlines' or 'templates'

        const uploadRes = await fetch("/api/report-assistant/knowledge", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(
            errText || `Tải lên tài liệu ${file.name} lên máy chủ thất bại.`,
          );
        }

        const uploadData = await uploadRes.json();
        const fileUrl = uploadData.fileUrl || "";

        // Parse & save content to DB
        const isPdf = cleanFileName.toLowerCase().endsWith(".pdf");
        const isDocx = /\.docx$/i.test(cleanFileName);
        const isText =
          /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
            cleanFileName,
          );

        let extractedText = "";
        let pageCount = 0;

        if (isPdf) {
          try {
            const result = await parsePdfText(file);
            extractedText = result.text;
            pageCount = result.pageCount;
          } catch (pdfErr) {
            console.warn("Không thể parse PDF:", pdfErr.message);
          }
        } else if (isDocx) {
          try {
            const result = await parseDocxText(file);
            extractedText = result.text;
            pageCount = result.pageCount;
          } catch (docxErr) {
            console.warn("Cannot parse Word file:", docxErr.message);
          }
        } else if (isText && file.size < 150 * 1024) {
          try {
            extractedText = await file.text();
            pageCount = 1;
          } catch (textErr) {
            console.warn("Không thể đọc file text:", textErr.message);
          }
        }

        if (extractedText) {
          try {
            await fetch("/api/knowledge-content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username:
                  docType === "outlines"
                    ? REPORT_OUTLINE_CONTENT_USER
                    : REPORT_TEMPLATE_CONTENT_USER,
                subject: cleanSubject,
                filename: cleanFileName,
                content_text: extractedText,
                page_count: pageCount,
                file_url: fileUrl,
              }),
            });
            clearKnowledgeContentCache(
              docType === "outlines"
                ? REPORT_OUTLINE_CONTENT_USER
                : REPORT_TEMPLATE_CONTENT_USER,
              cleanSubject,
            );
          } catch (saveErr) {
            console.warn("Không thể lưu nội dung tài liệu:", saveErr.message);
          }
        }
      }

      setUploadingFiles([]);
      setNewSubjectName("");

      if (docType === "outlines") {
        await loadOutlines();
      } else {
        await loadTemplates();
      }

      if (selectedSubjectForUpload === "__new__") {
        setSelectedSubjectForUpload(cleanSubject);
      }
    } catch (err) {
      console.error(err);
      setLocalError(err.message || "Tải lên tài liệu thất bại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (subj, fileName, fileType) => {
    const labelType = fileType === "outlines" ? "đề cương" : "báo cáo mẫu";
    if (
      !confirm(
        `Bạn có chắc chắn muốn xoá tài liệu ${labelType} "${fileName}" khỏi môn học/chủ đề "${subj}"?`,
      )
    )
      return;
    setLocalError("");
    try {
      const cleanSubject = sanitizeStoragePathSegment(subj);
      const cleanFileName = sanitizeStoragePathSegment(fileName);

      const delRes = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&subject=${encodeURIComponent(cleanSubject)}&filename=${encodeURIComponent(cleanFileName)}&type=${fileType}`,
        { method: "DELETE" },
      );

      if (!delRes.ok) {
        const errText = await delRes.text();
        throw new Error(errText || "Xoá tài liệu trên máy chủ thất bại.");
      }

      // Xoá nội dung đã parse tương ứng
      try {
        await fetch(
          `/api/knowledge-content?username=${encodeURIComponent(fileType === "outlines" ? REPORT_OUTLINE_CONTENT_USER : REPORT_TEMPLATE_CONTENT_USER)}&subject=${encodeURIComponent(cleanSubject)}&filename=${encodeURIComponent(cleanFileName)}`,
          { method: "DELETE" },
        );
        clearKnowledgeContentCache(
          fileType === "outlines"
            ? REPORT_OUTLINE_CONTENT_USER
            : REPORT_TEMPLATE_CONTENT_USER,
          cleanSubject,
          cleanFileName,
        );
      } catch (delErr) {
        console.warn("Không thể xoá nội dung tài liệu:", delErr.message);
      }

      if (fileType === "outlines") {
        await loadOutlines();
      } else {
        await loadTemplates();
      }
    } catch (err) {
      console.error(err);
      setLocalError(err.message || "Xoá tài liệu thất bại.");
    }
  };

  return (
    <div className="space-y-6">
      {localError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-danger text-xs mb-4">
          <span className="material-symbols-outlined text-[16px] flex-shrink-0">
            error
          </span>
          <p className="flex-1">{localError}</p>
        </div>
      )}

      {/* Upload Section */}
      <form
        onSubmit={handleUpload}
        className="p-4 border border-border bg-surface-2 rounded-[12px] space-y-3"
      >
        <p className="text-xs font-bold text-text-main flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-brand-500">
            upload_file
          </span>
          Thêm tài liệu kiến thức mới
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Select Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Chủ đề / Môn học
            </label>
            <select
              value={selectedSubjectForUpload}
              onChange={(e) => {
                setSelectedSubjectForUpload(e.target.value);
                setLocalError("");
              }}
              className="w-full h-9 px-2 text-xs bg-bg border border-border rounded-[8px] outline-none text-text-main focus:border-brand-500/50"
            >
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {!isRestrictedUser && (
                <option value="__new__">+ Thêm chủ đề mới...</option>
              )}
            </select>
          </div>

          {/* New Subject Input */}
          {selectedSubjectForUpload === "__new__" && !isRestrictedUser && (
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Tên chủ đề mới
              </label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => {
                  setNewSubjectName(e.target.value);
                  setLocalError("");
                }}
                placeholder="Ví dụ: Báo cáo tài chính, Kế hoạch năm..."
                className="w-full h-9 px-3 text-xs bg-bg border border-border rounded-[8px] outline-none text-text-main focus:border-brand-500/50"
              />
            </div>
          )}

          {/* Document Type Selector */}
          <div
            className={
              selectedSubjectForUpload === "__new__" && !isRestrictedUser
                ? "col-span-1"
                : "col-span-2"
            }
          >
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Loại tài liệu
            </label>
            <div className="flex gap-2 h-9">
              <button
                type="button"
                onClick={() => setDocType("outlines")}
                className={cn(
                  "flex-1 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all select-none",
                  docType === "outlines"
                    ? "bg-brand-50 border-brand-500/30 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400"
                    : "bg-bg border-border text-text-muted hover:bg-surface-2",
                )}
              >
                <span className="material-symbols-outlined text-[16px]">
                  menu_book
                </span>
                Đề cương
              </button>
              <button
                type="button"
                onClick={() => setDocType("templates")}
                className={cn(
                  "flex-1 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all select-none",
                  docType === "templates"
                    ? "bg-amber-50 border-amber-500/30 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                    : "bg-bg border-border text-text-muted hover:bg-surface-2",
                )}
              >
                <span className="material-symbols-outlined text-[16px]">
                  assignment
                </span>
                Báo cáo mẫu
              </button>
            </div>
          </div>
        </div>

        {/* File Drop Area */}
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="flex flex-col items-center justify-center border border-dashed border-border hover:border-brand-500/50 rounded-[10px] py-4 bg-bg cursor-pointer transition-colors text-xs text-text-muted">
              <span className="material-symbols-outlined text-[20px] text-brand-500 mb-1">
                cloud_upload
              </span>
              <span className="font-medium text-text-main truncate max-w-[240px] px-2">
                {uploadingFiles.length > 0
                  ? `${uploadingFiles.length} tệp đã chọn: ${uploadingFiles.map((f) => f.name).join(", ")}`
                  : `Chọn tài liệu ${docType === "outlines" ? "đề cương" : "báo cáo mẫu"}...`}
              </span>
              {uploadingFiles.length === 0 && (
                <span className="text-[10px] text-text-subtle mt-0.5">
                  Ảnh, PDF, text, code (&lt;150KB)...
                </span>
              )}
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.yaml,.yml"
                onChange={(e) => {
                  setUploadingFiles(Array.from(e.target.files || []));
                  setLocalError("");
                }}
                className="hidden"
              />
            </label>
          </div>
          <Button
            type="submit"
            disabled={
              isUploading ||
              uploadingFiles.length === 0 ||
              (!selectedSubjectForUpload && !newSubjectName.trim())
            }
            className="h-auto flex items-center justify-center px-4 rounded-[10px]"
          >
            {isUploading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">
                upload
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Subjects & Files List */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
          Danh sách chủ đề kiến thức ({allSubjects.length})
        </label>

        {loadingOutlines || loadingTemplates ? (
          <div className="py-8 text-center text-xs text-text-subtle flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px] animate-spin">
              progress_activity
            </span>
            Đang tải danh sách tài liệu...
          </div>
        ) : allSubjects.length === 0 ? (
          <div className="py-12 border border-dashed border-border rounded-[12px] bg-surface text-center">
            <span className="material-symbols-outlined text-[28px] text-text-subtle block mb-1">
              folder_open
            </span>
            <p className="text-xs text-text-subtle">
              Chưa có chủ đề hay tài liệu nào.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[48vh] overflow-y-auto custom-scrollbar pr-1">
            {allSubjects.map((subj) => {
              const outlines = filesOutlines[subj] || [];
              const templates = filesTemplates[subj] || [];
              return (
                <SubjectItem
                  key={subj}
                  subj={subj}
                  outlines={outlines}
                  templates={templates}
                  handleDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({
  isOpen,
  onClose,
  allModels,
  enabledModelIds,
  onToggleModel,
  systemPrompt,
  onSystemPrompt,
  defaultSystemPrompt,
  temperature,
  onTemperature,
  assistantOnlyMode,
  onAssistantOnlyModeChange,
  subjectsOutlines,
  filesOutlines,
  loadingOutlines,
  loadOutlines,
  subjectsTemplates,
  filesTemplates,
  loadingTemplates,
  loadTemplates,
  isSupabaseConfigured,
  username,
  isRestrictedUser,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      allModels.filter(
        (m) =>
          m.id.toLowerCase().includes(search.toLowerCase()) ||
          (m.owned_by || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [allModels, search],
  );

  if (!isOpen) return null;

  const totalOutlinesFiles = subjectsOutlines.reduce(
    (acc, s) => acc + (filesOutlines[s]?.length || 0),
    0,
  );
  const totalTemplatesFiles = subjectsTemplates.reduce(
    (acc, s) => acc + (filesTemplates[s]?.length || 0),
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        animation: "asstFadeIn 0.15s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-[16px] shadow-[var(--shadow-elev)] flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-[8px] bg-bg text-text-muted">
              <span className="material-symbols-outlined text-[18px]">
                tune
              </span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-main">
                Report Assistant Settings & Knowledge
              </h2>
              <p className="text-xs text-text-muted">
                Configure AI prompt, models, and custom materials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border-subtle bg-surface-2 px-3 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0",
              activeTab === "general"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main",
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              settings
            </span>
            Cấu hình chung
          </button>
          <button
            onClick={() => setActiveTab("knowledge")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0",
              activeTab === "knowledge"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main",
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              menu_book
            </span>
            Kiến thức báo cáo ({totalOutlinesFiles + totalTemplatesFiles})
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 p-5 custom-scrollbar">
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    System Prompt
                  </label>
                  <div className="flex items-center gap-2">
                    {systemPrompt.trim() ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20">
                          <span className="material-symbols-outlined text-[11px]">
                            edit
                          </span>
                          Tuỳ chỉnh
                        </span>
                        <button
                          onClick={() => onSystemPrompt("")}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-text-subtle hover:text-danger border border-border hover:border-danger/40 transition-all"
                          title="Đặt lại về mặc định"
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            restart_alt
                          </span>
                          Reset
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-text-subtle border border-border">
                        <span className="material-symbols-outlined text-[11px]">
                          auto_awesome
                        </span>
                        Mặc định
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => onSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={defaultSystemPrompt}
                    className="w-full px-3 py-2.5 text-sm bg-bg border border-border rounded-[10px] placeholder:text-text-subtle resize-y outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all font-sans leading-relaxed"
                    style={{
                      color: systemPrompt.trim()
                        ? "var(--color-text-main)"
                        : undefined,
                    }}
                  />
                </div>
                <p className="text-[11px] text-text-subtle mt-1.5">
                  {systemPrompt.trim()
                    ? "Prompt tuỳ chỉnh đang được sử dụng."
                    : "Đang dùng prompt mặc định (trợ lí học tập tiếng Việt). Nhập để ghi đè."}
                </p>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Temperature
                  </label>
                  <Badge size="sm" variant="default">
                    {temperature.toFixed(1)}
                  </Badge>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => onTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-text-subtle">
                    Precise (0)
                  </span>
                  <span className="text-[11px] text-text-subtle">
                    Creative (2)
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Chế độ hoạt động
                  </label>
                  <span className="text-xs text-text-subtle">Tự động</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="assistantOnlyMode"
                    type="checkbox"
                    checked={assistantOnlyMode}
                    disabled
                    className="accent-brand-500 opacity-60 cursor-not-allowed"
                  />
                  <label
                    htmlFor="assistantOnlyMode"
                    className="text-[12px] text-text-subtle"
                  >
                    Hệ thống tự bật Báo cáo khi có yêu cầu và tự tắt sau khi
                    hoàn tất. Trạng thái hiện tại:{" "}
                    {assistantOnlyMode ? "Chat" : "Báo cáo"}.
                  </label>
                </div>
              </div>

              {/* Model Management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Available Models
                  </label>
                  <span className="text-xs text-text-subtle">
                    {enabledModelIds.size}/{allModels.length} enabled
                  </span>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-[10px] text-text-main placeholder:text-text-subtle outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {filtered.map((m) => {
                    const enabled = enabledModelIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => onToggleModel(m.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all",
                          "border",
                          enabled
                            ? "bg-brand-50 dark:bg-brand-900/20 border-brand-500/30 text-text-main"
                            : "bg-bg border-border text-text-muted hover:bg-surface-2 hover:text-text-main",
                        )}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-[4px] flex-shrink-0 flex items-center justify-center border transition-all",
                            enabled
                              ? "bg-brand-500 border-brand-500"
                              : "border-border bg-surface",
                          )}
                        >
                          {enabled && (
                            <span className="material-symbols-outlined text-[10px] text-white">
                              check
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {m.id.split("/").pop()}
                          </p>
                          <p className="text-[11px] text-text-subtle truncate">
                            {m.owned_by || m.id.split("/")[0]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-sm text-text-subtle">
                      No models found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "knowledge" && (
            <KnowledgeManager
              subjectsOutlines={subjectsOutlines}
              filesOutlines={filesOutlines}
              loadingOutlines={loadingOutlines}
              loadOutlines={loadOutlines}
              subjectsTemplates={subjectsTemplates}
              filesTemplates={filesTemplates}
              loadingTemplates={loadingTemplates}
              loadTemplates={loadTemplates}
              username={username}
              isSupabaseConfigured={isSupabaseConfigured}
              isRestrictedUser={isRestrictedUser}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle flex justify-end bg-surface">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportAssistantPageClient({ initialPrompt, initialChatId }) {
  const router = useRouter();
  const agentPanelRef = useRef(null);
  const previewPanelRef = useRef(null);

  const [hydrated, setHydrated] = useState(false);
  const [username, setUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("report-assistant.activeUsername") || "admin";
    }
    return "admin";
  });
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const [isRestrictedUser, setIsRestrictedUser] = useState(false);
  const [allModels, setAllModels] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [fullModelsLoaded, setFullModelsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(initialPrompt);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [assistantOnlyMode, setAssistantOnlyMode] = useState(true);
  const [enabledModelIds, setEnabledModelIds] = useState(new Set());
  const [reportModels, setReportModels] = useState([]);
  const [reportModelsLoading, setReportModelsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedOutline, setSelectedOutline] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const closeDoc = useCallback(() => {
    setSelectedOutline(null);
    setSelectedReport(null);
  }, []);
  const [reportCopied, setReportCopied] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info",
  });
  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };
  // ── AI Agent States ──
  const [agentActive, setAgentActive] = useState(false);
  const [agentState, setAgentState] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentModeEnabled, setAgentModeEnabled] = useState(true);
  const [pendingReportRequest, setPendingReportRequest] = useState(null);
  const [selectedReportModelId, setSelectedReportModelId] = useState("");
  const [reportWorkflowModelId, setReportWorkflowModelId] = useState("");
  const [agentErrorDialog, setAgentErrorDialog] = useState(null);
  const agentCancelRequestedRef = useRef(false);
  const agentQueueingRef = useRef(false);
  const agentDraftingInProgressRef = useRef(false);
  const reportModelsLoadAttemptedRef = useRef(false);
  const [selectedKnowledgeSubject, setSelectedKnowledgeSubject] =
    useState("none");

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(initialChatId || "");
  const [activeModelId, setActiveModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingId, setStreamingId] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [searchStatus, setSearchStatus] = useState("");

  const handleSubjectChange = useCallback(
    (subjValue) => {
      const nextSubject = isRestrictedUser && subjValue !== "none" && !isRestrictedReportAssistantSubject(subjValue)
        ? "none"
        : subjValue;
      setSelectedKnowledgeSubject(nextSubject);
      if (activeSessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                ...s,
                subject: nextSubject,
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
      }
    },
    [activeSessionId, isRestrictedUser],
  );

  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const modelDropRef = useRef(null);
  const historySyncTimerRef = useRef(null);
  const lastHistorySyncSignatureRef = useRef("");

  // ── Knowledge Base States (Outlines vs Templates) ──
  const [subjectsOutlines, setSubjectsOutlines] = useState([]);
  const [filesOutlines, setFilesOutlines] = useState({});
  const [loadingOutlines, setLoadingOutlines] = useState(false);

  const [subjectsTemplates, setSubjectsTemplates] = useState([]);
  const [filesTemplates, setFilesTemplates] = useState({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const allSubjects = useMemo(() => {
    if (isRestrictedUser) return [...RESTRICTED_REPORT_ASSISTANT_SUBJECTS];
    const set = new Set([
      ...Object.keys(filesOutlines || {}),
      ...Object.keys(filesTemplates || {}),
    ]);
    return Array.from(set).sort();
  }, [filesOutlines, filesTemplates, isRestrictedUser]);

  // Background Migration to Turso DB for legacy reports
  const migratedSessionsRef = useRef(new Set());
  useEffect(() => {
    if (!activeSessionId || !username) return;
    if (migratedSessionsRef.current.has(activeSessionId)) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    let sectionsToMigrate = [];

    // 1. Check if it's the really old format (embedded in messages)
    if (session.messages) {
      for (const msg of session.messages) {
        if (!msg.content) continue;
        let text = msg.content;
        let reportMatch;
        let index = 0;
        while ((reportMatch = text.match(/\[START_REPORT\]([\s\S]*?)\[END_REPORT\]/))) {
          const content = reportMatch[1].trim();
          const titleMatch = content.match(/^(?:#|##)\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim().replace(/\*|_/g, "") : "Báo cáo Kiến tập";
          sectionsToMigrate.push({
            id: `legacy_msg_${msg.id}_${index++}`,
            title,
            content,
            status: "completed"
          });
          text = text.replace(/\[START_REPORT\][\s\S]*?\[END_REPORT\]/, "").trim();
        }
      }
    }

    // 2. Check if it's the intermediate format (in session.agentState)
    if (sectionsToMigrate.length === 0 && session.agentState?.sections_progress && session.agentState.sections_progress.length > 0) {
      const hasContent = session.agentState.sections_progress.some(s => s.content && s.content.trim().length > 0);
      if (hasContent) {
        sectionsToMigrate = session.agentState.sections_progress;
      }
    }

    if (sectionsToMigrate.length > 0) {
      migratedSessionsRef.current.add(activeSessionId);
      fetch("/api/report-assistant/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: activeSessionId,
          username: username || "default_user",
          sections: sectionsToMigrate
        })
      }).catch(() => {});
    } else {
      // If no data to migrate, mark it so we don't keep parsing
      migratedSessionsRef.current.add(activeSessionId);
    }
  }, [activeSessionId, sessions, username]);

  useEffect(() => {
    agentCancelRequestedRef.current = false;
    if (!activeSessionId) return;

    const currentSession = sessions.find((session) => session.id === activeSessionId) || null;
    if (!currentSession) {
      setAgentState(null);
      setAgentActive(false);
      return;
    }

    const isReportSession =
      String(currentSession.modelId || "").startsWith(REPORT_ASSISTANT_LUNA_MODEL_PREFIX) ||
      String(currentSession.modelId || "").startsWith(REPORT_ASSISTANT_ARENA_MODEL_PREFIX) ||
      hasAgentResultCards(currentSession.messages);

    if (!isReportSession) {
      setAgentState(null);
      setAgentActive(false);
      return;
    }

    if (shouldAutoRestoreReportSession(currentSession)) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch("/api/report-assistant/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "status",
              chatId: activeSessionId,
            }),
          });

          if (!res.ok || cancelled) return;
          const data = await res.json().catch(() => null);
          if (!data?.ok || !data.state || cancelled) return;

          setAgentState(data.state);
          setAgentActive(!isAgentFinishedState(data.state));

          const stateSubject =
            data.state?.outline?.[0]?.reportContext?.outlineSource ||
            data.state?.sections_progress?.[0]?.reportContext?.outlineSource ||
            "";
          if (stateSubject) {
            setSelectedKnowledgeSubject(stateSubject);
            setSessions((prev) =>
              prev.map((session) =>
                session.id === activeSessionId && !session.subject
                  ? { ...session, subject: stateSubject }
                  : session,
              ),
            );
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to auto-restore report assistant agent state:", err);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!agentState) return;
    if (!isAgentFinishedState(agentState)) return;

    agentQueueingRef.current = false;
    agentCancelRequestedRef.current = false;
    setAgentLoading(false);
  }, [agentState]);

  // Sync selectedKnowledgeSubject from active session
  useEffect(() => {
    if (!activeSessionId) {
      // Do not force reset if activeSessionId is empty, so user can select subject for a new chat
      return;
    }
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (!currentSession) {
      // If the session is not yet in sessions state, do not overwrite the current selection
      return;
    }
    const sessionSubject = currentSession?.subject;
    if (isRestrictedUser && sessionSubject && sessionSubject !== "none" && !isRestrictedReportAssistantSubject(sessionSubject)) {
      setSelectedKnowledgeSubject("none");
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? { ...session, subject: "none", updatedAt: new Date().toISOString() }
            : session,
        ),
      );
      return;
    }
    // If session has an explicit subject, use it; otherwise keep the user's persisted choice
    if (sessionSubject && sessionSubject !== "none") {
      setSelectedKnowledgeSubject(sessionSubject);
    } else if (!sessionSubject) {
      // Session was created before subject-persistence; don't override the persisted choice
      return;
    } else {
      // sessionSubject === "none" explicitly set by user for this session
      setSelectedKnowledgeSubject("none");
    }
  }, [activeSessionId, sessions, isRestrictedUser]);

  const isSupabaseConfigured = useMemo(() => {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }, []);

  const loadOutlines = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingOutlines(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=outlines`,
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsOutlines([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesOutlines(allowed);
      } else {
        setSubjectsOutlines(subjects);
        setFilesOutlines(filesBySubject);
      }
    } catch (err) {
      console.error("Failed to load outlines:", err);
    } finally {
      setLoadingOutlines(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  const loadReportModels = useCallback(async () => {
    if (reportModelsLoading || reportModelsLoadAttemptedRef.current) return;
    reportModelsLoadAttemptedRef.current = true;
    setReportModelsLoading(true);
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const rawModels = Array.isArray(data?.data) ? data.data : [];
      setReportModels(getReportAssistantLunaModels(rawModels));
    } catch (err) {
      console.error("Failed to load report models:", err);
    } finally {
      setReportModelsLoading(false);
    }
  }, [reportModelsLoading]);

  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=templates`,
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const filesBySubject = data.filesBySubject || {};
      if (isRestrictedUser) {
        const allowed = {};
        for (const subj of RESTRICTED_REPORT_ASSISTANT_SUBJECTS) {
          allowed[subj] = Array.isArray(filesBySubject[subj]) ? filesBySubject[subj] : [];
        }
        setSubjectsTemplates([...RESTRICTED_REPORT_ASSISTANT_SUBJECTS]);
        setFilesTemplates(allowed);
      } else {
        setSubjectsTemplates(subjects);
        setFilesTemplates(filesBySubject);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [isSupabaseConfigured, isRestrictedUser]);

  // Load knowledge once hydrated and supabase configured
  useEffect(() => {
    if (hydrated && usernameLoaded && isSupabaseConfigured) {
      loadOutlines();
      loadTemplates();
    }
  }, [hydrated, usernameLoaded, isSupabaseConfigured, loadOutlines, loadTemplates]);

  // ── Inject CSS ──
  useEffect(() => {
    if (typeof document === "undefined") return;
    let s = document.getElementById("asst-styles");
    if (!s) {
      s = document.createElement("style");
      s.id = "asst-styles";
      document.head.appendChild(s);
    }
    s.textContent = `
      @keyframes asstSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @keyframes asstFadeIn  { from { opacity:0; } to { opacity:1; } }
      @keyframes asstBlink   { 0%,100% { opacity:1; } 50% { opacity:0; } }
      @keyframes asstDot     { 0%,80%,100% { transform:scale(.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
      @keyframes asstSlideLeft { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
      
      .asst-slide-left { animation: asstSlideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }

      .asst-md p { margin: 0.5em 0 !important; line-height: 1.6 !important; }
      .asst-md h1 { font-size: 1.4em !important; font-weight: 700 !important; margin: 0.8em 0 0.4em !important; display: block !important; }
      .asst-md h2 { font-size: 1.25em !important; font-weight: 700 !important; margin: 0.7em 0 0.3em !important; display: block !important; }
      .asst-md h3 { font-size: 1.1em !important; font-weight: 600 !important; margin: 0.6em 0 0.3em !important; display: block !important; }
      .asst-md ul { list-style-type: disc !important; list-style-position: outside !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md li { display: list-item !important; margin: 0.2em 0 !important; }
      .asst-md blockquote { border-left: 3px solid var(--color-brand-500) !important; padding-left: 0.8em !important; color: var(--color-text-muted) !important; font-style: italic !important; margin: 0.5em 0 !important; display: block !important; }
      .asst-md hr { border: none !important; border-top: 1px solid var(--color-border) !important; margin: 1em 0 !important; display: block !important; }
      .asst-md code { font-family: ui-monospace, monospace !important; background: var(--color-bg-alt) !important; padding: 2px 5px !important; border-radius: 4px !important; font-size: 0.875em !important; color: var(--color-primary) !important; display: inline-block !important; }
      .asst-md table { border-collapse: collapse !important; width: 100% !important; margin: 0.8em 0 !important; font-size: 0.9em !important; display: table !important; }
      .asst-md th, .asst-md td { border: 1px solid var(--color-border) !important; padding: 6px 10px !important; text-align: left !important; }
      .asst-md th { background: var(--color-bg-alt) !important; font-weight: 600 !important; }
      .asst-md a { color: var(--color-brand-500) !important; text-decoration: underline !important; }

      .asst-md-user p { margin: 0.4em 0 !important; line-height: 1.5 !important; }
      .asst-md-user ul { list-style-type: disc !important; list-style-position: outside !important; padding-left: 1.4em !important; margin: 0.4em 0 !important; display: block !important; }
      .asst-md-user ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 1.4em !important; margin: 0.4em 0 !important; display: block !important; }
      .asst-md-user li { display: list-item !important; margin: 0.15em 0 !important; }
      .asst-md-user code { font-family: ui-monospace, monospace !important; background: rgba(255, 255, 255, 0.2) !important; padding: 1px 4px !important; border-radius: 4px !important; font-size: 0.875em !important; color: #fff !important; display: inline-block !important; }
      .asst-md-user a { color: #fff !important; text-decoration: underline !important; font-weight: 500 !important; }
      .asst-md-user blockquote { border-left: 3px solid rgba(255, 255, 255, 0.5) !important; padding-left: 0.8em !important; color: rgba(255, 255, 255, 0.8) !important; font-style: italic !important; margin: 0.5em 0 !important; display: block !important; }

      .report-view {
        font-family: "Times New Roman", Times, serif !important;
        color: var(--color-text-main) !important;
        font-size: 13pt !important;
        line-height: 1.5 !important;
      }
      .report-view p {
        font-family: "Times New Roman", Times, serif !important;
        font-size: 13pt !important;
        line-height: 1.5 !important;
        margin: 0.8em 0 !important;
        text-align: justify !important;
        text-indent: 1.25cm !important;
      }
      .report-view p:has(> strong:first-child) {
        text-indent: 0 !important;
      }
      .report-view p > strong:only-child {
        display: inline !important;
        text-align: inherit !important;
      }
      /* Loại bỏ indent cho đoạn căn giữa (trang bìa) */
      .report-view p[style*="center"],
      .report-view .cover-line {
        text-align: center !important;
        text-indent: 0 !important;
      }
      .report-view h1 {
        font-family: "Times New Roman", Times, serif !important;
        font-weight: bold !important;
        color: var(--color-text-main) !important;
        margin: 1.2em 0 0.6em !important;
        text-indent: 0 !important;
        font-size: 1.75em !important;
        text-align: center !important;
        text-transform: uppercase !important;
      }
      .report-view h2, .report-view h3, .report-view h4 {
        font-family: "Times New Roman", Times, serif !important;
        font-size: 13pt !important;
        line-height: 1.5 !important;
        color: var(--color-text-main) !important;
        margin: 1.2em 0 0.6em !important;
        text-indent: 0 !important;
      }
      .report-view h2, .report-view h4 {
        font-weight: bold !important;
      }
      .report-view h3 {
        font-weight: normal !important;
        font-style: italic !important;
      }
      .report-view ul {
        list-style-type: disc !important;
        padding-left: 2em !important;
        margin: 0.6em 0 !important;
      }
      .report-view ol {
        list-style-type: decimal !important;
        padding-left: 2em !important;
        margin: 0.6em 0 !important;
      }
      .report-view li {
        font-family: "Times New Roman", Times, serif !important;
        font-size: 13pt !important;
        line-height: 1.5 !important;
        margin: 0.3em 0 !important;
      }
      .report-view li p {
        text-indent: 0 !important;
        margin: 0 !important;
      }
      .report-view hr {
        border: none !important;
        border-top: 1px solid var(--color-border) !important;
        margin: 1.5em 0 !important;
      }
      .report-view em, .report-view i {
        font-style: italic !important;
      }
      .report-view strong, .report-view b {
        font-weight: bold !important;
      }
      .report-view blockquote {
        border-left: 3px solid var(--color-border) !important;
        padding-left: 1em !important;
        margin: 1em 0 !important;
        font-style: italic !important;
        color: var(--color-text-muted) !important;
      }
      .report-view table {
        font-family: "Times New Roman", Times, serif !important;
        border-collapse: collapse !important;
        width: 100% !important;
        margin: 1.2em 0 !important;
      }
      .report-view th, .report-view td {
        border: 1px solid var(--color-border) !important;
        padding: 8px 12px !important;
        font-family: "Times New Roman", Times, serif !important;
        font-size: 12pt !important;
        line-height: 1.5 !important;
      }
      .report-view th {
        background: var(--color-bg-alt) !important;
        font-weight: bold !important;
        text-align: center !important;
      }
      .report-view table.borderless {
        border: none !important;
      }
      .report-view table.borderless th, .report-view table.borderless td {
        border: none !important;
        background: transparent !important;
        background-color: transparent !important;
      }
      .report-view table.borderless th {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
  }, []);

  // ── Hydration ──
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);

      const rawSessions =
        localStorage.getItem(uSK.sessions) ??
        localStorage.getItem("report-assistant.sessions");
      const s = safeParse(rawSessions, []);
      const loadedSessions = Array.isArray(s) ? s : [];
      setSessions(loadedSessions);
      lastHistorySyncSignatureRef.current = historySyncSignature(
        username,
        loadedSessions,
      );

      // Fetch và đồng bộ lịch sử chat từ Database Supabase về UI khi load trang
      fetch(
        `/api/report-assistant/history?username=${encodeURIComponent(username)}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.ok && Array.isArray(data.sessions)) {
            if (data.sessions.length > 0) {
              setSessions(data.sessions);
              lastHistorySyncSignatureRef.current = historySyncSignature(
                username,
                data.sessions,
              );
              try {
                localStorage.setItem(uSK.sessions, JSON.stringify(data.sessions));
              } catch (err) {
                if (data.sessions.length > 5) {
                  try {
                    localStorage.setItem(uSK.sessions, JSON.stringify(data.sessions.slice(0, 5)));
                  } catch (e) {}
                }
              }
              // Set active session based on DB data if initialChatId is missing
              if (!initialChatId) {
                setActiveSessionId((prev) => {
                  const targetSession = (prev && data.sessions.some(s => s.id === prev)) ? prev : data.sessions[0].id;
                  setTimeout(() => router.replace(`/dashboard/report-assistant/${targetSession}`), 0);
                  return targetSession;
                });
              }
            }
          }
        })
        .catch((e) =>
          console.warn("Failed to fetch database chat history:", e),
        );

      let rawActiveSession = initialChatId;
      if (!rawActiveSession) {
        // Mở mặc định chat_id mới nhất từ localStorage
        if (loadedSessions && loadedSessions.length > 0) {
          rawActiveSession = loadedSessions[0].id;
        } else {
          rawActiveSession =
            localStorage.getItem(uSK.activeSession) ??
            localStorage.getItem("report-assistant.activeSession");
        }
        if (rawActiveSession) {
          setTimeout(() => router.replace(`/dashboard/report-assistant/${rawActiveSession}`), 0);
        }
      }
      setActiveSessionId(rawActiveSession || "");

      const rawSystemPrompt =
        localStorage.getItem(uSK.systemPrompt) ??
        localStorage.getItem("report-assistant.systemPrompt");
      const storedPrompt = rawSystemPrompt || "";
      setSystemPrompt(storedPrompt);

      const rawTemperature =
        localStorage.getItem(uSK.temperature) ??
        localStorage.getItem("report-assistant.temperature");
      setTemperature(parseFloat(rawTemperature) || DEFAULT_TEMPERATURE);

      // Restore selected knowledge subject from localStorage
      const savedSubject = localStorage.getItem(uSK.knowledgeSubject);
      if (savedSubject && savedSubject !== "none") {
        setSelectedKnowledgeSubject(savedSubject);
      }

      setAssistantOnlyMode(true);
    } catch { }
  }, [hydrated, usernameLoaded, username]);

  // ── Persist ──
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    const uSK = getSK(username);
    
    // Save sessions with quota handling
    try {
      localStorage.setItem(uSK.sessions, JSON.stringify(sessions));
    } catch (err) {
      console.warn("Storage quota exceeded, pruning old sessions...");
      try {
        // If quota exceeded, keep only the latest 5 sessions
        if (sessions.length > 5) {
          const pruned = sessions.slice(0, 5);
          localStorage.setItem(uSK.sessions, JSON.stringify(pruned));
        }
      } catch (e) {
        console.error("Failed to save even after pruning", e);
      }
    }

    try {
      localStorage.setItem(uSK.activeSession, activeSessionId);
      localStorage.setItem(uSK.activeModel, activeModelId);
      localStorage.setItem(uSK.systemPrompt, systemPrompt);
      localStorage.setItem(uSK.temperature, String(temperature));
      localStorage.setItem(
        uSK.assistantOnlyMode,
        assistantOnlyMode ? "true" : "false",
      );
      if (fullModelsLoaded) {
        localStorage.setItem(
          uSK.enabledModels,
          JSON.stringify([...enabledModelIds]),
        );
      }
    } catch { }
  }, [
    hydrated,
    usernameLoaded,
    username,
    sessions,
    activeSessionId,
    activeModelId,
    systemPrompt,
    temperature,
    enabledModelIds,
    fullModelsLoaded,
  ]);

  // ── Persist selectedKnowledgeSubject separately ──
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);
      localStorage.setItem(uSK.knowledgeSubject, selectedKnowledgeSubject || "none");
    } catch { }
  }, [hydrated, usernameLoaded, username, selectedKnowledgeSubject]);

  // ── Sync URL ──
  useEffect(() => {
    if (!hydrated) return;
    if (activeSessionId) {
      window.history.replaceState(null, '', `/dashboard/report-assistant/${activeSessionId}`);
    } else {
      window.history.replaceState(null, '', `/dashboard/report-assistant`);
    }
  }, [activeSessionId, hydrated]);

  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    if (hasStreamingMessage(sessions)) return;

    const signature = historySyncSignature(username, sessions);
    if (signature === lastHistorySyncSignatureRef.current) return;

    if (historySyncTimerRef.current) {
      clearTimeout(historySyncTimerRef.current);
    }

    historySyncTimerRef.current = setTimeout(() => {
      // Chỉ gửi 5 session mới nhất lên DB để tránh quá tải Payload Limit (gây lỗi 413)
      const payload = { username, sessions: sessions.slice(0, 5) };
      fetch("/api/report-assistant/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(() => {
          lastHistorySyncSignatureRef.current = signature;
        })
        .catch((e) => console.warn("report-assistant: persist sync failed", e));
    }, 400);

    return () => {
      if (historySyncTimerRef.current) {
        clearTimeout(historySyncTimerRef.current);
      }
    };
  }, [hydrated, usernameLoaded, username, sessions]);

  const { fetchUser } = useUserStore();

  const applyFullModelList = useCallback((models, uName) => {
    if (
      !Array.isArray(models) ||
      models.length === 0 ||
      typeof window === "undefined"
    )
      return;

    const uSK = getSK(uName);
    const rawEnabledModels =
      localStorage.getItem(uSK.enabledModels) ??
      localStorage.getItem("report-assistant.enabledModels");
    let enabledList = safeParse(rawEnabledModels, null);

    const enabledSet = new Set(enabledList || []);
    models.forEach((m) => enabledSet.add(m.id));
    enabledList = [...enabledSet];

    localStorage.setItem(uSK.enabledModels, JSON.stringify(enabledList));
    localStorage.setItem(
      uSK.knownModels,
      JSON.stringify(models.map((m) => m.id)),
    );

    setAllModels(models);
    setEnabledModelIds(enabledSet);
    setActiveModelId((prev) =>
      prev && models.some((m) => m.id === prev) ? prev : models[0]?.id || prev,
    );
  }, []);

  const loadFullModels = useCallback(async (uName = username) => {
    if (fullModelsLoaded) return;
    setLoadingModels(true);
    setLoadError("");
    try {
      const [modelsRes] = await Promise.all([
        fetch("/api/v1/models", { cache: "no-store" }),
      ]);
      const data = await modelsRes.json().catch(() => ({}));
      const rawModels = Array.isArray(data?.data) ? data.data : [];
      const lunaModels = getReportAssistantLunaModels(rawModels);
      const chatModels = getReportAssistantChatModels(rawModels);
      setReportModels(lunaModels);
      reportModelsLoadAttemptedRef.current = true;
      applyFullModelList(chatModels, uName);
      setFullModelsLoaded(true);
    } catch (err) {
      setLoadError(textValue(err?.message) || "Failed to load models.");
    } finally {
      setLoadingModels(false);
    }
  }, [applyFullModelList, fullModelsLoaded, username]);

  const handleModelDropdownToggle = useCallback(async () => {
    if (!modelDropOpen) await loadFullModels();
    setModelDropOpen((v) => !v);
  }, [loadFullModels, modelDropOpen]);

  const handleOpenSettings = useCallback(async () => {
    await loadFullModels();
    setSettingsOpen(true);
  }, [loadFullModels]);

  // ── Load models & API key ──
  useEffect(() => {
    async function load() {
      setLoadingModels(true);
      setLoadError("");
      try {
        const [keysRes, authData, promptRes] = await Promise.all([
          fetch("/api/keys", { cache: "no-store" }),
          fetchUser(),
          fetch("/api/report-assistant/harness-prompt", {
            cache: "no-store",
          }).catch(() => null),
        ]);
        const keysData = await keysRes.json().catch(() => ({}));
        if (promptRes && promptRes.ok) {
          const promptData = await promptRes.json().catch(() => ({}));
          if (promptData?.prompt) {
            setDefaultSystemPrompt(promptData.prompt);
          }
        }
        const key = Array.isArray(keysData?.keys)
          ? keysData.keys.find((k) => k.isActive !== false)?.key || ""
          : "";
        const uName = authData?.username || "admin";
        setUsername(uName);

        // Check if this is a restricted user
        const normalized = uName.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const restrictedUsers = ["trang", "thu", "thuy", "nga", "mai"];
        setIsRestrictedUser(restrictedUsers.includes(normalized));

        if (typeof window !== "undefined") {
          ensureKnowledgeCacheSessionOwner(uName);
          localStorage.setItem("report-assistant.activeUsername", uName);
        }
        setApiKey(key);
        void loadFullModels(uName);
      } catch (err) {
        setLoadError(textValue(err?.message) || "Failed to load models.");
      } finally {
        setLoadingModels(false);
        setUsernameLoaded(true);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Click outside dropdowns ──
  useEffect(() => {
    const fn = (e) => {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target))
        setModelDropOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, streamingId]);

  // ── Derived ──
  const enabledModels = useMemo(
    () => allModels.filter((m) => enabledModelIds.has(m.id)),
    [allModels, enabledModelIds],
  );

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
      ),
    [sessions],
  );

  const activeModel = useMemo(
    () =>
      enabledModels.find((m) => m.id === activeModelId) ||
      enabledModels[0] ||
      null,
    [enabledModels, activeModelId],
  );

  const loadAgentStatus = useCallback(async (chatId = activeSessionId, forceActive = false) => {
    if (!chatId) return null;
    agentCancelRequestedRef.current = false;
    setAgentLoading(true);
    try {
      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          chatId,
        }),
      });

      if (!res.ok) {
        throw new Error("Không thể tải trạng thái quy trình báo cáo.");
      }

      const data = await res.json().catch(() => null);
      if (data?.ok && data.state) {
        setAgentState(data.state);
        setAgentActive(forceActive ? true : !isAgentFinishedState(data.state));
        return data.state;
      }

      setAgentState(null);
      setAgentActive(false);
      return null;
    } catch (err) {
      console.error("Failed to load report assistant agent state:", err);
      setAgentState(null);
      setAgentActive(false);
      return null;
    } finally {
      setAgentLoading(false);
    }
  }, [activeSessionId]);

  const combinedFilesBySubject = useMemo(() => {
    const combined = {};
    for (const [subj, files] of Object.entries(filesOutlines || {})) {
      if (Array.isArray(files)) {
        combined[subj] = [...(combined[subj] || []), ...files];
      }
    }
    for (const [subj, files] of Object.entries(filesTemplates || {})) {
      if (Array.isArray(files)) {
        combined[subj] = [...(combined[subj] || []), ...files];
      }
    }
    return combined;
  }, [filesOutlines, filesTemplates]);

  const canSend =
    !isSending &&
    !!activeModel &&
    (draft.trim().length > 0 ||
      attachedFiles.some((f) => f.status === "success")) &&
    !attachedFiles.some((f) => f.status === "uploading");
  const messages = currentSession?.messages || [];
  const activeDoc = selectedReport || selectedOutline;
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  useEffect(() => {
    if (activeDoc) {
      setIsRenderingPreview(false);
      const timer = setTimeout(() => {
        setIsRenderingPreview(true);
      }, 400); // Wait for the slide-in animation to complete
      return () => clearTimeout(timer);
    } else {
      setIsRenderingPreview(false);
    }
  }, [activeDoc?.id || activeDoc?.title || activeDoc?.name]);

  const activeDocType = selectedReport
    ? "report"
    : selectedOutline
      ? "outline"
      : null;
  let activeDocTitle = activeDoc?.title || activeDoc?.name || "Preview";
  if (activeDocTitle.includes("Báo cáo hoàn chỉnh")) {
    activeDocTitle = getReportTitleWithDownloadCounter();
  }
  const activeDocFileName = `${activeDocTitle.replace(/[\\/:*?"<>|]/g, "_")}.docx`;

  // ── Session helpers ──
  const createSession = useCallback(
    (model, subject = selectedKnowledgeSubject) => ({
      id: createId(),
      title: "New Chat",
      modelId: model?.id || "",
      subject: subject || "none",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [selectedKnowledgeSubject],
  );

  const handleNewChat = useCallback(() => {
    if (!activeModel) return;
    const s = createSession(activeModel);
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setDraft("");
  }, [activeModel, createSession]);

  const handleDeleteSession = useCallback(
    (id, e) => {
      e.stopPropagation();
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) setActiveSessionId(next[0]?.id || "");
        return next;
      });
    },
    [activeSessionId],
  );

  const handleToggleModel = useCallback((modelId) => {
    setEnabledModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        if (next.size <= 1) return prev;
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }, []);

  // ── File upload helpers ──
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(
    async (item) => {
      if (!isSupabaseConfigured) {
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                ...f,
                status: "error",
                errorMsg: "Chưa cấu hình Supabase URL/Key",
              }
              : f,
          ),
        );
        return;
      }

      try {
        const fileExt = item.name.split(".").pop();
        const fileName = `${createId()}.${fileExt}`;
        const filePath = `report_uploads/${username}/${fileName}`;

        const { data, error } = await supabase.storage
          .from("ai_assistant")
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("ai_assistant")
          .getPublicUrl(filePath);

        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                ...f,
                status: "success",
                url: urlData.publicUrl,
              }
              : f,
          ),
        );
      } catch (err) {
        console.error("Upload error:", err);
        let errorMsg = err.message || "Tải lên thất bại";
        if (
          errorMsg.toLowerCase().includes("row-level security") ||
          errorMsg.toLowerCase().includes("permission denied") ||
          errorMsg.toLowerCase().includes("policy")
        ) {
          errorMsg = "Lỗi RLS Policy (Vui lòng thiết lập INSERT cho bucket)";
        }
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                ...f,
                status: "error",
                errorMsg,
              }
              : f,
          ),
        );
      }
    },
    [isSupabaseConfigured, username],
  );

  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const newFiles = files.map((file) => ({
        id: createId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        url: "",
        errorMsg: "",
      }));

      setAttachedFiles((prev) => [...prev, ...newFiles]);

      for (const item of newFiles) {
        uploadFile(item);
      }

      if (e.target) e.target.value = "";
    },
    [uploadFile],
  );

  const removeAttachedFile = useCallback((id) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── AI Agent Handlers ──
  const buildAgentReportContent = useCallback((state) => {
    const sections = state?.sections_progress || [];
    const hasInternshipReport = sections.some((section) => section?.reportContext?.internshipReport);
    const hasCareerReport = sections.some((section) => section?.reportContext?.careerOrientationReport);
    const reportBody = sections
      .filter((section) => String(section?.content || "").trim() || isB49InternshipOpeningSection(section))
      .map((section) => {
        const rawContent = String(section.content || "").trim();
        // Only strip preamble for internship B49 opening sections (dummy heading, real content at 1.1/1.2...).
        // Career orientation "I. PHẦN MỞ ĐẦU" has actual content and must NOT be stripped.
        const content = isB49InternshipOpeningSection(section)
          ? stripB49OpeningPreamble(rawContent)
          : rawContent;
        const firstLine =
          content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || "";
        const fNorm = normalizeDisplayLineForDedup(firstLine);
        const sNorm = normalizeDisplayLineForDedup(section.title);
        let sameTitle = false;
        if (fNorm) {
          if (fNorm === sNorm) {
            sameTitle = true;
          } else if (fNorm.length >= 4 && sNorm.includes(fNorm)) {
            sameTitle = true;
          } else if (sNorm.length >= 4 && fNorm.includes(sNorm)) {
            sameTitle = true;
          } else if (sNorm.includes("ket luan") && fNorm.includes("ket luan")) {
            sameTitle = true;
          } else if (sNorm.includes("tai lieu tham khao") && fNorm.includes("tai lieu tham khao")) {
            sameTitle = true;
          } else if (sNorm.includes("mo dau") && fNorm.includes("mo dau")) {
            sameTitle = true;
          } else if (sNorm.includes("loi mo dau") && fNorm.includes("loi mo dau")) {
            sameTitle = true;
          }
        }
        if (sameTitle) {
          const lines = content.split(/\r?\n/);
          const firstNonEmptyIdx = lines.findIndex(l => l.trim());
          if (firstNonEmptyIdx >= 0 && !lines[firstNonEmptyIdx].trim().startsWith("#")) {
            lines[firstNonEmptyIdx] = `# ${lines[firstNonEmptyIdx].trim()}`;
            return lines.join("\n");
          }
          return content;
        }
        return `# ${section.title}\n\n${content}`;
      })
      .join("\n\n[PAGE_BREAK]\n\n");

    const webSources = [];
    const seen = new Set();
    for (const section of sections) {
      for (const source of section?.web_sources || []) {
        const url = String(source?.url || "").trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        webSources.push({
          title: String(source?.title || url).trim(),
          url,
        });
      }
    }

    let finalBody = reportBody;
    if (hasInternshipReport && !/^\s*#\s*l[oơ]i m[oơ] d[aâ]u\b/i.test(reportBody)) {
      finalBody = `# LỜI MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
    } else if (hasCareerReport && !/^\s*#\s*(?:i\b|i\.\s*ph[aâ]n m[oơ] d[aâ]u)/i.test(reportBody)) {
      finalBody = `# I. PHẦN MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
    }

    const reportTitle = sections[0]?.reportContext?.reportTitle || state?.title || "";
    const isNoRefReport = hasCareerReport ||
      hasInternshipReport ||
      shouldExcludeReferences(reportTitle, finalBody);
    if (isNoRefReport || !webSources.length) return prepareReportContent(finalBody, reportTitle);

    const references = [
      "[PAGE_BREAK]",
      "## DANH MỤC TÀI LIỆU THAM KHẢO",
      ...webSources.map((source, index) => {
        return `${index + 1}. ${source.title}. Truy cập tại: ${source.url}`;
      }),
    ].join("\n");

    return prepareReportContent(finalBody
      ? `${finalBody}\n\n${references}`
      : references, reportTitle);
  }, []);

  const openAgentProgressPreview = useCallback(
    (state, titlePrefix = "Báo cáo tạm dừng") => {
      const content = buildAgentReportContent(state);
      if (!content) return false;

      setSelectedReport({
        title: `${titlePrefix} - ${new Date().toLocaleDateString("vi-VN")}`,
        content,
      });
      return true;
    },
    [buildAgentReportContent],
  );

  // When user clicks "Open" on a report_preview card, fetch content from Turso DB
  // so stale/buggy cached content is replaced and payload limits are bypassed.
  const handleOpenReportCard = useCallback(async (reportData) => {
    // 1. Immediately open the panel with cached content or a loading state to prevent unresponsiveness
    setSelectedReport({
      title: reportData?.title || getReportTitleWithDownloadCounter(),
      content: reportData?.content || "<div class='p-4'>Đang tải nội dung báo cáo...</div>",
    });

    if (activeSessionId) {
      try {
        const res = await fetch(`/api/report-assistant/report?chatId=${activeSessionId}&username=${encodeURIComponent(username || "")}`);
        if (res.ok) {
          const data = await res.json();
          // If Turso has data, use it
          if (data?.ok && data.data && data.data.length > 0) {
            const isCareer = reportData?.title?.toLowerCase().includes("định hướng nghề nghiệp") || 
                             reportData?.title?.toLowerCase().includes("career orientation") ||
                             data.data.some(s => String(s.content || "").toLowerCase().includes("định hướng nghề nghiệp"));
            const isInternship = reportData?.title?.toLowerCase().includes("kiến tập") || 
                                 reportData?.title?.toLowerCase().includes("ba49") || 
                                 reportData?.title?.toLowerCase().includes("b49") ||
                                 data.data.some(s => String(s.content || "").toLowerCase().includes("kiến tập"));
            
            const pseudoSections = data.data.map(item => ({
              id: item.section_id,
              title: item.section_title,
              content: item.content,
              reportContext: {
                internshipReport: isInternship,
                careerOrientationReport: isCareer,
                reportTitle: reportData?.title || getReportTitleWithDownloadCounter(),
              }
            }));

            const rebuilt = buildAgentReportContent({
              title: reportData?.title || getReportTitleWithDownloadCounter(),
              sections_progress: pseudoSections
            });

            if (rebuilt.trim()) {
              setSelectedReport({
                title: reportData?.title || getReportTitleWithDownloadCounter(),
                content: rebuilt,
              });
            }
          } 
          // If Turso is empty BUT we have old legacy data
          else if ((reportData?.sections_progress && reportData.sections_progress.length > 0) || reportData?.content) {
            let rebuilt = "";
            let sectionsToMigrate = [];

            if (reportData?.sections_progress && reportData.sections_progress.length > 0) {
              rebuilt = buildAgentReportContent({
                title: reportData?.title || getReportTitleWithDownloadCounter(),
                sections_progress: reportData.sections_progress
              });
              sectionsToMigrate = reportData.sections_progress;
            } else if (reportData?.content) {
              rebuilt = reportData.content;
              sectionsToMigrate = [{ id: 'legacy_report', title: reportData.title || 'Báo cáo', content: reportData.content, status: 'completed' }];
            }

            if (rebuilt.trim()) {
              setSelectedReport({
                title: reportData?.title || getReportTitleWithDownloadCounter(),
                content: rebuilt,
              });
            }
            
            // Background migration to Turso DB
            if (sectionsToMigrate.length > 0) {
              fetch("/api/report-assistant/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: activeSessionId,
                  username: username || "default_user",
                  sections: sectionsToMigrate
                })
              }).catch(console.error);
            }
          }
        }
      } catch (_) {
        // Ignore fetch errors, fall back to stored content
      }
    }
  }, [activeSessionId, buildAgentReportContent, username]);

  const openReportWorkflowConfirm = useCallback((request) => {
    reportModelsLoadAttemptedRef.current = false;
    setPendingReportRequest(request);
    const nextModelId = getReportWorkflowDefaultModelId(reportModels);
    setSelectedReportModelId(nextModelId);
    setReportWorkflowModelId(nextModelId);
  }, [reportModels]);

  const closeReportWorkflowConfirm = useCallback(() => {
    setPendingReportRequest(null);
    setSelectedReportModelId("");
    setReportWorkflowModelId("");
  }, []);

  useEffect(() => {
    if (!pendingReportRequest) return;
    if (!reportModelsLoading) {
      loadReportModels();
    }
  }, [pendingReportRequest, reportModelsLoading, loadReportModels]);

  const runAgentInit = useCallback(
    async (userPrompt, modelId, chatId, subjectOverride = "") => {
      const runId = `run_${createId()}`;
      agentCancelRequestedRef.current = false;
      setAgentLoading(true);
      setSelectedReport(null);
      setSelectedOutline(null);
      setAgentActive(true);
      setAgentState({
        chat_id: chatId,
        current_step: "PLANNING",
        outline: [],
        sections_progress: [
          {
            id: "planning",
            title: "Đang tạo quy trình",
            description:
              "AI đang đọc hiểu đề cương, báo cáo mẫu và yêu cầu của bạn để lập quy trình phù hợp.",
            status: "drafting",
            content: "",
            feedback: "",
          },
        ],
      });
      try {
        let outlineKnowledge = "";
        let templateKnowledge = "";
        const selectedOutlineSubject =
          subjectOverride && subjectOverride !== "none"
            ? subjectOverride
            : "";

        if (selectedOutlineSubject) {
          try {
            const rows = await fetchKnowledgeContentCached(REPORT_OUTLINE_CONTENT_USER, {
              subject: selectedOutlineSubject,
            });
            outlineKnowledge = rows
              .map((row) => {
                const text = (row.content_text || "").trim();
                if (!text) return "";
                return `[De cuong: ${row.filename || selectedOutlineSubject}]\n${text}`;
              })
              .filter(Boolean)
              .join("\n\n");
          } catch (knowledgeErr) {
            console.warn(
              "Failed to load selected outline knowledge:",
              knowledgeErr,
            );
          }

          if (!outlineKnowledge) {
            const outlineFiles = filesOutlines?.[selectedOutlineSubject] || [];
            const outlineParts = [];

            await Promise.all(
              outlineFiles.map(async (fileInfo) => {
                if (!fileInfo?.url) return;
                const fileName = fileInfo.name || "";
                const isPdf = /\.pdf$/i.test(fileName);
                const isDocx = /\.docx$/i.test(fileName);
                const isText =
                  /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
                    fileName,
                  );

                try {
                  const fileRes = await fetch(fileInfo.url);
                  if (!fileRes.ok) return;

                  if (isPdf) {
                    const arrayBuf = await fileRes.arrayBuffer();
                    const pdfBlob = new Blob([arrayBuf], {
                      type: "application/pdf",
                    });
                    const pdfFile = new File([pdfBlob], fileName, {
                      type: "application/pdf",
                    });
                    const result = await parsePdfText(pdfFile);
                    if (result.text) {
                      outlineParts.push(
                        `[De cuong: ${fileName}]\n${result.text}`,
                      );
                    }
                  } else if (isDocx) {
                    const arrayBuf = await fileRes.arrayBuffer();
                    const docxBlob = new Blob([arrayBuf], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    const docxFile = new File([docxBlob], fileName, {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    const result = await parseDocxText(docxFile);
                    if (result.text) {
                      outlineParts.push(
                        `[De cuong: ${fileName}]\n${result.text}`,
                      );
                    }
                  } else if (isText) {
                    const text = await fileRes.text();
                    if (text)
                      outlineParts.push(`[De cuong: ${fileName}]\n${text}`);
                  }
                } catch (fileErr) {
                  console.warn(
                    "Failed to load selected outline file:",
                    fileErr,
                  );
                }
              }),
            );

            outlineKnowledge = outlineParts.join("\n\n");
          }

          try {
            const rows = await fetchKnowledgeContentCached(REPORT_TEMPLATE_CONTENT_USER, {
              subject: selectedOutlineSubject,
            });
            templateKnowledge = rows
              .slice(0, 3)
              .map((row) => {
                const text = (row.content_text || "").trim();
                if (!text) return "";
                return `[Bao cao mau: ${row.filename || selectedOutlineSubject}]\n${text.slice(0, 8000)}`;
              })
              .filter(Boolean)
              .join("\n\n");
          } catch (templateErr) {
            console.warn(
              "Failed to load selected template knowledge:",
              templateErr,
            );
          }

          if (!templateKnowledge) {
            const templateFiles = filesTemplates?.[selectedOutlineSubject] || [];
            const templateParts = [];

            await Promise.all(
              templateFiles.slice(0, 3).map(async (fileInfo) => {
                if (!fileInfo?.url) return;
                const fileName = fileInfo.name || "";
                const isPdf = /\.pdf$/i.test(fileName);
                const isDocx = /\.docx$/i.test(fileName);
                const isText =
                  /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
                    fileName,
                  );

                try {
                  const fileRes = await fetch(fileInfo.url);
                  if (!fileRes.ok) return;

                  if (isPdf) {
                    const arrayBuf = await fileRes.arrayBuffer();
                    const pdfBlob = new Blob([arrayBuf], {
                      type: "application/pdf",
                    });
                    const pdfFile = new File([pdfBlob], fileName, {
                      type: "application/pdf",
                    });
                    const result = await parsePdfText(pdfFile);
                    if (result.text) {
                      templateParts.push(
                        `[Bao cao mau: ${fileName}]\n${result.text.slice(0, 8000)}`,
                      );
                    }
                  } else if (isDocx) {
                    const arrayBuf = await fileRes.arrayBuffer();
                    const docxBlob = new Blob([arrayBuf], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    const docxFile = new File([docxBlob], fileName, {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    });
                    const result = await parseDocxText(docxFile);
                    if (result.text) {
                      templateParts.push(
                        `[Bao cao mau: ${fileName}]\n${result.text.slice(0, 8000)}`,
                      );
                    }
                  } else if (isText) {
                    const text = await fileRes.text();
                    if (text) {
                      templateParts.push(
                        `[Bao cao mau: ${fileName}]\n${text.slice(0, 8000)}`,
                      );
                    }
                  }
                } catch (fileErr) {
                  console.warn(
                    "Failed to load selected template file:",
                    fileErr,
                  );
                }
              }),
            );

            templateKnowledge = templateParts.join("\n\n");
          }
        }

        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            chatId,
            username,
            subject: selectedOutlineSubject || "Báo cáo tự động",
            outlineSource: selectedOutlineSubject,
            outlineKnowledge,
            templateKnowledge,
            modelId,
            userPrompt,
            runId,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            data?.error ||
            data?.message ||
            `Khởi tạo Agent thất bại (HTTP ${res.status})`;
          throw new Error(message);
        }
        if (!data.ok) {
          const classified = classifyAgentDraftError(
            0,
            JSON.stringify(data.error || data.message || data),
          );
          const err = new Error(classified.message);
          err.agentDialog = classified;
          throw err;
        }
        if (data.ok && data.state) {
          setAgentState(data.state);
          setAgentActive(true);
          showToast("Agent đã lập đề cương báo cáo thành công!", "success");
        }
      } catch (err) {
        console.error(err);
        setAgentActive(false);
        setAgentState(null);
        showToast(err.message, "error");
      } finally {
        setAgentLoading(false);
      }
    },
    [filesOutlines, filesTemplates, username],
  );

  const confirmReportWorkflow = useCallback(async () => {
    const request = pendingReportRequest;
    if (!request) return;

    let model =
      reportModels.find((m) => m.id === (reportWorkflowModelId || selectedReportModelId)) ||
      reportModels[0];
    if (!model && reportModels.length === 0) {
      model = activeModel;
    }
    if (!model) {
      showToast("Không tìm thấy model để khởi chạy quy trình báo cáo.", "error");
      return;
    }

    const requestSubject =
      request.subject ||
      sessions.find((s) => s.id === (request.sessionId || activeSessionId))?.subject ||
      selectedKnowledgeSubject ||
      "none";

    let sessionId = request.sessionId || activeSessionId;
    let session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      session = createSession(model, requestSubject);
      sessionId = session.id;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(sessionId);
    }

    const userMsg = {
      id: createId(),
      role: "user",
      content: request.content || "Tạo báo cáo",
      files: request.files || [],
      createdAt: new Date().toISOString(),
    };

    const prevMsgs = session ? session.messages || [] : [];
    const replaceIdx = request.replaceUserMsgId
      ? prevMsgs.findIndex((message) => message.id === request.replaceUserMsgId)
      : -1;
    const nextMsgs =
      replaceIdx >= 0
        ? [...prevMsgs.slice(0, replaceIdx), userMsg]
        : [...prevMsgs, userMsg];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
            ...s,
            messages: nextMsgs,
            title:
              s.title === "New Chat"
                ? makeTitle(request.content || "Yêu cầu báo cáo")
                : s.title,
            modelId: model.id,
            subject: requestSubject,
            updatedAt: new Date().toISOString(),
          }
          : s,
      ),
    );

    setSelectedReport(null);
    setSelectedOutline(null);
    setAgentActive(true);
    setAgentState({
      chat_id: sessionId,
      current_step: "PLANNING",
      outline: [],
      sections_progress: [
        {
          id: "planning",
          title: "Đang tạo quy trình",
          description:
            "AI đang phân tích yêu cầu, đọc đề cương và tham khảo báo cáo mẫu để tạo quy trình phù hợp.",
          status: "drafting",
          content: "",
          feedback: "",
        },
      ],
    });
    setPendingReportRequest(null);
    setSelectedKnowledgeSubject(requestSubject);
    setDraft("");
    setAttachedFiles([]);
    void runAgentInit(request.content || "Tạo báo cáo", model.id, sessionId, requestSubject);
  }, [
    pendingReportRequest,
    reportModels,
    selectedReportModelId,
    reportWorkflowModelId,
    activeSessionId,
    sessions,
    createSession,
    runAgentInit,
    selectedKnowledgeSubject,
  ]);

  const appendAgentResultCardsMessage = useCallback(
    (state) => {
      if (!activeSessionId) return;
      const content = buildAgentReportContent(state);
      if (!content) return;

      const now = new Date();
      const dateLabel = `${now.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })} ${now.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
      })}`;
      const reportTitle = getReportTitleWithDownloadCounter();

      const resultMessage = {
        id: `agent_result_${activeSessionId}_${Date.now()}`,
        role: "assistant",
        kind: "agent_result_cards",
        content: "",
        status: "done",
        createdAt: now.toISOString(),
        cards: [
          {
            type: "agent_run",
            title: "Dàn ý báo cáo",
            dateLabel,
            chatId: activeSessionId,
          },
          {
            type: "report_preview",
            title: reportTitle,
            dateLabel,
            report: {
              title: reportTitle,
              content,
            },
          },
        ],
      };

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) return session;
          const hasCards = (session.messages || []).some(
            (message) => message.kind === "agent_result_cards",
          );
          if (hasCards) return session;
          const withoutOldCards = (session.messages || []).filter(
            (message) => message.kind !== "agent_result_cards",
          );
          return {
            ...session,
            updatedAt: now.toISOString(),
            messages: [...withoutOldCards, resultMessage],
          };
        }),
      );
    },
    [activeSessionId, buildAgentReportContent],
  );

  const handleOpenAgentRunFromCard = useCallback(
    async (chatId) => {
      if (chatId && chatId !== activeSessionId) {
        setActiveSessionId(chatId);
      }
      setSelectedReport(null);
      setSelectedOutline(null);
      setAgentActive(true);
      await loadAgentStatus(chatId || activeSessionId, true);
    },
    [activeSessionId, loadAgentStatus],
  );

  const ensureAgentResultCardsForState = useCallback(
    (state, chatId = activeSessionId) => {
      if (!chatId) return;
      if (
        state?.current_step !== "COMPLETED" &&
        state?.current_step !== "OUTLINING" &&
        state?.current_step !== "DRAFTING"
      )
        return;

      const stateChatId = state?.chat_id || state?.chatId;
      if (stateChatId && stateChatId !== chatId) return;

      const runId = state?.sections_progress?.[0]?.reportContext?.runId || state?.outline?.[0]?.reportContext?.runId || `fallback_run_${chatId}`;
      if (!runId) return;

      const content = buildAgentReportContent(state);

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== chatId) return session;

          const completedAt =
            state.updated_at || session.updatedAt || new Date().toISOString();
          const date = new Date(completedAt);
          const dateLabel = `${date.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })} ${date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "short",
          })}`;

          const cards = [];
          if (state.current_step === "OUTLINING") {
            cards.push({
              type: "agent_run",
              title: "Dàn ý báo cáo (Đang chờ duyệt)",
              dateLabel,
              chatId,
            });
          } else if (state.current_step === "DRAFTING") {
            cards.push({
              type: "agent_run",
              title: "Dàn ý báo cáo (Đang soạn thảo...)",
              dateLabel,
              chatId,
            });
          } else if (state.current_step === "COMPLETED" && content) {
            cards.push({
              type: "agent_run",
              title: "Dàn ý báo cáo",
              dateLabel,
              chatId,
            });
            const reportTitle = getReportTitleWithDownloadCounter();
            cards.push({
              type: "report_preview",
              title: reportTitle,
              dateLabel,
              report: {
                title: reportTitle,
                content,
                sections_progress: state.sections_progress || [],
              },
            });
          }

          if (cards.length === 0) return session;

          const hasCards = (session.messages || []).some(
            (message) => message.kind === "agent_result_cards" && message.runId === runId,
          );

          let nextMessages;
          if (hasCards) {
            nextMessages = (session.messages || []).map((message) => {
              if (message.kind === "agent_result_cards" && message.runId === runId) {
                return {
                  ...message,
                  cards,
                };
              }
              return message;
            });
          } else {
            nextMessages = [
              ...(session.messages || []),
              {
                id: `agent_result_${chatId}_${runId}_${Date.now()}`,
                role: "assistant",
                kind: "agent_result_cards",
                runId,
                content: "",
                status: "done",
                createdAt: completedAt,
                cards,
              },
            ];
          }

          return {
            ...session,
            messages: nextMessages,
          };
        }),
      );
    },
    [activeSessionId, buildAgentReportContent],
  );

  useEffect(() => {
    if (
      agentState?.current_step === "COMPLETED" ||
      agentState?.current_step === "OUTLINING" ||
      agentState?.current_step === "DRAFTING"
    ) {
      ensureAgentResultCardsForState(agentState, activeSessionId);
    }
  }, [activeSessionId, agentState, ensureAgentResultCardsForState]);


  const handleApproveOutline = useCallback(
    async (customOutline = null) => {
      if (!activeSessionId) return;
      agentCancelRequestedRef.current = false;
      setAgentLoading(true);
      try {
        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve_outline",
            chatId: activeSessionId,
            username,
            outline: customOutline || agentState?.outline,
          }),
        });

        if (!res.ok) throw new Error("Duyệt đề cương thất bại");
        const data = await res.json();
        if (data.ok && data.state) {
          setSelectedReport(null);
          setSelectedOutline(null);
          setAgentActive(true);
          setAgentState(data.state);
          showToast("Đã duyệt đề cương! Agent bắt đầu soạn thảo...", "success");
          // The useEffect hook automatically watches agentState and agentActive and will trigger
          // handleDraftNextSection() when the state transition to DRAFTING is complete.
        }
      } catch (err) {
        console.error(err);
        showToast(err.message, "error");
      } finally {
        setAgentLoading(false);
      }
    },
    [activeSessionId, username, agentState],
  );

  const handleCancelAgent = useCallback(async () => {
    if (!activeSessionId) return;
    agentCancelRequestedRef.current = true;
    setAgentLoading(true);

    try {
      const stateBeforeCancel = agentState;
      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          chatId: activeSessionId,
          username,
        }),
      });

      if (!res.ok) throw new Error("Hủy quy trình Agent thất bại");
      const data = await res.json();
      const nextState = data.state || stateBeforeCancel;

      if (nextState) {
        setAgentState(nextState);
      }

      const openedPreview = openAgentProgressPreview(
        nextState,
        "Báo cáo tạm dừng",
      );
      if (!openedPreview) {
        setAgentActive(false);
        setAgentState(null);
      }

      showToast(
        openedPreview
          ? "Đã hủy Agent. Preview đang hiển thị phần đã làm được."
          : "Đã hủy quy trình Agent.",
        "info",
      );
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setAgentLoading(false);
    }
  }, [activeSessionId, username, agentState, openAgentProgressPreview]);

  const handleStopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session;
        return {
          ...session,
          messages: (session.messages || []).map((message) =>
            message.id === streamingId
              ? {
                ...message,
                status: "done",
                content: message.content || "Đã dừng phản hồi.",
              }
              : message,
          ),
        };
      }),
    );

    setIsSending(false);
    setStreamingId("");
  }, [activeSessionId, streamingId]);

  const markNextSectionDraftingOptimistically = useCallback(() => {
    setAgentState((prev) => {
      if (
        !prev ||
        prev.current_step === "COMPLETED" ||
        prev.current_step === "CANCELLED" ||
        prev.current_step === "REVIEW_REQUIRED"
      ) {
        return prev;
      }

      const sections = Array.isArray(prev.sections_progress)
        ? prev.sections_progress
        : [];
      const activeIndex = sections.findIndex(
        (section) => section.status === "drafting" || section.status === "todo",
      );
      if (activeIndex < 0) {
        return {
          ...prev,
          current_step: prev.current_step === "OUTLINING" ? "DRAFTING" : prev.current_step,
        };
      }

      const nextSections = sections.map((section, index) => {
        if (index !== activeIndex) return section;
        if (section.status === "drafting") return section;
        return {
          ...section,
          status: "drafting",
          activity: {
            phase: "section_started",
            message: `Agent đang xử lý mục: ${section.title}`,
            details: { actor: "Report Agent", optimistic: true },
            updatedAt: new Date().toISOString(),
          },
        };
      });

      return {
        ...prev,
        current_step: "DRAFTING",
        sections_progress: nextSections,
      };
    });
  }, []);

  const handleDraftNextSection = useCallback(
    async (criticFeedback = "") => {
      if (!activeSessionId || agentCancelRequestedRef.current) return;
      if (agentDraftingInProgressRef.current) {
        console.log("Draft next section is already in progress, skipping duplicate call.");
        return;
      }
      agentDraftingInProgressRef.current = true;
      setAgentLoading(true);
      markNextSectionDraftingOptimistically();
      let keepLoading = false;
      try {
        let activeModel =
          reportModels.find((m) => m.id === (reportWorkflowModelId || selectedReportModelId)) ||
          reportModels[0];
        if (!activeModel && reportModels.length === 0) {
          activeModel = enabledModels.find((m) => m.id === activeModelId) || enabledModels[0];
        }
        if (!activeModel) {
          throw new Error("Không tìm thấy model hợp lệ cho quy trình báo cáo.");
        }
        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "draft_next_worker",
            chatId: activeSessionId,
            username,
            modelId: activeModel?.id,
            feedback: criticFeedback,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => "");
          const classified = classifyAgentDraftError(res.status, errorText);
          const err = new Error(classified.message);
          err.agentDialog = classified;
          throw err;
        }
        const data = await res.json();
        if (data.ok && data.state) {
          if (agentCancelRequestedRef.current) return;

          if (data.workerAlreadyRunning) {
            if (data.state) {
              setAgentState(data.state);
            }
            keepLoading = false;
            setAgentLoading(false);
            setAgentActive(false);
            showToast("Báo cáo đang được xử lý ở một cửa sổ/worker khác.", "warning");
            return;
          }

          // Loop guard: verify that the server advanced the section status
          const sectionsBefore = agentState?.sections_progress || [];
          const targetSection = sectionsBefore.find((s) => s.status === "todo" || s.status === "drafting");
          if (targetSection) {
            const sectionsAfter = data.state.sections_progress || [];
            const targetSectionAfter = sectionsAfter.find((s) => s.id === targetSection.id);
            if (targetSectionAfter && targetSectionAfter.status === "todo") {
              const err = new Error("Hệ thống không thể lưu hoặc đồng bộ tiến trình soạn thảo. Vui lòng kiểm tra lại kết nối Supabase của bạn.");
              err.agentDialog = {
                title: "Lỗi đồng bộ cơ sở dữ liệu",
                message: "Tiến trình soạn thảo chương mục không thể được cập nhật trên máy chủ. Hãy đảm bảo cơ sở dữ liệu Supabase đang hoạt động bình thường.",
                detail: "State did not advance on the server (remained in todo state).",
              };
              throw err;
            }
          }

          setAgentState(data.state);
          if (data.state.current_step === "REVIEW_REQUIRED") {
            keepLoading = false;
            setAgentLoading(false);
            setAgentActive(true);
            showToast("Critic yêu cầu xem lại mục vừa soạn.", "warning");
            return;
          }
          if (data.emptyDraft) {
            keepLoading = false;
            setAgentActive(false);
            setAgentErrorDialog({
              title: "Chưa nhận được nội dung từ Luna",
              message: "Luna/Qwen đã trả về phản hồi rỗng cho mục hiện tại. Mục này vẫn được giữ trong hàng chờ, chưa bị đánh dấu hoàn thành.",
              detail: data.message || "Empty draft response from report agent.",
            });
            return;
          }
          if (data.queued) {
            keepLoading = true;
            return;
          }
          if (isAgentFinishedState(data.state)) {
            showToast(
              "AI Agent đã hoàn thành xuất sắc toàn bộ báo cáo!",
              "success",
            );
            setAgentActive(false);
            appendAgentResultCardsMessage(data.state);
          } else {
            const sections = data.state.sections_progress || [];
            keepLoading = sections.some((section) => section.status === "todo");
            showToast(
              `Đã hoàn thành mục: ${data.activeSectionId || "chương mục"}`,
              "success",
            );
          }
        }
      } catch (err) {
        console.error(err);
        agentCancelRequestedRef.current = true;
        setAgentLoading(false);
        setAgentActive(false);
        setAgentErrorDialog(
          err.agentDialog ||
          classifyAgentDraftError(0, "", err),
        );
      } finally {
        agentDraftingInProgressRef.current = false;
        if (!keepLoading) {
          setAgentLoading(false);
        }
      }
    },
    [
      activeSessionId,
      username,
      activeModelId,
      reportModels,
      reportWorkflowModelId,
      selectedReportModelId,
      appendAgentResultCardsMessage,
      markNextSectionDraftingOptimistically,
    ],
  );

  const handleReloadSection = useCallback(
    async (sectionId) => {
      if (!activeSessionId) return;
      agentCancelRequestedRef.current = false;
      setAgentLoading(true);
      try {
        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reload_section",
            chatId: activeSessionId,
            username,
            sectionId,
          }),
        });

        if (!res.ok) throw new Error("Gửi yêu cầu tạo lại mục thất bại");
        const data = await res.json();
        if (data.ok && data.state) {
          setAgentState(data.state);
          setAgentActive(true);
          showToast("Đã đặt lại trạng thái mục! Đang bắt đầu tạo lại...", "success");
          // The useEffect hook monitors agentState and agentActive and will automatically
          // trigger handleDraftNextSection() when state updates.
        }
      } catch (err) {
        console.error(err);
        showToast(err.message, "error");
      } finally {
        setAgentLoading(false);
      }
    },
    [activeSessionId, username, handleDraftNextSection],
  );

  useEffect(() => {
    if (
      !agentActive ||
      !agentLoading ||
      !activeSessionId ||
      agentState?.current_step !== "DRAFTING"
    ) {
      return;
    }

    let stopped = false;
    const pollStatus = async () => {
      try {
        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            chatId: activeSessionId,
            username,
            modelId: reportWorkflowModelId || selectedReportModelId || activeModelId,
          }),
        });
        if (!res.ok || stopped || agentCancelRequestedRef.current) return;
        const data = await res.json().catch(() => null);
        if (data?.ok && data.state && !stopped) {
          setAgentState(data.state);
          if (data.state.current_step === "COMPLETED") {
            stopped = true;
            setAgentLoading(false);
            setAgentActive(false);
            appendAgentResultCardsMessage(data.state);
            showToast(
              "AI Agent đã hoàn thành xuất sắc toàn bộ báo cáo!",
              "success",
            );
          } else if (data.state.current_step === "CANCELLED") {
            stopped = true;
            setAgentLoading(false);
            setAgentActive(false);
          }
        }
      } catch (err) {
        console.warn("Agent status polling failed:", err);
      }
    };

    pollStatus();
    const timer = setInterval(pollStatus, 8000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [
    activeSessionId,
    agentActive,
    agentLoading,
    agentState?.current_step,
    activeModelId,
    reportWorkflowModelId,
    selectedReportModelId,
    username,
    appendAgentResultCardsMessage,
  ]);

  useEffect(() => {
    if (
      !agentActive ||
      !activeSessionId ||
      agentState?.current_step !== "DRAFTING" ||
      agentCancelRequestedRef.current
    ) {
      return;
    }

    const sections = agentState.sections_progress || [];
    const hasDrafting = sections.some((section) => section.status === "drafting");
    const hasTodo = sections.some((section) => section.status === "todo");

    if (!hasDrafting && hasTodo && !agentQueueingRef.current) {
      agentQueueingRef.current = true;
      const timer = setTimeout(async () => {
        try {
          if (!agentCancelRequestedRef.current) {
            await handleDraftNextSection();
          }
        } finally {
          agentQueueingRef.current = false;
        }
      }, 600);
      return () => {
        clearTimeout(timer);
        agentQueueingRef.current = false;
      };
    }
  }, [
    activeSessionId,
    agentActive,
    agentState,
    handleDraftNextSection,
  ]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const model = activeModel;
    const activeAttached = attachedFiles.filter((f) => f.status === "success");
    const userPrompt = draft.trim();
    if (!model || (!userPrompt && activeAttached.length === 0)) return;

    const serializedAttachments = await buildSerializedAttachments(activeAttached);

    const explicitReportRequest = isReportIntent(userPrompt);

    let sessionId = activeSessionId;
    let session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      session = createSession(model);
      sessionId = session.id;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(sessionId);
    }

    if (explicitReportRequest) {
      if (!selectedKnowledgeSubject || selectedKnowledgeSubject === "none") {
        const userMsg = {
          id: createId(),
          role: "user",
          content: userPrompt || "Tạo báo cáo",
          files: serializedAttachments,
          createdAt: new Date().toISOString(),
        };
        const warnMsg = {
          id: createId(),
          role: "assistant",
          content:
            "⚠️ **Vui lòng lựa chọn một chủ đề/loại báo cáo** từ danh mục lựa chọn bên dưới thanh nhập liệu trước khi yêu cầu khởi tạo báo cáo, giúp tôi lập đề cương và nạp tri thức mẫu chính xác nhất.",
          createdAt: new Date().toISOString(),
        };

        const prevMsgs = session ? session.messages || [] : [];
        const nextMsgs = [...prevMsgs, userMsg, warnMsg];

        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                ...s,
                messages: nextMsgs,
                title:
                  s.title === "New Chat"
                    ? makeTitle(userPrompt || "Yêu cầu báo cáo")
                    : s.title,
                modelId: model.id,
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
        setDraft("");
        setAttachedFiles([]);
        return;
      }

      openReportWorkflowConfirm({
        content: userPrompt,
        subject: selectedKnowledgeSubject,
        files: serializedAttachments,
        sessionId,
        modelId: model.id,
      });
      showToast("Đã phát hiện yêu cầu tạo báo cáo. Hãy xác nhận để khởi chạy quy trình Agent.", "info");
      return;
    }

    if (false && agentModeEnabled) {
      if (!selectedKnowledgeSubject || selectedKnowledgeSubject === "none") {
        const userMsg = {
          id: createId(),
          role: "user",
          content: userPrompt || "Tạo báo cáo",
          files: serializedAttachments,
          createdAt: new Date().toISOString(),
        };
        const warnMsg = {
          id: createId(),
          role: "assistant",
          content:
            "⚠️ **Vui lòng lựa chọn một chủ đề/loại báo cáo** từ danh mục lựa chọn bên dưới thanh nhập liệu trước khi yêu cầu khởi tạo báo cáo, giúp tôi lập đề cương và nạp tri thức mẫu chính xác nhất.",
          createdAt: new Date().toISOString(),
        };

        const prevMsgs = session ? session.messages || [] : [];
        const nextMsgs = [...prevMsgs, userMsg, warnMsg];

        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                ...s,
                messages: nextMsgs,
                title:
                  s.title === "New Chat"
                    ? makeTitle(userPrompt || "Yêu cầu báo cáo")
                    : s.title,
                modelId: model.id,
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
        setDraft("");
        setAttachedFiles([]);
        return;
      }

      const userMsg = {
        id: createId(),
        role: "user",
        content: userPrompt,
        files: serializedAttachments,
        createdAt: new Date().toISOString(),
      };

      const prevMsgs = session ? session.messages || [] : [];
      const nextMsgs = [...prevMsgs, userMsg];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
              ...s,
              messages: nextMsgs,
              title: s.title === "New Chat" ? makeTitle(userPrompt) : s.title,
              modelId: model.id,
              updatedAt: new Date().toISOString(),
            }
            : s,
        ),
      );

      setDraft("");
      setAttachedFiles([]);
      runAgentInit(userPrompt, model.id, sessionId);
      return;
    }

    const userMsg = {
      id: createId(),
      role: "user",
      content: userPrompt,
      files: serializedAttachments,
      createdAt: new Date().toISOString(),
    };
    const asstId = createId();
    const asstMsg = {
      id: asstId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: new Date().toISOString(),
    };
    const prevMsgs = session.messages || [];
    const nextMsgs = [...prevMsgs, userMsg, asstMsg];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
            ...s,
            messages: nextMsgs,
            title:
              s.title === "New Chat"
                ? makeTitle(
                  userPrompt || activeAttached[0]?.name || "Attached File",
                )
                : s.title,
            modelId: model.id,
            updatedAt: new Date().toISOString(),
          }
          : s,
      ),
    );

    // Clear inputs immediately
    setDraft("");
    setAttachedFiles([]);

    setIsSending(true);
    setStreamingId(asstId);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const reqMsgs = [];
    const outlinesTextList = [];
    const templatesTextList = [];

    // Report requests return before this point and go through /api/report-assistant/agent.
    // Everything here is normal chat and must use the completions endpoint only.
    const shouldUseReportMode = false;

    const allOutlines = [];
    for (const [subj, files] of Object.entries(filesOutlines || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allOutlines.push({ ...f, subject: subj });
        }
      }
    }

    const allTemplates = [];
    for (const [subj, files] of Object.entries(filesTemplates || {})) {
      if (Array.isArray(files)) {
        for (const f of files) {
          allTemplates.push({ ...f, subject: subj });
        }
      }
    }

    if (shouldUseReportMode && allOutlines.length > 0) {
      let outlinesContentMap = {};
      try {
        const dbRes = await fetch(
          `/api/knowledge-content?username=${encodeURIComponent(REPORT_OUTLINE_CONTENT_USER)}&includeContent=1`,
        );
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          for (const row of dbData.data || []) {
            outlinesContentMap[`${row.subject}::${row.filename}`] =
              row.content_text;
          }
        }
      } catch (e) { }

      await Promise.all(
        allOutlines.map(async (f) => {
          const isPdf = /\.pdf$/i.test(f.name);
          const isText =
            /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
              f.name,
            );
          const dbKey = `${f.subject}::${f.name}`;

          if (outlinesContentMap[dbKey]) {
            outlinesTextList.push({
              name: f.name,
              content: outlinesContentMap[dbKey],
              subject: f.subject,
            });
          } else if (f.url && isPdf) {
            try {
              const pdfRes = await fetch(f.url);
              if (pdfRes.ok) {
                const arrayBuf = await pdfRes.arrayBuffer();
                const pdfBlob = new Blob([arrayBuf], {
                  type: "application/pdf",
                });
                const pdfFile = new File([pdfBlob], f.name, {
                  type: "application/pdf",
                });
                const result = await parsePdfText(pdfFile);
                if (result.text) {
                  outlinesTextList.push({
                    name: f.name,
                    content: result.text,
                    subject: f.subject,
                  });
                  fetch("/api/knowledge-content", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: REPORT_OUTLINE_CONTENT_USER,
                      subject: f.subject,
                      filename: f.name,
                      content_text: result.text,
                      page_count: result.pageCount,
                      file_url: f.url,
                    }),
                  }).catch(() => { });
                }
              }
            } catch (e) {
              outlinesTextList.push({
                name: f.name,
                url: f.url,
                subject: f.subject,
              });
            }
          } else if (f.url && isText) {
            try {
              const res = await fetch(f.url);
              if (res.ok) {
                const content = await res.text();
                if (content) {
                  outlinesTextList.push({
                    name: f.name,
                    content,
                    subject: f.subject,
                  });
                }
              }
            } catch (e) { }
          } else if (f.url) {
            outlinesTextList.push({
              name: f.name,
              url: f.url,
              subject: f.subject,
            });
          }
        }),
      );
    }

    if (allTemplates.length > 0) {
      let templatesContentMap = {};
      try {
        const dbRes = await fetch(
          `/api/knowledge-content?username=${encodeURIComponent(REPORT_TEMPLATE_CONTENT_USER)}&includeContent=1`,
        );
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          for (const row of dbData.data || []) {
            templatesContentMap[`${row.subject}::${row.filename}`] =
              row.content_text;
          }
        }
      } catch (e) { }

      await Promise.all(
        allTemplates.map(async (f) => {
          const isPdf = /\.pdf$/i.test(f.name);
          const isText =
            /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
              f.name,
            );
          const dbKey = `${f.subject}::${f.name}`;

          if (templatesContentMap[dbKey]) {
            templatesTextList.push({
              name: f.name,
              content: templatesContentMap[dbKey],
              subject: f.subject,
            });
          } else if (f.url && isPdf) {
            try {
              const pdfRes = await fetch(f.url);
              if (pdfRes.ok) {
                const arrayBuf = await pdfRes.arrayBuffer();
                const pdfBlob = new Blob([arrayBuf], {
                  type: "application/pdf",
                });
                const pdfFile = new File([pdfBlob], f.name, {
                  type: "application/pdf",
                });
                const result = await parsePdfText(pdfFile);
                if (result.text) {
                  templatesTextList.push({
                    name: f.name,
                    content: result.text,
                    subject: f.subject,
                  });
                  fetch("/api/knowledge-content", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: REPORT_TEMPLATE_CONTENT_USER,
                      subject: f.subject,
                      filename: f.name,
                      content_text: result.text,
                      page_count: result.pageCount,
                      file_url: f.url,
                    }),
                  }).catch(() => { });
                }
              }
            } catch (e) {
              templatesTextList.push({
                name: f.name,
                url: f.url,
                subject: f.subject,
              });
            }
          } else if (f.url && isText) {
            try {
              const res = await fetch(f.url);
              if (res.ok) {
                const content = await res.text();
                if (content) {
                  templatesTextList.push({
                    name: f.name,
                    content,
                    subject: f.subject,
                  });
                }
              }
            } catch (e) { }
          } else if (f.url) {
            templatesTextList.push({
              name: f.name,
              url: f.url,
              subject: f.subject,
            });
          }
        }),
      );
    }

    if (shouldUseReportMode) {
      // Outlines: take all content fully as requested by user (do phải tuân thủ nghiêm ngặt)
      const fullOutlines = [];
      for (const item of outlinesTextList) {
        const content = normalizeKnowledgeText(item.content);
        if (!content) continue;
        fullOutlines.push({
          ...item,
          content: content,
        });
      }
      outlinesTextList.splice(0, outlinesTextList.length, ...fullOutlines);

      // Templates: select only relevant chunks (RAG)
      templatesTextList.splice(
        0,
        templatesTextList.length,
        ...selectRelevantSampleChunks(templatesTextList, userPrompt),
      );
    }

    const currentYear = new Date().getFullYear();
    const completedYear = currentYear - 1;
    const currentDateStr = new Date().toLocaleDateString("vi-VN");

    let effectivePrompt;
    if (!shouldUseReportMode) {
      // Chat mode: light-weight chat behavior
      effectivePrompt = getAssistantOnlyFallbackPrompt(username);
    } else {
      // Report mode: full report assistant behavior
      effectivePrompt = systemPrompt.trim() || defaultSystemPrompt;

      const targetCompany = extractTargetCompany(userPrompt);
      effectivePrompt += `\n\nQUY TẮC SỬ DỤNG KHO TRI THỨC BÁO CÁO:\n- Đề cương là kiến thức chung bắt buộc để giữ cấu trúc, thứ tự mục và quy chuẩn trình bày.\n- Báo cáo mẫu là nguồn tri thức chi tiết để tham khảo cách viết, cách phân tích và ví dụ tương tự; không sao chép nguyên văn.\n- Dữ liệu người dùng cung cấp trong yêu cầu hiện tại là nguồn sự thật ưu tiên cao nhất.`;

      if (targetCompany) {
        effectivePrompt += `\n- ĐẶC BIỆT LƯU Ý BẮT BUỘC: Đối tượng doanh nghiệp đích cần làm báo cáo thực tế được người dùng yêu cầu là: "${targetCompany}". Toàn bộ nội dung báo cáo đầu ra, trang bìa, lời mở đầu, các chương, bảng số liệu, kết luận BẮT BUỘC PHẢI viết về "${targetCompany}". Tuyệt đối KHÔNG ĐƯỢC nhầm lẫn hoặc sử dụng tên doanh nghiệp trong các tài liệu mẫu (như VPBank, VietinBank...) làm đối tượng cho báo cáo này.`;
      } else {
        effectivePrompt += `\n- ĐẶC BIỆT LƯU Ý BẮT BUỘC: Bạn phải phân tích kỹ yêu cầu của người dùng để xác định đúng tên đơn vị/doanh nghiệp đích cần làm báo cáo thực tế. Toàn bộ nội dung báo cáo đầu ra, trang bìa, lời mở đầu, các chương, bảng số liệu, kết luận BẮT BUỘC PHẢI viết về doanh nghiệp đích được người dùng yêu cầu đó. Tuyệt đối KHÔNG ĐƯỢC nhầm lẫn hoặc sử dụng tên doanh nghiệp trong các tài liệu mẫu (như VPBank, VietinBank...) làm đối tượng cho báo cáo này.`;
      }

      if (outlinesTextList.length > 0 || templatesTextList.length > 0) {
        effectivePrompt += `\n\n============================================`;
        effectivePrompt += `\nTÀI LIỆU HƯỚNG DẪN ĐÍNH KÈM (ĐỀ CƯƠNG & BÁO CÁO MẪU):`;

        if (outlinesTextList.length > 0) {
          effectivePrompt += `\n\n--- ĐỀ CƯƠNG CẤU TRÚC BÁO CÁO BẮT BUỘC TUÂN THỦ (OUTLINES) ---`;
          for (const k of outlinesTextList) {
            if (k.content) {
              effectivePrompt += `\n\n[Chủ đề: ${k.subject} | Tên đề cương: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
            } else if (k.url) {
              effectivePrompt += `\n- [Chủ đề: ${k.subject} | Đề cương: ${k.name}](${k.url})`;
            }
          }
        }

        if (templatesTextList.length > 0) {
          effectivePrompt += `\n\n--- BÁO CÁO MẪU THAM KHẢO TRÌNH BÀY & HÀNH VĂN (TEMPLATES) ---`;
          for (const k of templatesTextList) {
            if (k.content) {
              effectivePrompt += `\n\n[Chủ đề: ${k.subject} | Tên báo cáo mẫu: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
            } else if (k.url) {
              effectivePrompt += `\n- [Chủ đề: ${k.subject} | Báo cáo mẫu: ${k.name}](${k.url})`;
            }
          }
        }
        effectivePrompt += `\n============================================`;
      }
    }

    reqMsgs.push({ role: "system", content: effectivePrompt });

    // 1. Format previous messages for request
    for (const m of prevMsgs) {
      if (m.role === "user" || (m.role === "assistant" && m.content)) {
        if (m.role === "user" && m.files && m.files.length > 0) {
          const finalContent = await buildContentWithAttachments(
            m.content || "",
            m.files,
          );
          reqMsgs.push({ role: m.role, content: finalContent });
        } else {
          reqMsgs.push({ role: m.role, content: m.content });
        }
      }
    }

    // 2. Format current message with vision payload or inline text files
    const imageFiles = activeAttached.filter((f) =>
      f.type?.startsWith("image/"),
    );
    const textFiles = [];
    const docFiles = [];

    for (const f of activeAttached) {
      if (f.type?.startsWith("image/")) continue;
      const isText =
        f.type?.startsWith("text/") ||
        /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(f.name);
      if (f.file && isText && f.size < 150 * 1024) {
        try {
          const content = await readTextFile(f.file);
          if (content) {
            textFiles.push({ name: f.name, content });
            continue;
          }
        } catch (e) {
          console.error("Error reading text file", e);
        }
      }
      docFiles.push(f);
    }

    let webSearchContext = "";

    // 1. Jina Reader: Detect and extract content from URLs in the user prompt
    const urls = userPrompt.match(/(https?:\/\/[^\s]+)/g);
    if (webSearchEnabled && urls && urls.length > 0) {
      setSearchStatus("Đang đọc nội dung liên kết qua Jina Reader...");
      showToast("Jina Reader đang đọc nội dung liên kết...", "info");
      for (const u of urls) {
        try {
          const res = await fetch("/api/report-assistant/web-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: u }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.content) {
              webSearchContext += `\n\n--- NỘI DUNG TÀI LIỆU CHI TIẾT TỪ LIÊN KẾT [${u}] ---\n${data.content.slice(0, 15000)}\n------------------------------------------------`;
            }
          }
        } catch (e) {
          console.error("Error fetching Jina Reader content", e);
        }
      }
    }

    // 2. Tavily AI: always search the web when generating a report or when web search is enabled for prompts.
    if (
      webSearchEnabled &&
      (shouldUseReportMode ||
        isReportIntent(userPrompt) ||
        userPrompt.trim().length > 10)
    ) {
      const searchQuery = cleanWebSearchQuery(userPrompt);
      setSearchStatus(
        `Đang tìm kiếm thông tin mới nhất trên Google qua Tavily AI cho từ khoá "${searchQuery}"...`,
      );
      showToast("Tavily AI đang tìm kiếm thông tin mới nhất...", "info");
      try {
        const res = await fetch("/api/report-assistant/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.results) {
            showToast("Tavily AI đã tìm kiếm thông tin thành công!", "success");
            let searchContent = `\n\n--- DỮ LIỆU TÌM KIẾM MỚI NHẤT TỪ TAVILY AI ---`;
            if (data.results.answer) {
              searchContent += `\n**Tóm tắt câu trả lời:** ${data.results.answer}`;
            }
            searchContent += `\n\n**Các nguồn tin cậy tìm thấy:**`;
            for (const r of data.results.results || []) {
              searchContent += `\n\n- **[${r.title}](${r.url})**\n  *Nội dung trích dẫn:* ${r.content}`;
            }
            searchContent += `\n--------------------------------------------`;
            webSearchContext += searchContent;
          }
        }
      } catch (e) {
        console.error("Error fetching Tavily Search content", e);
      }
    }

    setSearchStatus("");

    let currentMsgText = userPrompt;
    if (webSearchContext) {
      currentMsgText += webSearchContext;
    }
    if (textFiles.length > 0) {
      currentMsgText += "\n\n--- HỘP THÔNG TIN FILE ĐÍNH KÈM ---";
      for (const tf of textFiles) {
        currentMsgText += `\n\n[File: ${tf.name}]\n\`\`\`\n${tf.content}\n\`\`\``;
      }
      currentMsgText += "\n-----------------------------------";
    }

    let currentMsgContent;
    if (imageFiles.length > 0) {
      let msgText = currentMsgText;
      if (imageFiles.length > 1) {
        const multiImageInstruction = `[HƯớNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghep lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
        msgText = multiImageInstruction + msgText;
      }
      currentMsgContent = [{ type: "text", text: msgText }];
      for (const img of imageFiles) {
        currentMsgContent.push({
          type: "image_url",
          image_url: { url: img.url },
        });
      }
    } else {
      currentMsgContent = currentMsgText;
    }

    currentMsgText = userPrompt;
    if (webSearchContext) {
      currentMsgText += webSearchContext;
    }
    currentMsgContent = await buildContentWithAttachments(
      currentMsgText,
      activeAttached,
    );

    if (
      shouldUseReportMode &&
      (outlinesTextList.length > 0 || templatesTextList.length > 0)
    ) {
      const citationReminder = `\n\n[LƯU Ý QUAN TRỌNG VỀ TRÍCH NGUỒN: Tuyệt đối KHÔNG viết cụm "Tham khảo: nội dung kiến thức..." ở ngoài hay ở đáy các câu trả lời chat thông thường. Thay vào đó, bạn BẮT BUỘC phải gán danh sách nguồn tham khảo tại phần cuối cùng bên trong cặp thẻ [START_REPORT]...[END_REPORT] ở đáy của toàn bộ báo cáo chi tiết, trình bày thành một mục "## DANH MỤC TÀI LIỆU THAM KHẢO" chuyên biệt. Danh mục này CHỈ LIỆT KÊ các liên kết web thực tế thu thập từ Tavily Search/Jina Reader hoặc các URL do người dùng cung cấp trong prompt. TUYỆT ĐỐI không liệt kê link Supabase (đề cương/báo cáo mẫu/knowledge).]`;
      if (typeof currentMsgContent === "string") {
        currentMsgContent += citationReminder;
      } else if (Array.isArray(currentMsgContent)) {
        const textPart = currentMsgContent.find((p) => p.type === "text");
        if (textPart) {
          textPart.text += citationReminder;
        }
      }
    }

    const t0 = Date.now();
    try {
      const streamCompletion = async (
        messages,
        onDelta,
        maxTokens = REPORT_MAX_TOKENS,
      ) => {
        const useStreaming = !isReportAssistantLunaModel(model.id);
        const headers = {
          "Content-Type": "application/json",
          Accept: useStreaming ? "text/event-stream" : "application/json",
        };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        let attempts = 0;
        const maxAttempts = 6;
        let delay = 3000; // Start with a 3s delay
        const maxDelayMs = 60000;
        let hasReceivedContent = false;

        while (attempts < maxAttempts) {
          try {
            const res = await fetch("/api/v1/chat/completions", {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: model.id,
                messages,
                stream: useStreaming,
                temperature,
                max_tokens: maxTokens,
              }),
              signal: abortRef.current?.signal,
            });

            if (res.status === 429) {
              attempts += 1;
              const retryAfterHeader = res.headers.get("Retry-After");
              const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
              const retryAfterMs = Number.isFinite(retryAfterSeconds)
                ? retryAfterSeconds * 1000
                : 0;
              const jitterMs = Math.floor(Math.random() * 500);
              const nextDelay = Math.min(
                Math.max(delay, retryAfterMs) + jitterMs,
                maxDelayMs,
              );
              if (attempts >= maxAttempts) {
                throw new Error(
                  "Gặp lỗi giới hạn tần suất (Rate Limit 429) từ API model. Vui lòng thử lại sau ít phút hoặc sử dụng API key khác.",
                );
              }
              setSearchStatus(
                `Gặp lỗi 429 (Rate Limit). Đang tự động thử lại sau ${Math.ceil(nextDelay / 1000)}s... (Lần ${attempts}/${maxAttempts})`,
              );
              await new Promise((resolve) => setTimeout(resolve, nextDelay));
              delay = Math.min(delay * 2, maxDelayMs);
              continue;
            }

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              const message = textValue(
                errData?.error?.message ||
                errData?.error ||
                errData?.message ||
                `HTTP ${res.status}`,
              );
              const error = new Error(message);
              error.status = res.status;
              throw error;
            }

            setSearchStatus(""); // Reset status

            if (!useStreaming) {
              const data = await res.json().catch(() => null);
              const fullPart =
                data?.choices?.[0]?.message?.content ||
                data?.choices?.[0]?.delta?.content ||
                data?.output_text ||
                data?.text ||
                "";
              if (fullPart) {
                hasReceivedContent = true;
                onDelta(fullPart, fullPart);
              }
              return fullPart;
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No streaming body");

            const dec = new TextDecoder();
            let buf = "",
              fullPart = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split(/\r?\n/);
              buf = lines.pop() || "";
              for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const payload = t.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const chunk = JSON.parse(payload);
                  const delta =
                    chunk.choices?.[0]?.delta?.content ||
                    chunk.choices?.[0]?.message?.content ||
                    "";
                  if (delta) {
                    hasReceivedContent = true;
                    fullPart += delta;
                    onDelta(delta, fullPart);
                  }
                } catch { }
              }
            }
            return fullPart;
          } catch (err) {
            if (err.name === "AbortError" || hasReceivedContent) throw err;
            const status = err?.status;
            if (status && !isRetriableStatus(status)) throw err;
            if (attempts >= maxAttempts - 1) throw err;
            attempts += 1;
            const jitterMs = Math.floor(Math.random() * 500);
            const nextDelay = Math.min(delay + jitterMs, maxDelayMs);
            setSearchStatus(
              `Lỗi kết nối hoặc Rate Limit. Đang thử lại sau ${Math.ceil(nextDelay / 1000)}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, nextDelay));
            delay = Math.min(delay * 2, maxDelayMs);
          }
        }
      };

      const updateAssistantMsg = (
        content,
        status = "streaming",
        latencyMs = null,
      ) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === asstId
                    ? {
                      ...m,
                      content,
                      status,
                      ...(latencyMs !== null ? { latencyMs } : {}),
                    }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
      };

      if (!shouldUseReportMode) {
        const simpleMsgs = [
          ...reqMsgs,
          { role: "user", content: currentMsgContent },
        ];
        try {
          let fullResp = "";
          await streamCompletion(
            simpleMsgs,
            (delta, full) => {
              fullResp = full;
              updateAssistantMsg(fullResp, "streaming");
            },
            CHAT_MAX_TOKENS,
          );
          updateAssistantMsg(fullResp, "done");
        } catch (e) {
          updateAssistantMsg(`Error: ${textValue(e)}`, "error");
        } finally {
          setIsSending(false);
          setStreamingId("");
          abortRef.current = null;
        }
        return;
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        updateAssistantMsg(`Error: ${textValue(err)}`, "error");
      }
    } finally {
      setIsSending(false);
      setStreamingId("");
      abortRef.current = null;
    }
  }, [
    activeModel,
    draft,
    activeSessionId,
    sessions,
    createSession,
    systemPrompt,
    defaultSystemPrompt,
    temperature,
    apiKey,
    attachedFiles,
    isSupabaseConfigured,
    filesOutlines,
    filesTemplates,
    username,
    assistantOnlyMode,
  ]);

  const resendMessage = useCallback(
    async (userMsgId, editedContent) => {
      const model = activeModel;
      if (!model) return;

      let sessionId = activeSessionId;
      let session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const prevMsgs = session.messages || [];
      const targetIdx = prevMsgs.findIndex((m) => m.id === userMsgId);
      if (targetIdx === -1) return;

      const targetUserMsg = prevMsgs[targetIdx];

      // Update content if edited, else keep original for regeneration
      const updatedUserMsg = {
        ...targetUserMsg,
        content:
          editedContent !== undefined
            ? editedContent.trim()
            : targetUserMsg.content,
        createdAt: new Date().toISOString(),
      };

      if (isReportIntent(updatedUserMsg.content || "")) {
        if (!selectedKnowledgeSubject || selectedKnowledgeSubject === "none") {
          showToast(
            "Vui lòng lựa chọn một chủ đề/loại báo cáo trước khi tạo báo cáo.",
            "error",
          );
          return;
        }

        openReportWorkflowConfirm({
          content: updatedUserMsg.content || "Tạo báo cáo",
          subject: selectedKnowledgeSubject,
          files: updatedUserMsg.files || [],
          sessionId,
          modelId: model.id,
        });
        showToast(
          "Đã phát hiện yêu cầu tạo báo cáo. Hãy xác nhận để chạy quy trình Agent.",
          "info",
        );
        return;
      }

      // Keep all messages up to the user message
      const keptMsgs = prevMsgs.slice(0, targetIdx);

      const asstId = createId();
      const asstMsg = {
        id: asstId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
      };

      const nextMsgs = [...keptMsgs, updatedUserMsg, asstMsg];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
              ...s,
              messages: nextMsgs,
              title:
                s.title === "New Chat"
                  ? makeTitle(updatedUserMsg.content || "Attached File")
                  : s.title,
              modelId: model.id,
              updatedAt: new Date().toISOString(),
            }
            : s,
        ),
      );

      setIsSending(true);
      setStreamingId(asstId);
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const updateAssistantMsg = (
        content,
        status = "streaming",
        latencyMs = null,
      ) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === asstId
                    ? {
                      ...m,
                      content,
                      status,
                      ...(latencyMs !== null ? { latencyMs } : {}),
                    }
                    : m,
                ),
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
      };

      // ── Knowledge Base Preparation (Outlines & Templates) ──
      const outlinesTextList = [];
      const templatesTextList = [];

      const allOutlines = [];
      for (const [subj, files] of Object.entries(filesOutlines || {})) {
        if (Array.isArray(files)) {
          for (const f of files) {
            allOutlines.push({ ...f, subject: subj });
          }
        }
      }

      const allTemplates = [];
      for (const [subj, files] of Object.entries(filesTemplates || {})) {
        if (Array.isArray(files)) {
          for (const f of files) {
            allTemplates.push({ ...f, subject: subj });
          }
        }
      }

      // Detect requested page count in user prompt to dynamically scale report capacity
      const pageMatch = (updatedUserMsg.content || "").match(/(\d+)\s*(trang|pages?)/i);
      let customWordScale = null;
      if (pageMatch) {
        const requestedPages = parseInt(pageMatch[1], 10);
        if (requestedPages > 7) {
          const normalizedContent = (updatedUserMsg.content || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
          const isB49 = /\b(?:ba49|b49|kien tap)\b/i.test(normalizedContent);
          const isCareer = /\b(?:thuc tap dinh huong nghe nghiep|dinh huong nghe nghiep)\b/i.test(normalizedContent);
          const excludedPages = (isB49 || isCareer) ? 4 : 3;
          const totalWords = Math.max(1, requestedPages - excludedPages) * 350; // average 350 words per page in Times New Roman 13pt 1.5 line spacing
          customWordScale = {
            total: totalWords,
            intro: Math.round(totalWords * 0.08),
            ch1: Math.round(totalWords * 0.24),
            ch2: Math.round(totalWords * 0.40),
            ch3: Math.round(totalWords * 0.23),
            conclusion: Math.round(totalWords * 0.05),
          };
        }
      }

      // Report requests are routed above through /api/report-assistant/agent.
      // Resend/edit below is normal chat and must use the completions endpoint only.
      const shouldUseReportMode = false;

      let finalUserContent;
      if (updatedUserMsg.files && updatedUserMsg.files.length > 0) {
        const imageFiles = updatedUserMsg.files.filter((f) =>
          f.type?.startsWith("image/"),
        );
        const nonImageFiles = updatedUserMsg.files.filter(
          (f) => !f.type?.startsWith("image/"),
        );

        let finalContent = updatedUserMsg.content || "";
        if (nonImageFiles.length > 0) {
          finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
          for (const df of nonImageFiles) {
            finalContent += `\n- [${df.name}](${df.url})`;
          }
          finalContent += "\n------------------------";
        }

        if (imageFiles.length > 0) {
          let msgText = finalContent;
          if (imageFiles.length > 1) {
            const multiImageInstruction = `[HƯỚNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghep lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
            msgText = multiImageInstruction + msgText;
          }
          finalUserContent = [{ type: "text", text: msgText }];
          for (const img of imageFiles) {
            finalUserContent.push({
              type: "image_url",
              image_url: { url: img.url },
            });
          }
        } else {
          finalUserContent = finalContent;
        }
      } else {
        finalUserContent = updatedUserMsg.content;
      }

      finalUserContent = await buildContentWithAttachments(
        updatedUserMsg.content || "",
        updatedUserMsg.files || [],
      );

      if (shouldUseReportMode && allOutlines.length > 0) {
        let outlinesContentMap = {};
        try {
          const dbRes = await fetch(
            `/api/knowledge-content?username=${encodeURIComponent(REPORT_OUTLINE_CONTENT_USER)}&includeContent=1`,
          );
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            for (const row of dbData.data || []) {
              outlinesContentMap[`${row.subject}::${row.filename}`] =
                row.content_text;
            }
          }
        } catch (e) { }

        await Promise.all(
          allOutlines.map(async (f) => {
            const isPdf = /\.pdf$/i.test(f.name);
            const isText =
              /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
                f.name,
              );
            const dbKey = `${f.subject}::${f.name}`;

            if (outlinesContentMap[dbKey]) {
              outlinesTextList.push({
                name: f.name,
                content: outlinesContentMap[dbKey],
                subject: f.subject,
              });
            } else if (f.url && isPdf) {
              try {
                const pdfRes = await fetch(f.url);
                if (pdfRes.ok) {
                  const arrayBuf = await pdfRes.arrayBuffer();
                  const pdfBlob = new Blob([arrayBuf], {
                    type: "application/pdf",
                  });
                  const pdfFile = new File([pdfBlob], f.name, {
                    type: "application/pdf",
                  });
                  const result = await parsePdfText(pdfFile);
                  if (result.text) {
                    outlinesTextList.push({
                      name: f.name,
                      content: result.text,
                      subject: f.subject,
                    });
                    fetch("/api/knowledge-content", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        username: REPORT_OUTLINE_CONTENT_USER,
                        subject: f.subject,
                        filename: f.name,
                        content_text: result.text,
                        page_count: result.pageCount,
                        file_url: f.url,
                      }),
                    }).catch(() => { });
                  }
                }
              } catch (e) {
                outlinesTextList.push({
                  name: f.name,
                  url: f.url,
                  subject: f.subject,
                });
              }
            } else if (f.url && isText) {
              try {
                const res = await fetch(f.url);
                if (res.ok) {
                  const content = await res.text();
                  if (content) {
                    outlinesTextList.push({
                      name: f.name,
                      content,
                      subject: f.subject,
                    });
                  }
                }
              } catch (e) { }
            } else if (f.url) {
              outlinesTextList.push({
                name: f.name,
                url: f.url,
                subject: f.subject,
              });
            }
          }),
        );
      }

      if (allTemplates.length > 0) {
        let templatesContentMap = {};
        try {
          const dbRes = await fetch(
            `/api/knowledge-content?username=${encodeURIComponent(REPORT_TEMPLATE_CONTENT_USER)}&includeContent=1`,
          );
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            for (const row of dbData.data || []) {
              templatesContentMap[`${row.subject}::${row.filename}`] =
                row.content_text;
            }
          }
        } catch (e) { }

        await Promise.all(
          allTemplates.map(async (f) => {
            const isPdf = /\.pdf$/i.test(f.name);
            const isText =
              /\.(txt|json|csv|md|js|ts|py|html|css|yaml|yml|xml|sh)$/i.test(
                f.name,
              );
            const dbKey = `${f.subject}::${f.name}`;

            if (templatesContentMap[dbKey]) {
              templatesTextList.push({
                name: f.name,
                content: templatesContentMap[dbKey],
                subject: f.subject,
              });
            } else if (f.url && isPdf) {
              try {
                const pdfRes = await fetch(f.url);
                if (pdfRes.ok) {
                  const arrayBuf = await pdfRes.arrayBuffer();
                  const pdfBlob = new Blob([arrayBuf], {
                    type: "application/pdf",
                  });
                  const pdfFile = new File([pdfBlob], f.name, {
                    type: "application/pdf",
                  });
                  const result = await parsePdfText(pdfFile);
                  if (result.text) {
                    templatesTextList.push({
                      name: f.name,
                      content: result.text,
                      subject: f.subject,
                    });
                    fetch("/api/knowledge-content", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        username: REPORT_TEMPLATE_CONTENT_USER,
                        subject: f.subject,
                        filename: f.name,
                        content_text: result.text,
                        page_count: result.pageCount,
                        file_url: f.url,
                      }),
                    }).catch(() => { });
                  }
                }
              } catch (e) {
                templatesTextList.push({
                  name: f.name,
                  url: f.url,
                  subject: f.subject,
                });
              }
            } else if (f.url && isText) {
              try {
                const res = await fetch(f.url);
                if (res.ok) {
                  const content = await res.text();
                  if (content) {
                    templatesTextList.push({
                      name: f.name,
                      content,
                      subject: f.subject,
                    });
                  }
                }
              } catch (e) { }
            } else if (f.url) {
              templatesTextList.push({
                name: f.name,
                url: f.url,
                subject: f.subject,
              });
            }
          }),
        );
      }

      if (shouldUseReportMode) {
        let outlineTotal = 0;
        const cappedOutlines = [];
        for (const item of outlinesTextList) {
          const content = normalizeKnowledgeText(item.content);
          if (!content) continue;
          if (outlineTotal >= MAX_GLOBAL_OUTLINE_KNOWLEDGE_CHARS) break;
          const next = {
            ...item,
            content: content.slice(
              0,
              Math.max(0, MAX_GLOBAL_OUTLINE_KNOWLEDGE_CHARS - outlineTotal),
            ),
          };
          cappedOutlines.push(next);
          outlineTotal += next.content.length;
        }
        outlinesTextList.splice(0, outlinesTextList.length, ...cappedOutlines);
        templatesTextList.splice(
          0,
          templatesTextList.length,
          ...selectRelevantSampleChunks(
            templatesTextList,
            updatedUserMsg.content || "",
          ),
        );
      }

      let effectivePrompt = getAssistantOnlyFallbackPrompt(username);

      const targetCompany = extractTargetCompany(updatedUserMsg.content || "");
      effectivePrompt += `\n\nQUY TẮC SỬ DỤNG KHO TRI THỨC BÁO CÁO:\n- Đề cương là kiến thức chung bắt buộc để giữ cấu trúc, thứ tự mục và quy chuẩn trình bày.\n- Báo cáo mẫu là nguồn tri thức chi tiết để tham khảo cách viết, cách phân tích và ví dụ tương tự; không sao chép nguyên văn.\n- Dữ liệu người dùng cung cấp trong yêu cầu hiện tại là nguồn sự thật ưu tiên cao nhất.`;

      if (targetCompany) {
        effectivePrompt += `\n- ĐẶC BIỆT LƯU Ý BẮT BUỘC: Đối tượng doanh nghiệp đích cần làm báo cáo thực tế được người dùng yêu cầu là: "${targetCompany}". Toàn bộ nội dung báo cáo đầu ra, trang bìa, lời mở đầu, các chương, bảng số liệu, kết luận BẮT BUỘC PHẢI viết về "${targetCompany}". Tuyệt đối KHÔNG ĐƯỢC nhầm lẫn hoặc sử dụng tên doanh nghiệp trong các tài liệu mẫu (như VPBank, VietinBank...) làm đối tượng cho báo cáo này.`;
      } else {
        effectivePrompt += `\n- ĐẶC BIỆT LƯU Ý BẮT BUỘC: Bạn phải phân tích kỹ yêu cầu của người dùng để xác định đúng tên đơn vị/doanh nghiệp đích cần làm báo cáo thực tế. Toàn bộ nội dung báo cáo đầu ra, trang bìa, lời mở đầu, các chương, bảng số liệu, kết luận BẮT BUỘC PHẢI viết về doanh nghiệp đích được người dùng yêu cầu đó. Tuyệt đối KHÔNG ĐƯỢC nhầm lẫn hoặc sử dụng tên doanh nghiệp trong các tài liệu mẫu (như VPBank, VietinBank...) làm đối tượng cho báo cáo này.`;
      }

      if (outlinesTextList.length > 0 || templatesTextList.length > 0) {
        effectivePrompt += `\n\n============================================`;
        effectivePrompt += `\nTÀI LIỆU HƯỚNG DẪN ĐÍNH KÈM (ĐỀ CƯƠNG & BÁO CÁO MẪU):`;

        if (outlinesTextList.length > 0) {
          effectivePrompt += `\n\n--- ĐỀ CƯƠNG CẤU TRÚC BÁO CÁO BẮT BUỘC TUÂN THỦ (OUTLINES) ---`;
          for (const k of outlinesTextList) {
            if (k.content) {
              effectivePrompt += `\n\n[Chủ đề: ${k.subject} | Tên đề cương: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
            } else if (k.url) {
              effectivePrompt += `\n- [Chủ đề: ${k.subject} | Đề cương: ${k.name}](${k.url})`;
            }
          }
        }

        if (templatesTextList.length > 0) {
          effectivePrompt += `\n\n--- BÁO CÁO MẪU THAM KHẢO TRÌNH BÀY & HÀNH VĂN (TEMPLATES) ---`;
          for (const k of templatesTextList) {
            if (k.content) {
              effectivePrompt += `\n\n[Chủ đề: ${k.subject} | Tên báo cáo mẫu: ${k.name}]\n\`\`\`\n${k.content}\n\`\`\``;
            } else if (k.url) {
              effectivePrompt += `\n- [Chủ đề: ${k.subject} | Báo cáo mẫu: ${k.name}](${k.url})`;
            }
          }
        }
        effectivePrompt += `\n============================================`;
      }

      const reqMsgs = [{ role: "system", content: effectivePrompt }];

      // If chat mode, run simple chat flow
      if (!shouldUseReportMode) {
        const simpleMsgs = [
          ...reqMsgs,
          { role: "user", content: finalUserContent },
        ];
        try {
          let fullResp = "";
          await streamCompletion(
            simpleMsgs,
            (delta, full) => {
              fullResp = full;
              updateAssistantMsg(fullResp, "streaming");
            },
            CHAT_MAX_TOKENS,
          );
          updateAssistantMsg(fullResp, "done");
        } catch (e) {
          updateAssistantMsg(`Error: ${textValue(e)}`, "error");
        } finally {
          setIsSending(false);
          setStreamingId("");
          abortRef.current = null;
        }
        return;
      }
    },
    [
      activeModel,
      activeSessionId,
      sessions,
      systemPrompt,
      defaultSystemPrompt,
      temperature,
      apiKey,
      filesOutlines,
      filesTemplates,
      openReportWorkflowConfirm,
      selectedKnowledgeSubject,
      username,
    ],
  );

  const handleEditSubmit = useCallback(
    (userMsgId, newContent) => {
      resendMessage(userMsgId, newContent);
    },
    [resendMessage],
  );

  const handleRegenerate = useCallback(
    (asstMsgId) => {
      const sessionId = activeSessionId;
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const prevMsgs = session.messages || [];
      const asstIdx = prevMsgs.findIndex((m) => m.id === asstMsgId);
      if (asstIdx === -1) return;
      // Find the nearest preceding user message by scanning backwards
      let userMsg = null;
      for (let i = asstIdx - 1; i >= 0; i--) {
        const m = prevMsgs[i];
        if (!m) continue;
        if (m.role === "user") {
          userMsg = m;
          break;
        }
        // If we hit another assistant message and no user yet, keep scanning
      }
      if (userMsg && userMsg.id) {
        if (isReportIntent(userMsg.content || "")) {
          openReportWorkflowConfirm({
            content: userMsg.content || "Tạo báo cáo",
            subject: session.subject || selectedKnowledgeSubject,
            files: userMsg.files || [],
            sessionId,
            modelId: session.modelId || activeModelId || activeModel?.id,
            replaceUserMsgId: userMsg.id,
          });
          showToast(
            "Đã phát hiện yêu cầu tạo báo cáo. Hãy xác nhận để chạy lại quy trình Agent.",
            "info",
          );
          return;
        }
        resendMessage(userMsg.id);
      } else {
        showToast("Không tìm thấy lời hỏi trước đó để trả lời lại.", "error");
      }
    },
    [
      activeSessionId,
      sessions,
      resendMessage,
      openReportWorkflowConfirm,
      activeModelId,
      activeModel,
    ],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) sendMessage();
      }
    },
    [canSend, sendMessage],
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [draft]);

  useGSAP(() => {
    if (activeDoc && previewPanelRef.current) {
      gsap.fromTo(
        previewPanelRef.current,
        { x: 30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" }
      );
    }
  }, [!!activeDoc]);

  useGSAP(() => {
    if (agentActive && agentPanelRef.current) {
      gsap.fromTo(
        agentPanelRef.current,
        { x: 30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" }
      );
    }
  }, [agentActive]);

  // ── Render ──
  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">

      <div className="flex h-full min-h-0 w-full overflow-hidden">
        {/* Settings Modal */}
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          allModels={allModels}
          enabledModelIds={enabledModelIds}
          onToggleModel={handleToggleModel}
          systemPrompt={systemPrompt}
          onSystemPrompt={setSystemPrompt}
          defaultSystemPrompt={defaultSystemPrompt}
          temperature={temperature}
          onTemperature={setTemperature}
          assistantOnlyMode={assistantOnlyMode}
          onAssistantOnlyModeChange={setAssistantOnlyMode}
          subjectsOutlines={subjectsOutlines}
          filesOutlines={filesOutlines}
          loadingOutlines={loadingOutlines}
          loadOutlines={loadOutlines}
          subjectsTemplates={subjectsTemplates}
          filesTemplates={filesTemplates}
          loadingTemplates={loadingTemplates}
          loadTemplates={loadTemplates}
          isSupabaseConfigured={isSupabaseConfigured}
          username={username}
        />

        {pendingReportRequest && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
            <div className="w-full max-w-xl rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.25)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle bg-gradient-to-r from-brand-500/10 to-indigo-500/10">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
                  Xác nhận quy trình Agent
                </p>
                <h3 className="mt-1 text-lg font-semibold text-text-main">
                  Khởi chạy quy trình tạo báo cáo?
                </h3>
                <p className="mt-1 text-sm text-text-muted leading-relaxed">
                  Yêu cầu này sẽ đi qua API Agent để lập đề cương, nạp kiến thức,
                  rồi mới soạn thảo báo cáo. Chat thường vẫn dùng luồng
                  completions.
                </p>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex items-start gap-2.5 p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">warning</span>
                  <div>
                    <p className="font-bold">Lưu ý về thời gian tạo báo cáo:</p>
                    <p className="mt-0.5 leading-relaxed font-medium">
                      Quy trình tạo báo cáo toàn diện (lập dàn ý, nạp tri thức và soạn thảo chi tiết từng chương) có thể kéo dài **khoảng 5 - 10 phút**. Vui lòng giữ cửa sổ hoạt động hoặc chờ trong giây lát.
                    </p>
                  </div>
                </div>

                <div className="rounded-[14px] border border-border-subtle bg-bg/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle mb-2">
                    Nội dung yêu cầu
                  </p>
                  <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto custom-scrollbar">
                    {pendingReportRequest.content || "Tạo báo cáo"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/20 bg-brand-500/8 px-3 py-1 font-medium text-brand-600 dark:text-brand-400">
                    <span className="material-symbols-outlined text-[15px]">
                      support_agent
                    </span>
                    Dùng api/agent/*
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-3 py-1 font-medium">
                    <span className="material-symbols-outlined text-[15px]">
                      public
                    </span>
                    Chat thường vẫn dùng completions
                  </span>
                </div>

                <div className="rounded-[14px] border border-border-subtle bg-surface-2 p-4">
                  {reportModelsLoading ? (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
                          Model Luna cho Agent
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-[12px] border border-border-subtle bg-bg px-3 py-2 text-xs text-text-muted">
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Đang tải danh sách model báo cáo...
                      </div>
                    </>
                  ) : reportModels.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
                          Model Luna cho Agent
                        </p>
                        <span className="text-[11px] text-text-subtle">
                          Chỉ áp dụng cho quy trình báo cáo
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {reportModels.map((model) => {
                          const active = model.id === (selectedReportModelId || reportModels[0]?.id);
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                setSelectedReportModelId(model.id);
                                setReportWorkflowModelId(model.id);
                              }}
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left transition-all",
                                active
                                  ? "border-brand-500/40 bg-brand-500/10 text-text-main"
                                  : "border-border-subtle bg-bg text-text-muted hover:bg-surface hover:text-text-main",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {model.id.split("/").pop()}
                                </p>
                                <p className="text-[11px] text-text-subtle truncate">
                                  {model.owned_by || model.id}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "material-symbols-outlined text-[18px] flex-shrink-0",
                                  active ? "text-brand-500" : "text-text-subtle",
                                )}
                              >
                                {active ? "radio_button_checked" : "radio_button_unchecked"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
                          Model Agent báo cáo
                        </p>
                        <span className="text-[11px] text-text-subtle">
                          Mặc định sử dụng model chat hiện tại
                        </span>
                      </div>
                      <div className="rounded-[12px] border border-brand-500/20 bg-brand-500/5 px-3.5 py-2.5 text-xs text-brand-600 dark:text-brand-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-brand-500">info</span>
                        <span>Quy trình Agent sẽ mặc định chạy trên model chat hiện tại: <strong>{activeModel?.id?.split("/").pop() || "Chưa chọn"}</strong></span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-subtle bg-surface-2/80">
                <button
                  type="button"
                  onClick={closeReportWorkflowConfirm}
                  className="px-4 py-2 rounded-[10px] border border-border bg-bg text-text-muted hover:text-text-main hover:bg-surface-2 transition-all text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmReportWorkflow}
                  disabled={reportModelsLoading || (reportModels.length === 0 && !activeModel)}
                  className="px-4 py-2 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white transition-all text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Bắt đầu quy trình
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Sessions Sidebar ── */}
        <div className="hidden lg:flex flex-col w-60 xl:w-64 border-r border-border-subtle bg-vibrancy flex-shrink-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-main">Chats</h2>
            <button
              onClick={handleNewChat}
              disabled={!activeModel}
              className="p-1 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors disabled:opacity-40"
              title="New chat"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            {sortedSessions.length === 0 ? (
              <div className="py-8 text-center">
                <span className="material-symbols-outlined text-[28px] text-text-subtle block mb-2">
                  forum
                </span>
                <p className="text-xs text-text-subtle">No conversations yet</p>
              </div>
            ) : (
              sortedSessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSessionId(s.id);
                        if (
                          s.modelId &&
                          allModels.find((m) => m.id === s.modelId)
                        )
                          setActiveModelId(s.modelId);
                      }
                    }}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      if (s.modelId && allModels.find((m) => m.id === s.modelId))
                        setActiveModelId(s.modelId);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-[8px] transition-all group cursor-pointer",
                      "flex items-start gap-2 select-none",
                      isActive
                        ? "bg-primary/8 text-primary"
                        : "text-text-muted hover:bg-surface-2 hover:text-text-main",
                    )}
                  >
                    <span
                      className={cn(
                        "material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5",
                        isActive ? "fill-1" : "",
                      )}
                    >
                      {isActive ? "chat" : "chat_bubble_outline"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-[12.5px] font-medium truncate",
                          isActive ? "text-primary" : "",
                        )}
                      >
                        {s.title}
                      </p>
                      <p className="text-[11px] text-text-subtle">
                        {relTime(s.updatedAt)} · {s.messages?.length || 0} msgs
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-subtle hover:text-danger transition-all"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        delete_outline
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-4 py-2 border-t border-border-subtle">
            <p className="text-[11px] text-text-subtle text-center">
              {enabledModels.length} model{enabledModels.length !== 1 ? "s" : ""}{" "}
              active
            </p>
          </div>
        </div>

        {/* ── Mobile History Drawer ── */}
        {mobileHistoryOpen && (
          <div
            className="fixed inset-0 z-[90] lg:hidden"
            onClick={() => setMobileHistoryOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Drawer panel */}
            <div
              className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface border-r border-border-subtle shadow-[var(--shadow-elev)] flex flex-col"
              style={{ animation: "asstSlideRight 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-text-main">Lịch sử chat</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleNewChat}
                    disabled={!activeModel}
                    className="p-1.5 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors disabled:opacity-40"
                    title="Cuộc trò chuyện mới"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                  <button
                    onClick={() => setMobileHistoryOpen(false)}
                    className="p-1.5 rounded-[6px] text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                    title="Đóng"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Session List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                {sortedSessions.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="material-symbols-outlined text-[32px] text-text-subtle block mb-2">forum</span>
                    <p className="text-xs text-text-subtle">Chưa có cuộc trò chuyện nào</p>
                  </div>
                ) : (
                  sortedSessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveSessionId(s.id);
                            if (s.modelId && allModels.find((m) => m.id === s.modelId))
                              setActiveModelId(s.modelId);
                            setMobileHistoryOpen(false);
                          }
                        }}
                        onClick={() => {
                          setActiveSessionId(s.id);
                          if (s.modelId && allModels.find((m) => m.id === s.modelId))
                            setActiveModelId(s.modelId);
                          setMobileHistoryOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-[8px] transition-all group cursor-pointer",
                          "flex items-start gap-2 select-none",
                          isActive
                            ? "bg-primary/8 text-primary"
                            : "text-text-muted hover:bg-surface-2 hover:text-text-main",
                        )}
                      >
                        <span
                          className={cn(
                            "material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5",
                            isActive ? "fill-1" : "",
                          )}
                        >
                          {isActive ? "chat" : "chat_bubble_outline"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-[13px] font-medium truncate",
                              isActive ? "text-primary" : "",
                            )}
                          >
                            {s.title}
                          </p>
                          <p className="text-[11px] text-text-subtle mt-0.5">
                            {relTime(s.updatedAt)} · {s.messages?.length || 0} tin
                          </p>
                        </div>
                        <button
                          onClick={(e) => { handleDeleteSession(s.id, e); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-subtle hover:text-danger transition-all"
                        >
                          <span className="material-symbols-outlined text-[13px]">delete_outline</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer footer */}
              <div className="px-4 py-2.5 border-t border-border-subtle flex-shrink-0">
                <p className="text-[11px] text-text-subtle text-center">
                  {enabledModels.length} model{enabledModels.length !== 1 ? "s" : ""} active
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex min-w-0 min-h-0 relative overflow-hidden">
          {/* Left Side: Chat Panel */}
          <div
            className={cn(
              "flex flex-col min-w-0 min-h-0 h-full border-r border-border-subtle transition-all duration-300",
              activeDoc
                ? "hidden md:flex md:w-[50%] xl:w-[45%]"
                : (agentActive && agentState)
                  ? "hidden md:flex flex-1"
                  : "flex-1",
            )}
          >
            {/* Top Bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle bg-surface flex-shrink-0">
              {/* Model Selector */}
              <div ref={modelDropRef} className="relative">
                <button
                  onClick={handleModelDropdownToggle}
                  disabled={loadingModels}
                  className={cn(
                    "flex items-center gap-2 h-8 px-3 rounded-[8px] text-sm transition-all",
                    "bg-bg border border-border text-text-main",
                    "hover:border-brand-500/40 hover:bg-surface-2",
                    "disabled:opacity-50",
                  )}
                >
                  {loadingModels ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin text-text-muted">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px] text-brand-500">
                      smart_toy
                    </span>
                  )}
                  <span className="text-[13px] font-medium max-w-[160px] truncate">
                    {loadingModels
                      ? "Loading…"
                      : activeModel
                        ? activeModel.id.split("/").pop()
                        : "Select model"}
                  </span>
                  {activeModel && (
                    <span className="text-[11px] text-text-subtle truncate hidden sm:inline">
                      {activeModel.owned_by || activeModel.id.split("/")[0]}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[16px] text-text-subtle">
                    expand_more
                  </span>
                </button>

                {/* Model dropdown */}
                {modelDropOpen && enabledModels.length > 0 && (
                  <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(300px,90vw)] bg-surface border border-border rounded-[12px] shadow-[var(--shadow-elevated)] overflow-hidden slide-in-top">
                    <div className="px-3 py-2 border-b border-border-subtle">
                      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Select Model
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar p-1.5">
                      {enabledModels.map((m) => {
                        const active = m.id === activeModelId;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setActiveModelId(m.id);
                              setModelDropOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all",
                              active
                                ? "bg-primary/8 text-primary"
                                : "text-text-muted hover:bg-surface-2 hover:text-text-main",
                            )}
                          >
                            <span
                              className={cn(
                                "material-symbols-outlined text-[16px]",
                                active
                                  ? "fill-1 text-primary"
                                  : "text-text-subtle",
                              )}
                            >
                              psychology
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "text-[13px] font-medium truncate",
                                  active ? "text-primary" : "",
                                )}
                              >
                                {m.id.split("/").pop()}
                              </p>
                              <p className="text-[11px] text-text-subtle truncate">
                                {m.owned_by || m.id.split("/")[0]}
                              </p>
                            </div>
                            {active && (
                              <span className="material-symbols-outlined text-[16px] text-primary fill-1">
                                check_circle
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* History (mobile) */}
              <Button
                variant="ghost"
                size="sm"
                icon="history"
                onClick={() => setMobileHistoryOpen(true)}
                className="lg:hidden"
              />

              {/* New Chat (mobile) */}
              <Button
                variant="ghost"
                size="sm"
                icon="add"
                onClick={handleNewChat}
                disabled={!activeModel}
                className="lg:hidden"
              >
                New chat
              </Button>

              {/* Settings (mobile) */}
              <Button
                variant="ghost"
                size="sm"
                icon="tune"
                onClick={handleOpenSettings}
                className="lg:hidden"
              />

              {/* Settings (desktop) */}
              <Button
                variant="ghost"
                size="sm"
                icon="tune"
                onClick={handleOpenSettings}
                className="hidden lg:flex"
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-4 min-h-0">
              {loadError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-danger text-sm">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                    error
                  </span>
                  {loadError}
                </div>
              )}

              {/* Empty state */}
              {messages.length === 0 && !isSending && !loadingModels && (
                <div
                  className="flex flex-col items-center justify-center py-16 text-center"
                  style={{ animation: "asstFadeIn 0.4s ease" }}
                >
                  <div className="size-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-[var(--shadow-warm)]">
                    <span className="material-symbols-outlined text-white text-[28px]">
                      description
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-text-main mb-1">
                    Trợ lý báo cáo
                  </h3>
                  <p className="text-sm text-text-muted max-w-sm mb-6 leading-relaxed">
                    {activeModel
                      ? `Được hỗ trợ bởi ${activeModel.id.split("/").pop()} qua VeloRoute. Bắt đầu hội thoại hoặc tải lên số liệu báo cáo.`
                      : "Kết nối một provider để bắt đầu hội thoại."}
                  </p>
                  {activeModel && (
                    <div className="flex flex-wrap gap-2 justify-center max-w-md">
                      {[
                        "Phác thảo đề cương báo cáo doanh thu",
                        "Viết thư cảm ơn đối tác trang trọng",
                        "Tóm tắt xu hướng thị trường công nghệ",
                        "Phân tích điểm mạnh điểm yếu (SWOT)",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setDraft(q);
                            textareaRef.current?.focus();
                          }}
                          className="px-3 py-1.5 text-xs rounded-full border border-border text-text-muted hover:text-text-main hover:border-brand-500/40 hover:bg-bg transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <MessageBlock
                  key={msg.id}
                  msg={msg}
                  isStreaming={msg.id === streamingId}
                  filesBySubject={combinedFilesBySubject}
                  onEditSubmit={handleEditSubmit}
                  onRegenerate={handleRegenerate}
                  onOpenOutline={setSelectedOutline}
                  onOpenReport={handleOpenReportCard}
                  onOpenAgentRun={handleOpenAgentRunFromCard}
                />
              ))}

              {isSending && !streamingId && (
                <div className="flex gap-2.5 items-start">
                  <AssistantAvatar />
                  <div className="px-3 py-2 rounded-[12px] bg-surface border border-border-subtle">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-border-subtle bg-surface px-4 py-3 pb-6 md:pb-3">
              <div className="max-w-4xl mx-auto w-full">
              {searchStatus && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-[8px] bg-brand-500/5 border border-brand-500/10 text-[11px] text-brand-600 dark:text-brand-400 font-medium">
                  <span className="material-symbols-outlined text-[14px] animate-spin">
                    sync
                  </span>
                  <span>{searchStatus}</span>
                </div>
              )}
              <div
                className={cn(
                  "flex flex-col rounded-[12px] border transition-all overflow-hidden bg-bg",
                  "border-border focus-within:border-brand-500/50 focus-within:shadow-[var(--shadow-focus)]",
                )}
              >
                {/* Attached Files Bar */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border-subtle bg-bg/50">
                    {attachedFiles.map((file) => {
                      const isImg = file.type?.startsWith("image/");
                      const isUploading = file.status === "uploading";
                      const isError = file.status === "error";

                      return (
                        <div
                          key={file.id}
                          className={cn(
                            "relative flex items-center gap-2 pl-2 pr-1 py-1 rounded-[8px] border text-xs font-medium bg-surface min-w-[120px] max-w-[200px]",
                            isError
                              ? "border-danger/30 bg-danger/5 text-danger"
                              : "border-border",
                          )}
                        >
                          {isImg && file.url ? (
                            <img
                              src={file.url}
                              alt={file.name || "Tệp hình ảnh"}
                              className="size-6 rounded-[4px] object-cover flex-shrink-0"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-[16px] text-text-muted flex-shrink-0">
                              {isImg ? "image" : "description"}
                            </span>
                          )}

                          <div className="flex-1 min-w-0 leading-tight">
                            <p
                              className="truncate text-[11px] text-text-main"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            {isUploading ? (
                              <p className="text-[9px] text-text-subtle animate-pulse">
                                Uploading...
                              </p>
                            ) : isError ? (
                              <p
                                className="text-[9px] text-danger truncate"
                                title={file.errorMsg}
                              >
                                {file.errorMsg}
                              </p>
                            ) : (
                              <p className="text-[9px] text-text-subtle">
                                {formatBytes(file.size)}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => removeAttachedFile(file.id)}
                            className="size-5 rounded-full hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors flex-shrink-0"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              close
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-end gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    disabled={isSending || !activeModel}
                    className={cn(
                      "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-2 transition-all active:scale-95 disabled:opacity-40",
                    )}
                    title="Attach files"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      attach_file
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebSearchEnabled((prev) => !prev)}
                    className={cn(
                      "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-40",
                      webSearchEnabled
                        ? "text-brand-500 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2",
                    )}
                    title={
                      webSearchEnabled
                        ? "Tắt Tìm kiếm Web (đang Bật)"
                        : "Bật Tìm kiếm Web (Tavily AI)"
                    }
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      language
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAgentModeEnabled((prev) => !prev)}
                    className={cn(
                      "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-40",
                      agentModeEnabled
                        ? "text-brand-500 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20"
                        : "text-text-muted hover:text-text-main hover:bg-surface-2",
                    )}
                    title={
                      agentModeEnabled
                        ? "Tắt Chế độ AI Agent (đang Bật)"
                        : "Bật Chế độ AI Agent (Planning & execution)"
                    }
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      support_agent
                    </span>
                  </button>

                  {agentModeEnabled && allSubjects.length > 0 && (
                    <select
                      value={selectedKnowledgeSubject}
                      onChange={(e) =>
                        handleSubjectChange(e.target.value)
                      }
                      className="h-8 px-2 text-xs bg-surface border border-border rounded-[8px] outline-none text-text-main focus:border-brand-500/50 max-w-[150px] shrink-0 font-semibold cursor-pointer"
                      title="Chọn loại chủ đề báo cáo mẫu để nạp tri thức"
                    >
                      <option value="none">-- Chủ đề báo cáo --</option>
                      {allSubjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSending || !activeModel}
                  />

                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      activeModel
                        ? `Message ${activeModel.id.split("/").pop()}… (Enter to send)`
                        : "Select a model to start chatting…"
                    }
                    disabled={!activeModel || isSending}
                    rows={1}
                    className="flex-1 resize-none bg-transparent outline-none text-sm text-text-main placeholder:text-text-subtle font-sans leading-relaxed py-0.5 max-h-40 overflow-y-auto disabled:opacity-50"
                  />

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isSending ? (
                      <button
                        type="button"
                        onClick={handleStopStreaming}
                        className="size-8 rounded-[8px] flex items-center justify-center bg-danger/10 hover:bg-danger/20 text-danger transition-all active:scale-95 cursor-pointer"
                        title="Dừng phản hồi"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          stop
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!draft.trim() || isSending || !activeModel}
                        className={cn(
                          "size-8 rounded-[8px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 cursor-pointer",
                          draft.trim() && activeModel
                            ? "bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/10"
                            : "text-text-muted hover:text-text-main hover:bg-surface-2",
                        )}
                        title="Gửi tin nhắn"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          send
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat footer info */}
              <div className="mt-2 text-center text-[10px] text-text-subtle font-sans leading-normal">
                AI Agent có khả năng tự động trích xuất tri thức, phân tích & lập
                đề cương báo cáo chất lượng cao.
              </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Preview or Agent view */}
          {activeDoc ? (
            <div
              ref={previewPanelRef}
              className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-surface border-l border-border-subtle relative overflow-hidden"
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-brand-500 text-[20px]">
                    article
                  </span>
                  <span className="font-semibold text-text-main truncate text-sm">
                    {activeDocTitle}
                  </span>
                  {activeDocType === "report" && (
                    <span className="material-symbols-outlined text-[16px] text-emerald-500 flex-shrink-0">
                      cloud_done
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      handlePrintReport(activeDocTitle, activeDoc.content || "")
                    }
                    className="size-8 rounded-[8px] hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors"
                    title="In tài liệu"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      print
                    </span>
                  </button>
                  <button
                    onClick={async () => {
                      const copied = await copyReportRichText(
                        activeDoc.content || "",
                        activeDocTitle,
                      );
                      showToast(
                        copied
                          ? "Đã sao chép nội dung sang clipboard."
                          : "Đã sao chép dạng văn bản thuần.",
                        "success",
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-border bg-bg text-text-muted hover:text-text-main hover:bg-surface-2 transition-all text-xs font-medium select-none"
                    title="Sao chép"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      content_copy
                    </span>
                    <span>Sao chép</span>
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await dlDocx(
                        activeDoc.content || "",
                        activeDocFileName,
                      );
                      showToast(
                        ok
                          ? "Đã tạo file Word (.docx)."
                          : "Không thể tạo file Word (.docx).",
                        ok ? "success" : "error",
                      );
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all shrink-0 select-none shadow-sm cursor-pointer"
                    title="Tải xuống định dạng Word (.docx)"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      download
                    </span>
                    <span>Tải Word (.docx)</span>
                  </button>
                  <button
                    onClick={closeDoc}
                    className="p-1.5 rounded-[8px] hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors shrink-0"
                    title="Đóng bảng xem chi tiết"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      close
                    </span>
                  </button>
                </div>
              </div>

              {/* Preview Pages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-0 py-6 bg-surface-2 dark:bg-bg min-h-0">
                {!isRenderingPreview ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    <span className="text-sm">Đang tải tài liệu...</span>
                  </div>
                ) : (() => {
                  const isBa49 = activeDocTitle.toLowerCase().includes("ba49") ||
                    activeDocTitle.toLowerCase().includes("b49") ||
                    activeDocTitle.toLowerCase().includes("kiến tập") ||
                    (activeDoc.content || "").toLowerCase().includes("ba49") ||
                    (activeDoc.content || "").toLowerCase().includes("b49") ||
                    (activeDoc.content || "").toLowerCase().includes("kiến tập");

                  const pages = paginateReportContent(
                    prepareReportContent(activeDoc.content || "", activeDocTitle),
                  );
                  const pageMeta = pages.map((pageContent) => {
                    const isCover = pageContent.includes("cover-page-container") ||
                      pageContent.includes("TRƯỜNG ĐẠI HỌC MỞ HÀ NỘI") ||
                      pageContent.includes("[LOGO_HOU]");
                    const isAbbrev = pageContent.includes("DANH MỤC TỪ VIẾT TẮT") ||
                      pageContent.includes("DANH MUC TU VIET TAT");
                    const isAfterConc = pageContent.includes("NHẬN XÉT KIẾN TẬP") ||
                      pageContent.includes("NHAN XET KIEN TAP") ||
                      pageContent.includes("DANH MỤC TÀI LIỆU THAM KHẢO") ||
                      pageContent.includes("DANH MUC TAI LIEU THAM KHAO") ||
                      pageContent.includes("XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN THỰC TẬP") ||
                      pageContent.includes("XAC NHAN CUA CAN BO HUONG DAN THUC TAP");
                    const isActive = !isCover && !isAbbrev && !isAfterConc;
                    return { isActive };
                  });

                  let runningPageNum = 0;
                  const pageNumbers = pageMeta.map((meta) => {
                    if (meta.isActive) {
                      runningPageNum++;
                      return runningPageNum;
                    }
                    return null;
                  });

                  return (
                    <div className="flex flex-col items-center gap-6 w-full">
                      <style>{`
                        .report-view h3 {
                          font-weight: normal !important;
                          font-style: italic !important;
                        }
                      `}</style>
                      {pages.map((pageContent, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "relative w-[90%] min-h-[297mm] bg-white dark:bg-bg border border-border/40 rounded-[4px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.22)] overflow-hidden report-view select-text text-text-main",
                            isBa49 && "is-ba49-report"
                          )}
                          style={{
                            paddingTop: "2.5cm",
                            paddingRight: "2cm",
                            paddingBottom: "3.2cm",
                            paddingLeft: "3cm",
                            animation: "asstFadeIn 0.3s ease both",
                          }}
                        >
                          {idx === 0 && (
                            <div
                              className="absolute pointer-events-none"
                              style={{
                                top: "0.4cm",
                                bottom: "0.4cm",
                                left: "0.4cm",
                                right: "0.4cm",
                                border: "4px double currentColor",
                                zIndex: 10
                              }}
                            />
                          )}
                          <div
                            className="w-full h-full overflow-visible"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownAndMath(pageContent),
                            }}
                          />
                          {pageNumbers[idx] !== null && (
                            <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-text-subtle select-none font-sans pointer-events-none">
                              Trang {pageNumbers[idx]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            agentActive &&
            agentState && (
              <div
                ref={agentPanelRef}
                className="flex-1 md:max-w-[45%] xl:max-w-[40%] flex flex-col min-w-0 min-h-0 h-full bg-surface/75 dark:bg-bg/75 backdrop-blur-xl border-l border-border/60 relative overflow-hidden shadow-2xl"
              >
                {/* Decorative dynamic ambient glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

                {/* Agent Panel Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/55 bg-surface/80 dark:bg-bg/85 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <span className="material-symbols-outlined text-brand-500 text-[20px] animate-pulse bg-brand-500/10 dark:bg-brand-500/15 p-2 rounded-full shadow-[0_0_15px_rgba(229,106,74,0.15)] flex items-center justify-center">
                        support_agent
                      </span>
                      <span className="absolute bottom-0 right-0 size-2 bg-emerald-500 border border-white dark:border-bg rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold bg-gradient-to-r from-brand-600 via-pink-600 to-indigo-600 dark:from-brand-400 dark:via-pink-400 dark:to-indigo-400 bg-clip-text text-transparent truncate text-[13.5px] tracking-wide">
                        AI Agent - Báo cáo tự động
                      </span>
                      <span className="text-[10px] text-text-subtle font-medium mt-0.5">
                        Quy trình RAG tự động đa bước
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(agentState.current_step === "OUTLINING" ||
                      agentState.current_step === "DRAFTING") && (
                        <button
                          onClick={handleCancelAgent}
                          disabled={agentLoading}
                          className="h-7 px-2.5 rounded-full border border-red-500/25 bg-red-500/8 text-red-600 dark:text-red-400 hover:bg-red-500/12 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 disabled:opacity-50"
                          title="Hủy quy trình Agent"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            stop_circle
                          </span>
                          Hủy
                        </button>
                      )}
                    <span className="text-[9.5px] bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 px-2.5 py-0.5 rounded-full font-extrabold tracking-wider uppercase shadow-inner">
                      {agentState.current_step}
                    </span>
                    <button
                      onClick={() => setAgentActive(false)}
                      className="size-7 rounded-full border border-border/70 bg-surface/80 text-text-muted hover:text-text-main hover:bg-surface-2 transition-all flex items-center justify-center"
                      title="Đóng form quy trình Agent"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        close
                      </span>
                    </button>
                  </div>
                </div>

                {/* Agent Panel Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 relative z-10">
                  {/* Status banner */}
                  <div className="p-4 border border-brand-500/15 dark:border-brand-500/25 bg-gradient-to-br from-brand-500/8 to-indigo-500/8 dark:from-brand-500/12 dark:to-indigo-500/12 rounded-[16px] flex items-start gap-3.5 shadow-lg shadow-brand-500/5 hover:border-brand-500/35 transition-all duration-300">
                    <span className="material-symbols-outlined text-brand-500 text-[22px] flex-shrink-0 bg-brand-500/15 p-1 rounded-full animate-bounce">
                      info
                    </span>
                    <div className="text-xs flex-1">
                      <p className="font-extrabold text-text-main text-[13px] tracking-wide">
                        {agentState.current_step === "PLANNING"
                          ? "Đang tạo quy trình"
                          : agentState.current_step === "OUTLINING"
                            ? "Đợi phê duyệt đề cương"
                            : agentState.current_step === "DRAFTING"
                              ? "Agent đang soạn thảo báo cáo..."
                              : agentState.current_step === "COMPLETED"
                                ? "Đã hoàn thành toàn bộ báo cáo!"
                                : agentState.current_step === "REVIEW_REQUIRED"
                                  ? "Nội dung cần được xem lại"
                                : "Agent đang chạy..."}
                      </p>
                      <p className="text-text-muted mt-1 leading-relaxed text-[11px] font-medium">
                        {agentState.current_step === "PLANNING"
                          ? "AI đang phân tích yêu cầu, đọc đề cương và tham khảo báo cáo mẫu để tạo quy trình."
                          : agentState.current_step === "OUTLINING"
                            ? "Hãy kiểm tra đề cương do Agent lập ở dưới. Bạn có thể bấm phê duyệt để tiếp tục viết hoặc gửi yêu cầu chỉnh sửa."
                            : agentState.current_step === "DRAFTING"
                              ? "Hệ thống đang chạy ngầm tự động soạn thảo từng chương mục một cách độc lập."
                              : agentState.current_step === "COMPLETED"
                                ? "Chúc mừng! Toàn bộ nội dung báo cáo đã được soạn thảo và kiểm định hoàn tất."
                                : agentState.current_step === "REVIEW_REQUIRED"
                                  ? "Critic chưa phê duyệt mục vừa soạn. Hãy đọc phản hồi và tạo lại mục này để tiếp tục."
                                : ""}
                      </p>
                      {(agentState.current_step === "PLANNING" || agentState.current_step === "DRAFTING") && (
                        <p className="text-amber-600 dark:text-amber-400 font-semibold text-[10.5px] mt-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] animate-pulse">hourglass_empty</span>
                          <span>Thời gian xử lý dự kiến: &gt; 5 phút. Vui lòng không đóng trang.</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {currentSession && shouldAutoRestoreReportSession(currentSession) && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-border/60 bg-surface/70 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-main">Session báo cáo có thể tiếp tục</p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Bấm để tải lại trạng thái quy trình gần nhất thay vì tự động gọi khi mở trang.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadAgentStatus(currentSession.id)}
                        disabled={agentLoading}
                        className="shrink-0 px-3 py-2 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Tiếp tục quy trình
                      </button>
                    </div>
                  )}

                  {/* Milestone Approval Box */}
                  {agentState.current_step === "COMPLETED" && (
                    <div className="p-4 border border-emerald-500/25 dark:border-emerald-500/35 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-[16px] space-y-3.5 shadow-md shadow-emerald-500/5 hover:border-emerald-500/40 transition-all duration-300">
                      <h4 className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">
                          verified
                        </span>
                        Báo cáo đã hoàn thành!
                      </h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            openAgentProgressPreview(
                              agentState,
                              "Báo cáo hoàn chỉnh",
                            );
                          }}
                          className="flex-1 py-2.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/15 active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            visibility
                          </span>
                          Xem bản xem trước báo cáo
                        </button>
                        <button
                          onClick={() => {
                            setAgentActive(true);
                          }}
                          className="px-4 py-2.5 text-xs font-bold bg-surface hover:bg-surface-2 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            format_list_bulleted
                          </span>
                          Xem dàn ý
                        </button>
                      </div>
                    </div>
                  )}

                  {agentState.current_step === "OUTLINING" && (
                    <div className="p-4 border border-amber-500/25 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 rounded-[16px] space-y-3.5 shadow-md shadow-amber-500/5 hover:border-amber-500/40 transition-all duration-300">
                      <h4 className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] animate-pulse">
                          verified
                        </span>
                        Phê duyệt đề cương để Agent triển khai
                      </h4>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed font-semibold flex items-start gap-1">
                        <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">warning</span>
                        <span>Quá trình soạn thảo chi tiết từng chương sau khi phê duyệt sẽ mất khoảng 5 - 10 phút. Vui lòng giữ tab này mở.</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelAgent}
                          disabled={agentLoading}
                          className="px-3 py-2.5 text-xs font-bold bg-surface/80 hover:bg-red-500/8 text-red-600 dark:text-red-400 border border-red-500/25 rounded-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                          Hủy
                        </button>
                        <button
                          onClick={() => handleApproveOutline()}
                          disabled={agentLoading}
                          className="flex-1 py-2.5 text-xs font-bold bg-gradient-to-r from-brand-500 to-indigo-500 hover:from-brand-600 hover:to-indigo-600 text-white rounded-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/15 active:scale-[0.98] disabled:opacity-50"
                        >
                          {agentLoading ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] animate-spin">
                                sync
                              </span>
                              Đang xử lý...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">
                                play_arrow
                              </span>
                              Phê duyệt & Viết tiếp
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Progress Stepper & Section Content */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider block">
                        Tiến độ các chương mục (
                        {agentState.sections_progress?.length})
                      </h4>
                      <span className="text-[10px] text-text-subtle font-semibold">
                        {agentState.sections_progress?.filter(
                          (s) => s.status === "done",
                        ).length || 0}
                        /{agentState.sections_progress?.length || 0} Hoàn thành
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {(agentState.sections_progress || []).map((sec) => {
                        const isDrafting = sec.status === "drafting";
                        const isDone = sec.status === "done";
                        const needsReview = sec.status === "review_required";
                        return (
                          <div
                            key={sec.id}
                            style={{
                              marginLeft: `${Math.max(0, (sec.level || 1) - 1) * 14}px`,
                            }}
                            className={cn(
                              "p-4 rounded-[16px] border transition-all text-xs space-y-3 duration-300",
                              isDrafting
                                ? "border-amber-500/35 bg-gradient-to-br from-amber-500/8 to-amber-500/2 dark:from-amber-500/12 dark:to-amber-500/3 shadow-[0_0_20px_rgba(245,158,11,0.08)] active:scale-[0.99] animate-border-glow"
                                : isDone
                                  ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/6 to-emerald-500/2 dark:from-emerald-500/10 dark:to-emerald-500/2 shadow-[0_4px_12px_rgba(16,185,129,0.04)]"
                                  : "border-border/60 bg-surface/50 dark:bg-bg/40 hover:bg-surface/80 dark:hover:bg-bg/60",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-text-main truncate text-[12.5px] tracking-wide">
                                  {sec.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {(isDone || needsReview) && !agentLoading && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReloadSection(sec.id);
                                    }}
                                    className="p-1 rounded bg-surface border border-border hover:bg-surface-2 text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
                                    title="Tạo lại mục này"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">
                                      refresh
                                    </span>
                                  </button>
                                )}
                                {sec.level && sec.level > 1 && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-surface-2 text-text-subtle border border-border/40">
                                    Cấp {sec.level}
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold flex items-center gap-1 uppercase tracking-wider shadow-sm",
                                    isDrafting
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                                      : needsReview
                                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                      : isDone
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-surface-2 text-text-subtle border border-border/40",
                                  )}
                                >
                                  {isDrafting && (
                                    <span className="material-symbols-outlined text-[10px] animate-spin">
                                      sync
                                    </span>
                                  )}
                                  {isDone && (
                                    <span className="material-symbols-outlined text-[10px]">
                                      check
                                    </span>
                                  )}
                                  {needsReview && (
                                    <span className="material-symbols-outlined text-[10px]">
                                      rate_review
                                    </span>
                                  )}
                                  {(sec.status || "todo").toUpperCase()}
                                </span>
                              </div>
                            </div>

                            <p className="text-text-muted text-[11px] leading-relaxed font-medium">
                              {sec.description}
                            </p>

                            {needsReview && sec.feedback && (
                              <div className="rounded-[10px] border border-red-500/25 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                                <p className="font-bold mb-1">Phản hồi từ Critic</p>
                                <p>{sec.feedback}</p>
                              </div>
                            )}

                            {Array.isArray(sec.subsections) && sec.subsections.length > 0 && (
                              <div className="rounded-[12px] border border-border/45 bg-bg/40 px-3 py-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-text-subtle mb-1">
                                  Mục con
                                </p>
                                <div className="space-y-1.5 pl-2 border-l border-border/50">
                                  {sec.subsections.map((subsection, subIdx) => (
                                    <div key={`${sec.id}-${subIdx}`} className="text-[11px] leading-relaxed text-text-main font-medium">
                                      <span className="text-text-subtle mr-1">•</span>
                                      {subsection}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {sec.activity?.message && (
                              <div className="rounded-[10px] border border-border/45 bg-bg/55 dark:bg-bg/35 px-3 py-2">
                                <div className="flex items-start gap-2">
                                  <span
                                    className={cn(
                                      "material-symbols-outlined text-[15px] mt-0.5 shrink-0",
                                      isDrafting
                                        ? "text-amber-500 animate-spin"
                                        : isDone
                                          ? "text-emerald-500"
                                          : "text-text-subtle",
                                    )}
                                  >
                                    {isDrafting ? "sync" : isDone ? "task_alt" : "radio_button_unchecked"}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-subtle truncate">
                                        {sec.activity.actor || "Agent"}
                                      </span>
                                      {sec.activity.phase && (
                                        <span className="text-[9px] font-bold text-text-subtle uppercase tracking-wide truncate max-w-[140px]">
                                          {sec.activity.phase.replaceAll("_", " ")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-[11px] text-text-main font-medium leading-relaxed">
                                      {sec.activity.message}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {sec.content && (
                              <div className="mt-2.5 p-3 rounded-[12px] bg-bg/70 dark:bg-bg/90 border border-border/45 max-h-36 overflow-y-auto text-text-main custom-scrollbar font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap shadow-inner relative group/code">
                                <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(sec.content);
                                      setToast({
                                        show: true,
                                        message: "Đã sao chép chương mục!",
                                        type: "success",
                                      });
                                      setTimeout(
                                        () =>
                                          setToast({
                                            show: false,
                                            message: "",
                                            type: "success",
                                          }),
                                        2000,
                                      );
                                    }}
                                    className="p-1 rounded bg-surface border border-border hover:bg-surface-2 text-[10px] text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer"
                                    title="Sao chép chương mục"
                                  >
                                    <span className="material-symbols-outlined text-[12px]">
                                      content_copy
                                    </span>
                                  </button>
                                </div>
                                {sec.content}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
        {agentErrorDialog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-[16px] border border-red-500/25 bg-surface shadow-[var(--shadow-elev)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 flex items-start gap-3">
                <span className="material-symbols-outlined text-[24px] text-red-500 shrink-0">
                  error
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-text-main">
                    {agentErrorDialog.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {agentErrorDialog.message}
                  </p>
                </div>
              </div>
              {agentErrorDialog.detail && (
                <div className="mx-5 mt-4 max-h-32 overflow-y-auto custom-scrollbar rounded-[10px] border border-border/60 bg-bg/70 px-3 py-2 text-[11px] leading-relaxed text-text-subtle whitespace-pre-wrap">
                  {agentErrorDialog.detail}
                </div>
              )}
              <div className="px-5 py-4 flex justify-end">
                <button
                  onClick={() => setAgentErrorDialog(null)}
                  className="px-4 py-2 rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Premium Toast Popup */}
        {toast.show && (
          <div
            className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-[12px] bg-surface/90 border border-brand-500/20 shadow-[var(--shadow-elev)] backdrop-blur-md text-xs font-semibold text-text-main asst-slide-left animate-bounce"
            style={{
              animation: "asstSlideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <span
              className={
                toast.type === "success"
                  ? "material-symbols-outlined text-[16px] text-emerald-500"
                  : "material-symbols-outlined text-[16px] text-brand-500 animate-spin"
              }
            >
              {toast.type === "success" ? "check_circle" : "sync"}
            </span>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
