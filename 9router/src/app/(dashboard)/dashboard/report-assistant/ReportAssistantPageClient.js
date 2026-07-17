"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { supabase } from "@/lib/supabaseClient";
import useUserStore from "@/store/userStore";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";

// ─── Constants & Key Storage Helpers ──────────────────────────────────────────
const FALLBACK_SYSTEM_PROMPT = "";
const ASSISTANT_ONLY_FALLBACK_PROMPT = `Bạn là một trợ lý AI thân thiện. Hãy trả lời bằng tiếng Việt tự nhiên, rõ ràng và dễ hiểu. Nếu người dùng không yêu cầu tạo báo cáo, hãy trò chuyện như một trợ lý bình thường, giúp giải đáp thắc mắc và hướng dẫn từng bước.`;
const DEFAULT_TEMPERATURE = 0.7;
const REPORT_MAX_TOKENS = 4096;
const CHAT_MAX_TOKENS = 2048;
const OUTLINE_MAX_TOKENS = 2048;
const MAX_OUTLINE_CONTEXT_CHARS = 6000;
const MAX_STAGE_CONTEXT_CHARS = 6000;
const REPORT_KNOWLEDGE_GLOBAL_USER = "global";
const REPORT_OUTLINE_CONTENT_USER = `report_assistant_outlines_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
const REPORT_TEMPLATE_CONTENT_USER = `report_assistant_templates_${REPORT_KNOWLEDGE_GLOBAL_USER}`;
const MAX_GLOBAL_OUTLINE_KNOWLEDGE_CHARS = 14000;
const MAX_SAMPLE_KNOWLEDGE_CHARS = 18000;
const SAMPLE_CHUNK_CHARS = 1800;
const SAMPLE_TOP_K = 8;
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
          const pageLines = [];
          let lastY = null;
          let currentLine = "";

          for (const item of textContent.items) {
            if (item.str === undefined) continue;
            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && Math.abs(y - lastY) > 2) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = item.str;
            } else {
              currentLine +=
                (currentLine && !currentLine.endsWith(" ") ? " " : "") +
                item.str;
            }
            lastY = y;
          }
          if (currentLine.trim()) pageLines.push(currentLine.trim());

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
      .replace(/^\d+(?:\.\d+)*\s*/, ""),
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
  const normalized = normalizeMajorHeadingLine(line);
  if (!normalized) return false;
  return (
    /^loi mo dau\b/.test(normalized) ||
    /^mo dau\b/.test(normalized) ||
    /^chuong\s+([0-9ivxlcdm]+)\b/.test(normalized) ||
    /^chuong\s*(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(
      normalized,
    ) ||
    /^chapter\s+\d+\b/.test(normalized) ||
    /^ket luan\b/.test(normalized) ||
    /^tai lieu tham khao\b/.test(normalized) ||
    /^danh muc tai lieu tham khao\b/.test(normalized) ||
    /^muc luc\b/.test(normalized)
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

      const last = textValue(out[out.length - 1])
        .trim()
        .toUpperCase();
      if (out.length > 0 && last !== "[PAGE_BREAK]") {
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

function prepareReportContent(content) {
  return ensurePageBreakBeforeReferences(
    ensurePageBreakBeforeConclusion(
      removePageBreaksAfterHeadingOnly(
        normalizeMajorHeadingLevels(
          mergeDuplicateReferenceSections(
            stripDuplicateAdjacentDisplayLines(
              stripStandaloneSeparatorLines(stripSupabaseReportLinks(content)),
            ),
          ),
        ),
      ),
    ),
  );
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

function prepareReportContentForDocx(content) {
  // Inject page breaks before major sections (chapters) for DOCX export
  const withPageBreaks = injectSectionPageBreaks(content);
  return prepareReportContent(withPageBreaks);
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
    "h2 { font-size: 1.4em; margin-top: 1.2em; }" +
    "h3 { font-size: 1.2em; margin-top: 1em; }" +
    ".report-view > p { text-align: justify; text-indent: 1.25cm; margin: 0.8em 0; }" +
    ".report-view > p:has(> strong:first-child) { text-indent: 0; }" +
    "li p { text-indent: 0; margin: 0; }" +
    "table { width: 100%; border-collapse: collapse; margin: 1.2em 0; }" +
    "th, td { border: 1px solid #000; padding: 8px 12px; }" +
    "th { font-weight: bold; background-color: #f2f2f2; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    '<div class="report-view">' +
    htmlContent +
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

// Convert inline markdown to OOXML runs (bold, italic, bold-italic)
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
  // <br> / <br/> → blank line
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // <hr> is removed so DOCX matches preview/copy output
  text = text.replace(/<hr\s*\/?>/gi, "\n");
  // strip all remaining HTML tags
  text = text.replace(/<(?:\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "");
  // collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

// Render collected table rows as a proper OOXML <w:tbl> element
function tableRowsToOoxml(rows) {
  if (!rows.length) return "";
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const colWidth = Math.floor(8640 / colCount);
  const bdr = `w:val="single" w:sz="4" w:space="0" w:color="000000"`;
  let xml = `<w:tbl><w:tblPr>
    <w:tblW w:w="0" w:type="auto"/>
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
      const cellText = row[c] || "";
      xml += `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/>${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="E8E8E8"/>' : ""
        }</w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/>${isHeader ? '<w:jc w:val="center"/>' : ""
        }</w:pPr>${isHeader
          ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(cellText.replace(/\*\*/g, ""))}</w:t></w:r>`
          : toRuns(cellText)
        }</w:p></w:tc>`;
    }
    xml += `</w:tr>`;
  });
  xml += `</w:tbl>`;
  return xml;
}

// Convert markdown text to OOXML paragraph list (full-featured)
function mdToOoxml(rawContent) {
  const content = preprocessForDocx(rawContent);
  const lines = content.split("\n");
  const ps = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    // Empty line
    if (!t) {
      ps.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`);
      i++;
      continue;
    }
    // Page break
    if (t.includes("[PAGE_BREAK]")) {
      ps.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      i++;
      continue;
    }
    // Centered line (from <center>...</center>)
    if (t.startsWith(DOCX_CENTER)) {
      const ct = t.slice(DOCX_CENTER.length);
      ps.push(
        `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>${toRuns(ct)}</w:p>`,
      );
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
      ps.push(
        `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:after="80" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(boldOnly[1])}</w:t></w:r></w:p>`,
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
        `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="0"/></w:pPr>${toRuns(ol[2])}</w:p>`,
      );
      i++;
      continue;
    }
    // Normal paragraph — justify + first-line indent + 1.5 line spacing
    ps.push(
      `<w:p><w:pPr><w:jc w:val="both"/><w:ind w:firstLine="720"/><w:spacing w:before="0" w:after="160" w:line="360" w:lineRule="auto"/></w:pPr>${toRuns(t)}</w:p>`,
    );
    i++;
  }
  return ps.join("\n");
}

// Copy report content as rich HTML (for paste into Word/Google Docs with formatting)
async function copyReportRichText(rawContent) {
  const preparedContent = prepareReportContent(rawContent);
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
    table{border-collapse:collapse;width:100%;margin:1em 0;}
    th,td{border:1px solid #000;padding:6px 10px;font-size:14px;}
    th{background:#f2f2f2;font-weight:bold;text-align:center;}
    hr{border:none;border-top:1px solid #000;margin:1em 0;}
    ul{padding-left:2em;margin:0.5em 0;}ol{padding-left:2em;margin:0.5em 0;}
    em{font-style:italic;}strong{font-weight:bold;}
  </style></head><body>${formattedHtml}</body></html>`;
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

    // word/_rels/document.xml.rels
    word.folder("_rels").file(
      "document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKGREL}">
  <Relationship Id="rId1" Type="${OFFREL}/styles"    Target="styles.xml"/>
  <Relationship Id="rId2" Type="${OFFREL}/numbering" Target="numbering.xml"/>
</Relationships>`,
    );

    // word/document.xml
    const docxContent = prepareReportContentForDocx(content);
    word.file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}">
  <w:body>
${mdToOoxml(docxContent)}
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
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
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
    return true;
  } catch (err) {
    console.error("docx generation failed:", err);
    return false;
  }
}

// ─── Markdown and Math helper ───
function renderMarkdownAndMath(text) {
  if (typeof text !== "string") return "";

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

  return html;
}

function handlePrintReport(title, content) {
  const htmlContent = renderMarkdownAndMath(prepareReportContent(content));
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
            return (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] border border-border bg-surface-2 text-text-main hover:bg-surface-3 transition-colors text-[12px] font-medium"
              >
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
                  download
                </span>
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
          <h4 className="text-sm font-semibold text-text-main truncate">
            {title}
          </h4>
          <p className="text-[11px] text-text-subtle mt-0.5">{dateLabel}</p>
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
}) {
  const [selectedSubjectForUpload, setSelectedSubjectForUpload] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [docType, setDocType] = useState("outlines"); // 'outlines' or 'templates'
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState("");

  const allSubjects = useMemo(() => {
    const set = new Set([
      ...(subjectsOutlines || []),
      ...(subjectsTemplates || []),
    ]);
    return Array.from(set).sort();
  }, [subjectsOutlines, subjectsTemplates]);

  useEffect(() => {
    if (allSubjects.length > 0 && !selectedSubjectForUpload) {
      setSelectedSubjectForUpload(allSubjects[0]);
    } else if (allSubjects.length === 0) {
      setSelectedSubjectForUpload("__new__");
    }
  }, [allSubjects, selectedSubjectForUpload]);

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
              <option value="__new__">+ Thêm chủ đề mới...</option>
            </select>
          </div>

          {/* New Subject Input */}
          {selectedSubjectForUpload === "__new__" && (
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
              selectedSubjectForUpload === "__new__"
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

export default function ReportAssistantPageClient({ initialPrompt }) {
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
  const [agentErrorDialog, setAgentErrorDialog] = useState(null);
  const agentCancelRequestedRef = useRef(false);
  const agentQueueingRef = useRef(false);
  const [selectedKnowledgeSubject, setSelectedKnowledgeSubject] =
    useState("none");

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeModelId, setActiveModelId] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingId, setStreamingId] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [searchStatus, setSearchStatus] = useState("");

  const handleSubjectChange = useCallback(
    (subjValue) => {
      setSelectedKnowledgeSubject(subjValue);
      if (activeSessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                ...s,
                subject: subjValue,
                updatedAt: new Date().toISOString(),
              }
              : s,
          ),
        );
      }
    },
    [activeSessionId],
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
    const set = new Set([
      ...Object.keys(filesOutlines || {}),
      ...Object.keys(filesTemplates || {}),
    ]);
    return Array.from(set).sort();
  }, [filesOutlines, filesTemplates]);

  useEffect(() => {
    agentCancelRequestedRef.current = false;
    setAgentState(null);
    setAgentActive(false);
    if (activeSessionId) {
      setAgentLoading(true);
      fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          chatId: activeSessionId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.state) {
            setAgentState(data.state);
            setAgentActive(data.state.current_step !== "COMPLETED");
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
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setAgentLoading(false));
    }
  }, [activeSessionId]);

  // Sync selectedKnowledgeSubject from active session
  useEffect(() => {
    if (!activeSessionId) {
      setSelectedKnowledgeSubject("none");
      return;
    }
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    setSelectedKnowledgeSubject(currentSession?.subject || "none");
  }, [activeSessionId, sessions]);

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
      setSubjectsOutlines(data.subjects || []);
      setFilesOutlines(data.filesBySubject || {});
    } catch (err) {
      console.error("Failed to load outlines:", err);
    } finally {
      setLoadingOutlines(false);
    }
  }, [isSupabaseConfigured]);

  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/report-assistant/knowledge?username=${encodeURIComponent(REPORT_KNOWLEDGE_GLOBAL_USER)}&type=templates`,
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSubjectsTemplates(data.subjects || []);
      setFilesTemplates(data.filesBySubject || {});
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [isSupabaseConfigured]);

  // Load knowledge once hydrated and supabase configured
  useEffect(() => {
    if (hydrated && isSupabaseConfigured) {
      loadOutlines();
      loadTemplates();
    }
  }, [hydrated, isSupabaseConfigured, loadOutlines, loadTemplates]);

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
      .report-view h1, .report-view h2, .report-view h3, .report-view h4 {
        font-family: "Times New Roman", Times, serif !important;
        font-weight: bold !important;
        color: var(--color-text-main) !important;
        margin: 1.2em 0 0.6em !important;
        text-indent: 0 !important;
      }
      .report-view h1 { font-size: 1.75em !important; text-align: center !important; text-transform: uppercase !important; }
      .report-view h2 { font-size: 1.4em !important; }
      .report-view h3 { font-size: 1.2em !important; }
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
              localStorage.setItem(uSK.sessions, JSON.stringify(data.sessions));
            }
          }
        })
        .catch((e) =>
          console.warn("Failed to fetch database chat history:", e),
        );

      const rawActiveSession =
        localStorage.getItem(uSK.activeSession) ??
        localStorage.getItem("report-assistant.activeSession");
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

      setAssistantOnlyMode(true);
    } catch { }
  }, [hydrated, usernameLoaded, username]);

  // ── Persist ──
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);
      localStorage.setItem(uSK.sessions, JSON.stringify(sessions));
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

  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    if (hasStreamingMessage(sessions)) return;

    const signature = historySyncSignature(username, sessions);
    if (signature === lastHistorySyncSignatureRef.current) return;

    if (historySyncTimerRef.current) {
      clearTimeout(historySyncTimerRef.current);
    }

    historySyncTimerRef.current = setTimeout(() => {
      const payload = { username, sessions };
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

  const loadFullModels = useCallback(async () => {
    if (fullModelsLoaded) return;
    setLoadingModels(true);
    setLoadError("");
    try {
      const res = await fetch("/api/v1/models", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const models = Array.isArray(data?.data) ? data.data : [];
      applyFullModelList(models, username);
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
        const [modelsRes, keysRes, authData, promptRes] = await Promise.all([
          fetch("/api/v1/models/default", { cache: "no-store" }),
          fetch("/api/keys", { cache: "no-store" }),
          fetchUser(),
          fetch("/api/report-assistant/harness-prompt", {
            cache: "no-store",
          }).catch(() => null),
        ]);
        const modelsData = await modelsRes.json().catch(() => ({}));
        const keysData = await keysRes.json().catch(() => ({}));
        if (promptRes && promptRes.ok) {
          const promptData = await promptRes.json().catch(() => ({}));
          if (promptData?.prompt) {
            setDefaultSystemPrompt(promptData.prompt);
          }
        }
        const defaultModel = modelsData?.model || null;
        const models = defaultModel?.id ? [defaultModel] : [];
        const key = Array.isArray(keysData?.keys)
          ? keysData.keys.find((k) => k.isActive !== false)?.key || ""
          : "";
        const uName = authData?.username || "admin";
        setUsername(uName);

        // Check if this is a restricted user
        const normalized = uName.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const restrictedUsers = ["trang", "thu", "thuy", "nga"];
        setIsRestrictedUser(restrictedUsers.includes(normalized));

        if (typeof window !== "undefined") {
          localStorage.setItem("report-assistant.activeUsername", uName);
        }
        setAllModels(models);
        setApiKey(key);

        setEnabledModelIds(new Set(models.map((m) => m.id)));
        if (models.length > 0) setActiveModelId(models[0].id);
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
  const activeDocType = selectedReport
    ? "report"
    : selectedOutline
      ? "outline"
      : null;
  const activeDocTitle = activeDoc?.title || activeDoc?.name || "Preview";
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
    const reportBody = sections
      .filter((section) => String(section?.content || "").trim())
      .map((section) => {
        const content = String(section.content || "").trim();
        const firstLine =
          content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || "";
        const sameTitle =
          normalizeDisplayLineForDedup(firstLine) &&
          normalizeDisplayLineForDedup(firstLine) ===
          normalizeDisplayLineForDedup(section.title);
        return sameTitle ? content : `# ${section.title}\n\n${content}`;
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

    if (!webSources.length) return prepareReportContent(reportBody);

    const references = [
      "[PAGE_BREAK]",
      "## DANH MỤC TÀI LIỆU THAM KHẢO",
      ...webSources.map((source, index) => {
        return `${index + 1}. ${source.title}. Truy cập tại: ${source.url}`;
      }),
    ].join("\n");

    return prepareReportContent(reportBody
      ? `${reportBody}\n\n${references}`
      : references);
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

  const openReportWorkflowConfirm = useCallback((request) => {
    setPendingReportRequest(request);
  }, []);

  const closeReportWorkflowConfirm = useCallback(() => {
    setPendingReportRequest(null);
  }, []);

  const runAgentInit = useCallback(
    async (userPrompt, modelId, chatId, subjectOverride = selectedKnowledgeSubject) => {
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
            const dbRes = await fetch(
              `/api/knowledge-content?username=${encodeURIComponent(REPORT_OUTLINE_CONTENT_USER)}&subject=${encodeURIComponent(selectedOutlineSubject)}`,
            );
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              outlineKnowledge = (dbData.data || [])
                .map((row) => {
                  const text = (row.content_text || "").trim();
                  if (!text) return "";
                  return `[De cuong: ${row.filename || selectedOutlineSubject}]\n${text}`;
                })
                .filter(Boolean)
                .join("\n\n");
            }
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
            const dbRes = await fetch(
              `/api/knowledge-content?username=${encodeURIComponent(REPORT_TEMPLATE_CONTENT_USER)}&subject=${encodeURIComponent(selectedOutlineSubject)}`,
            );
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              templateKnowledge = (dbData.data || [])
                .slice(0, 3)
                .map((row) => {
                  const text = (row.content_text || "").trim();
                  if (!text) return "";
                  return `[Bao cao mau: ${row.filename || selectedOutlineSubject}]\n${text.slice(0, 8000)}`;
                })
                .filter(Boolean)
                .join("\n\n");
            }
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

        if (!res.ok) throw new Error("Khởi tạo Agent thất bại");
        const data = await res.json();
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
    [filesOutlines, filesTemplates, selectedKnowledgeSubject, username],
  );

  const confirmReportWorkflow = useCallback(async () => {
    const request = pendingReportRequest;
    if (!request) return;

    const model =
      allModels.find((m) => m.id === (request.modelId || activeModelId)) ||
      allModels[0];
    if (!model) {
      showToast("Không tìm thấy model phù hợp để khởi chạy quy trình.", "error");
      return;
    }

    const requestSubject =
      request.subject ||
      selectedKnowledgeSubject ||
      sessions.find((s) => s.id === (request.sessionId || activeSessionId))?.subject ||
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
      files: (request.files || []).map((f) => ({
        name: f.name,
        url: f.url,
        type: f.type,
        size: f.size,
      })),
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

    setPendingReportRequest(null);
    setSelectedKnowledgeSubject(requestSubject);
    setDraft("");
    setAttachedFiles([]);
    runAgentInit(request.content || "Tạo báo cáo", model.id, sessionId, requestSubject);
  }, [
    pendingReportRequest,
    allModels,
    activeModelId,
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
      const reportTitle = `Báo cáo hoàn chỉnh - ${now.toLocaleDateString("vi-VN")}`;

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
    (chatId) => {
      if (chatId && chatId !== activeSessionId) {
        setActiveSessionId(chatId);
      }
      setSelectedReport(null);
      setSelectedOutline(null);
      setAgentActive(true);
    },
    [activeSessionId],
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

      const runId = state?.sections_progress?.[0]?.reportContext?.runId || state?.outline?.[0]?.reportContext?.runId;
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
            const reportTitle = `Báo cáo hoàn chỉnh - ${date.toLocaleDateString("vi-VN")}`;
            cards.push({
              type: "report_preview",
              title: reportTitle,
              dateLabel,
              report: {
                title: reportTitle,
                content,
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
          setAgentState(data.state);
          showToast("Đã duyệt đề cương! Agent bắt đầu soạn thảo...", "success");
          setTimeout(() => {
            handleDraftNextSection();
          }, 800);
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
      if (!prev || prev.current_step === "COMPLETED" || prev.current_step === "CANCELLED") {
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
      setAgentLoading(true);
      markNextSectionDraftingOptimistically();
      let keepLoading = false;
      try {
        const activeModel =
          allModels.find((m) => m.id === activeModelId) || allModels[0];
        const res = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "draft_next_background",
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
          setAgentState(data.state);
          if (data.queued) {
            keepLoading = true;
            return;
          }
          if (data.state.current_step === "COMPLETED") {
            showToast(
              "AI Agent đã hoàn thành xuất sắc toàn bộ báo cáo!",
              "success",
            );
            setAgentActive(false);
            appendAgentResultCardsMessage(data.state);
          } else {
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
        if (!keepLoading) {
          setAgentLoading(false);
        }
      }
    },
    [
      activeSessionId,
      username,
      activeModelId,
      allModels,
      appendAgentResultCardsMessage,
      markNextSectionDraftingOptimistically,
    ],
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
          }),
        });
        if (!res.ok || stopped || agentCancelRequestedRef.current) return;
        const data = await res.json().catch(() => null);
        if (data?.ok && data.state && !stopped) {
          setAgentState(data.state);
          if (data.state.current_step === "COMPLETED") {
            setAgentLoading(false);
            setAgentActive(false);
            appendAgentResultCardsMessage(data.state);
            showToast(
              "AI Agent đã hoàn thành xuất sắc toàn bộ báo cáo!",
              "success",
            );
          }
        }
      } catch (err) {
        console.warn("Agent status polling failed:", err);
      }
    };

    pollStatus();
    const timer = setInterval(pollStatus, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [
    activeSessionId,
    agentActive,
    agentLoading,
    agentState?.current_step,
    appendAgentResultCardsMessage,
  ]);

  useEffect(() => {
    if (
      !agentActive ||
      !agentLoading ||
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
    agentLoading,
    agentState,
    handleDraftNextSection,
  ]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const model = activeModel;
    const activeAttached = attachedFiles.filter((f) => f.status === "success");
    const userPrompt = draft.trim();
    if (!model || (!userPrompt && activeAttached.length === 0)) return;

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
          files: activeAttached.map((f) => ({
            name: f.name,
            url: f.url,
            type: f.type,
            size: f.size,
          })),
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
        files: activeAttached.map((f) => ({
          name: f.name,
          url: f.url,
          type: f.type,
          size: f.size,
        })),
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
          files: activeAttached.map((f) => ({
            name: f.name,
            url: f.url,
            type: f.type,
            size: f.size,
          })),
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
        files: activeAttached.map((f) => ({
          name: f.name,
          url: f.url,
          type: f.type,
          size: f.size,
        })),
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
      files: activeAttached.map((f) => ({
        name: f.name,
        url: f.url,
        type: f.type,
        size: f.size,
      })),
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
          `/api/knowledge-content?username=${encodeURIComponent(REPORT_OUTLINE_CONTENT_USER)}`,
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
          `/api/knowledge-content?username=${encodeURIComponent(REPORT_TEMPLATE_CONTENT_USER)}`,
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
      effectivePrompt = ASSISTANT_ONLY_FALLBACK_PROMPT;
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
          const imageFiles = m.files.filter((f) =>
            f.type?.startsWith("image/"),
          );
          const nonImageFiles = m.files.filter(
            (f) => !f.type?.startsWith("image/"),
          );

          let finalContent = m.content || "";
          if (nonImageFiles.length > 0) {
            finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
            for (const df of nonImageFiles) {
              finalContent += `\n- [${df.name}](${df.url})`;
            }
            finalContent += "\n------------------------";
          }

          if (imageFiles.length > 0) {
            const parts = [{ type: "text", text: finalContent }];
            for (const img of imageFiles) {
              parts.push({ type: "image_url", image_url: { url: img.url } });
            }
            reqMsgs.push({ role: m.role, content: parts });
          } else {
            reqMsgs.push({ role: m.role, content: finalContent });
          }
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

    if (docFiles.length > 0) {
      currentMsgText += "\n\n--- LINK TÀI LIỆU ĐÍNH KÈM ---";
      for (const df of docFiles) {
        currentMsgText += `\n- [${df.name}](${df.url})`;
      }
      currentMsgText += "\n------------------------------";
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
        const headers = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        let attempts = 0;
        const maxAttempts = 6;
        let delay = 3000; // Start with a 3s delay
        const maxDelayMs = 60000;

        while (attempts < maxAttempts) {
          try {
            const res = await fetch("/api/v1/chat/completions", {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: model.id,
                messages,
                stream: true,
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
                    fullPart += delta;
                    onDelta(delta, fullPart);
                  }
                } catch { }
              }
            }
            return fullPart;
          } catch (err) {
            if (err.name === "AbortError") throw err;
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

      // Detect requested page count in user prompt to dynamically scale report capacity
      const pageMatch = userPrompt.match(/(\d+)\s*(trang|pages?)/i);
      let customWordScale = null;
      if (pageMatch) {
        const requestedPages = parseInt(pageMatch[1], 10);
        if (requestedPages > 7) {
          const totalWords = requestedPages * 350; // average 350 words per page in Times New Roman 13pt 1.5 line spacing
          customWordScale = {
            total: totalWords,
            intro: Math.round(totalWords * 0.1),
            ch1: Math.round(totalWords * 0.22),
            ch2: Math.round(totalWords * 0.34),
            ch3: Math.round(totalWords * 0.17),
            conclusion: Math.round(totalWords * 0.17),
          };
        }
      }

      const stages = [
        {
          name: "LẬP DÀN Ý & BỐ CỤC CHI TIẾT",
          prompt: (userPrompt) => {
            const targets = customWordScale
              ? `Trang bìa & Lời mở đầu ~${customWordScale.intro} từ, Chương 1 ~${customWordScale.ch1} từ, Chương 2 ~${customWordScale.ch2} từ, Chương 3 ~${customWordScale.ch3} từ, Kết luận & Tài liệu tham khảo ~${customWordScale.conclusion} từ`
              : "Trang bìa & Lời mở đầu ~500-600 từ, Chương 1 ~1.100-1.300 từ, Chương 2 ~1.600-2.000 từ, Chương 3 ~900-1.100 từ, Kết luận & Tài liệu tham khảo ~900-1.100 từ";
            const total = customWordScale
              ? `${customWordScale.total} từ`
              : "5.000-6.000 từ";

            return `Dựa trên yêu cầu: "${userPrompt}" cùng các Đề cương (Outlines) và Báo cáo mẫu đã cung cấp, hãy lập một Dàn ý chi tiết cho báo cáo.
Dàn ý BẮT BUỘC phải bám sát cấu trúc trong Đề cương được cung cấp: giữ đúng tên phần/chương/mục, thứ tự, phạm vi nội dung và các bảng biểu/yêu cầu bắt buộc. Báo cáo mẫu chỉ được dùng để tham khảo cách trình bày và hành văn, KHÔNG được dùng để thêm, bỏ, đổi tên, gộp/tách hoặc đảo thứ tự đề mục của đề cương.
Mục tiêu dung lượng bản báo cáo hoàn chỉnh: khoảng ${total} nếu đề cương không quy định ngắn hơn. Phân bổ theo đề cương; nếu đề cương không nêu quota cụ thể thì dùng mặc định: ${targets}. Không viết chi tiết nội dung, chỉ xuất ra dàn ý bằng Markdown. Không viết placeholder kiểu "(Nội dung Chương ... sẽ tiếp nối tại đây...)".`;
          },
        },
        {
          name: "VIẾT TRANG BÌA & LỜI MỞ ĐẦU",
          prompt: (outline) => {
            const introTarget = customWordScale ? customWordScale.intro : 500;
            return `Dựa trên Dàn ý chi tiết sau đây:\n${outline}\n\nĐồng thời tuân thủ văn phong học thuật của các báo cáo mẫu. Hãy viết đủ chi tiết nhưng gọn cho **TRANG BÌA & LỜI MỞ ĐẦU**.
Yêu cầu:
- Không thêm, bỏ, đổi tên hoặc đảo thứ tự các mục so với Dàn ý đã lập từ Đề cương.
- Trang bìa phải tuân thủ đúng định dạng của báo cáo mẫu (Trường học, khoa viện, tên báo cáo, thông tin sinh viên).
- Lời mở đầu dài khoảng ${introTarget} từ, nêu rõ lý do chọn đề tài, mục tiêu, đối tượng, phạm vi, phương pháp nghiên cứu và bố cục báo cáo.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới ${introTarget} từ thì bổ sung chiều sâu học thuật, nếu vượt ${Math.round(introTarget * 1.3)} từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT] vào bài viết, hệ thống sẽ tự động thêm chúng ở ngoài.
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`;
          },
        },
        {
          name: "VIẾT CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN VÀ CƠ CẤU TỔ CHỨC",
          prompt: (prevContent) => {
            const ch1Target = customWordScale ? customWordScale.ch1 : 1100;
            return `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 1**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 1 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Viết giới thiệu tổng quan đơn vị kiến tập, lịch sử hình thành, chức năng nhiệm vụ, vẽ Sơ đồ cơ cấu tổ chức bộ máy và thuyết minh chi tiết sơ đồ đó.
- Độ dài khoảng ${ch1Target} từ. Sử dụng phong cách in đậm cho tiêu đề mục lớn, in nghiêng cho nhận xét/ghi chú bổ trợ khi thật cần thiết.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới ${ch1Target} từ thì phát triển thêm đúng các mục của đề cương, nếu vượt ${Math.round(ch1Target * 1.3)} từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`;
          },
        },
        {
          name: "VIẾT CHƯƠNG 2: THỰC TRẠNG HOẠT ĐỘNG VÀ PHÂN TÍCH SỐ LIỆU",
          prompt: (prevContent) => {
            const ch2Target = customWordScale ? customWordScale.ch2 : 1600;
            return `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 2**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 2 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Lập bảng biểu số liệu chi tiết trong 3 năm gần nhất là 2023, 2024, và 2025. Cấm lấy dữ liệu 2026.
- Sau mỗi bảng biểu BẮT BUỘC có đoạn văn nhận xét đánh giá sự tăng/giảm, phân tích nguyên nhân khoảng 80-120 từ.
- Vẽ sơ đồ Mermaid.js thuyết minh 1 quy trình/hoạt động cốt lõi của đơn vị kiến tập nếu đề cương cần.
- Độ dài khoảng ${ch2Target} từ.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới ${ch2Target} từ thì bổ sung phân tích, bảng biểu và nhận xét theo đúng đề cương, nếu vượt ${Math.round(ch2Target * 1.3)} từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`;
          },
        },
        {
          name: "VIẾT CHƯƠNG 3: ĐÁNH GIÁ CHUNG VÀ BÀI HỌC KINH NGHIỆM",
          prompt: (prevContent) => {
            const ch3Target = customWordScale ? customWordScale.ch3 : 900;
            return `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 3**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 3 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Đánh giá ưu điểm, nhược điểm, nguyên nhân hạn chế của đơn vị kiến tập.
- Đề xuất các giải pháp khả thi và bài học kinh nghiệm thu được sau thời gian kiến tập.
- Độ dài khoảng ${ch3Target} từ.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới ${ch3Target} từ thì phát triển thêm đánh giá, nguyên nhân và bài học theo đúng đề cương, nếu vượt ${Math.round(ch3Target * 1.3)} từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`;
          },
        },
        {
          name: "VIẾT KẾT LUẬN & DANH MỤC TÀI LIỆU THAM KHẢO",
          prompt: (prevContent) => {
            const concTarget = customWordScale
              ? customWordScale.conclusion
              : 900;
            return `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy hoàn thành phần cuối cùng của báo cáo gồm: **KẾT LUẬN & ĐỀ XUẤT** và **DANH MỤC TÀI LIỆU THAM KHẢO**.
Yêu cầu:
- Phần cuối phải bám đúng Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Phần Kết luận tổng hợp đầy đủ đánh giá, bài học kinh nghiệm, định hướng của sinh viên và hiệu quả kiến tập (độ dài khoảng ${concTarget} từ).
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới ${concTarget} từ thì bổ sung tổng hợp và định hướng, nếu vượt ${Math.round(concTarget * 1.3)} từ thì rút gọn.
- Phần Danh mục tài liệu tham khảo: CHỈ liệt kê các liên kết web thực tế lấy từ Tavily Search/Jina Reader hoặc URL do người dùng cung cấp. Tuyệt đối KHÔNG liệt kê link Supabase (đề cương/báo cáo mẫu/knowledge).
- Chèn tag [PAGE_BREAK] ngay trước tiêu đề **DANH MỤC TÀI LIỆU THAM KHẢO** để bắt đầu trang mới.
- Tuyệt đối không chèn bất kỳ dòng trích nguồn nào ở giữa báo cáo.
- Bắt đầu ngay bằng tiêu đề **KẾT LUẬN VÀ ĐỀ XUẤT** hoặc **DANH MỤC TÀI LIỆU THAM KHẢO**; không viết lời chào, lời dẫn, lời xác nhận đã tiếp nhận yêu cầu, hoặc bất kỳ câu tự xưng hệ thống/agent nào.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].`;
          },
        },
      ];

      const conclusionStartMatchers = [
        /^ket luan\b/,
        /^ket luan va de xuat\b/,
        /^phan ket luan\b/,
        /^danh muc tai lieu tham khao\b/,
        /^(\d+\s+)+ket luan\b/,
        /^(\d+\s+)+danh muc\b/,
      ];
      const cleanTags = (s, startMatchers = []) =>
        cleanReportStageContent(s, startMatchers);

      let finalFullContent = "";

      // Step 1: Planning / Outline
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 1/6",
          "ĐANG LẬP DÀN Ý CHI TIẾT CHO BÁO CÁO...",
        ),
      );
      const outlinePrompt = stages[0].prompt(userPrompt);
      const outlineMsgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: outlinePrompt },
      ];
      let outlineResult = "";
      await streamCompletion(
        outlineMsgs,
        (delta, full) => {
          outlineResult = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 1/6",
              "ĐANG LẬP DÀN Ý CHI TIẾT CHO BÁO CÁO...",
              full,
            ),
          );
        },
        OUTLINE_MAX_TOKENS,
      );
      const outlineTitle = getDocTitle(outlineResult, "Dàn ý báo cáo");
      setSelectedOutline({ title: outlineTitle, content: outlineResult });
      setSelectedReport(null);
      const outlineContext = clampTextForContext(
        outlineResult,
        MAX_OUTLINE_CONTEXT_CHARS,
      );

      // Step 2: Trang bìa & Lời mở đầu (Bắt đầu gán START_REPORT trực tiếp từ code)
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 2/6",
          `ĐANG VIẾT TRANG BÌA & LỜI MỞ ĐẦU (Mục tiêu ${customWordScale ? customWordScale.intro : "400-500"} từ)...`,
        ),
      );
      const introPrompt = stages[1].prompt(outlineContext);
      const introMsgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: introPrompt },
      ];
      let introResult = "";
      await streamCompletion(
        introMsgs,
        (delta, full) => {
          introResult = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 2/6",
              `ĐANG VIẾT TRANG BÌA & LỜI MỞ ĐẦU (Mục tiêu ${customWordScale ? customWordScale.intro : "400-500"} từ)...`,
              full,
            ),
          );
        },
        REPORT_MAX_TOKENS,
      );
      const introClean = ensurePageBreakSuffix(
        stripAllPageBreaks(cleanTags(introResult)),
      );
      finalFullContent += "[START_REPORT]\n" + introClean + "\n\n";

      // Step 3: Chương 1
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 3/6",
          `ĐANG VIẾT CHƯƠNG 1 (Mục tiêu ${customWordScale ? customWordScale.ch1 : "900-1.100"} từ)...`,
        ),
      );
      const ch1Context = buildStageContext(outlineResult, finalFullContent);
      const ch1Prompt = stages[2].prompt(ch1Context);
      const ch1Msgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: ch1Prompt },
      ];
      let ch1Result = "";
      await streamCompletion(
        ch1Msgs,
        (delta, full) => {
          ch1Result = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 3/6",
              `ĐANG VIẾT CHƯƠNG 1 (Mục tiêu ${customWordScale ? customWordScale.ch1 : "900-1.100"} từ)...`,
              full,
            ),
          );
        },
        REPORT_MAX_TOKENS,
      );
      const ch1Clean = ensurePageBreakSuffix(
        stripAllPageBreaks(cleanTags(ch1Result)),
      );
      finalFullContent += ch1Clean + "\n\n";

      // Step 4: Chương 2
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 4/6",
          `ĐANG VIẾT CHƯƠNG 2 (Mục tiêu ${customWordScale ? customWordScale.ch2 : "1.300-1.600"} từ)...`,
        ),
      );
      const ch2Context = buildStageContext(outlineResult, finalFullContent);
      const ch2Prompt = stages[3].prompt(ch2Context);
      const ch2Msgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: ch2Prompt },
      ];
      let ch2Result = "";
      await streamCompletion(
        ch2Msgs,
        (delta, full) => {
          ch2Result = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 4/6",
              `ĐANG VIẾT CHƯƠNG 2 (Mục tiêu ${customWordScale ? customWordScale.ch2 : "1.300-1.600"} từ)...`,
              full,
            ),
          );
        },
        REPORT_MAX_TOKENS,
      );
      const ch2Clean = ensurePageBreakSuffix(
        stripAllPageBreaks(cleanTags(ch2Result)),
      );
      finalFullContent += ch2Clean + "\n\n";

      // Step 5: Chương 3
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 5/6",
          `ĐANG VIẾT CHƯƠNG 3 (Mục tiêu ${customWordScale ? customWordScale.ch3 : "700-900"} từ)...`,
        ),
      );
      const ch3Context = buildStageContext(outlineResult, finalFullContent);
      const ch3Prompt = stages[4].prompt(ch3Context);
      const ch3Msgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: ch3Prompt },
      ];
      let ch3Result = "";
      await streamCompletion(
        ch3Msgs,
        (delta, full) => {
          ch3Result = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 5/6",
              `ĐANG VIẾT CHƯƠNG 3 (Mục tiêu ${customWordScale ? customWordScale.ch3 : "700-900"} từ)...`,
              full,
            ),
          );
        },
        REPORT_MAX_TOKENS,
      );
      const ch3Clean = ensurePageBreakSuffix(
        stripAllPageBreaks(cleanTags(ch3Result)),
      );
      finalFullContent += ch3Clean + "\n\n";

      // Step 6: Kết luận & Tài liệu tham khảo
      updateAssistantMsg(
        reportProgressMessage(
          "BƯỚC 6/6",
          "ĐANG HOÀN THIỆN PHẦN KẾT LUẬN & TÀI LIỆU THAM KHẢO...",
        ),
      );
      const concContext = buildStageContext(outlineResult, finalFullContent);
      const concPrompt = stages[5].prompt(concContext);
      const concMsgs = [
        { role: "system", content: effectivePrompt },
        { role: "user", content: concPrompt },
      ];
      let concResult = "";
      await streamCompletion(
        concMsgs,
        (delta, full) => {
          concResult = full;
          updateAssistantMsg(
            reportProgressMessage(
              "BƯỚC 6/6",
              "ĐANG HOÀN THIỆN PHẦN KẾT LUẬN & TÀI LIỆU THAM KHẢO...",
              cleanTags(full, conclusionStartMatchers),
            ),
          );
        },
        REPORT_MAX_TOKENS,
      );
      let concClean = removeTrailingPageBreak(
        stripAllPageBreaks(cleanTags(concResult, conclusionStartMatchers)),
      );
      concClean = stripSupabaseReportLinks(concClean);
      concClean = ensurePageBreakBeforeReferences(concClean);
      finalFullContent += `${concClean}\n[END_REPORT]`;

      const finalOutput =
        `[START_OUTLINE]\n${outlineResult}\n[END_OUTLINE]\n` + finalFullContent;

      const reportMatch = finalOutput.match(
        /\[START_REPORT\]([\s\S]*?)\[END_REPORT\]/,
      );
      const reportContent = reportMatch ? reportMatch[1].trim() : "";
      const reportTitle = getDocTitle(reportContent, "Báo cáo Kiến tập");

      const latencyMs = Date.now() - t0;
      updateAssistantMsg(finalOutput, "done", latencyMs);
      setSelectedReport({ title: reportTitle, content: reportContent });
      setSelectedOutline(null);
    } catch (err) {
      if (err.name !== "AbortError") {
        updateAssistantMsg(`Error: ${textValue(err)}`, "error");
      }
    } finally {
      if (shouldUseReportMode) {
        setAssistantOnlyMode(true);
      }
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

      if (shouldUseReportMode && allOutlines.length > 0) {
        let outlinesContentMap = {};
        try {
          const dbRes = await fetch(
            `/api/knowledge-content?username=${encodeURIComponent(REPORT_OUTLINE_CONTENT_USER)}`,
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
            `/api/knowledge-content?username=${encodeURIComponent(REPORT_TEMPLATE_CONTENT_USER)}`,
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

      let effectivePrompt = systemPrompt.trim() || defaultSystemPrompt;

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

      // Format historical messages up to the target user message
      for (const m of keptMsgs) {
        if (m.role === "user" || (m.role === "assistant" && m.content)) {
          if (m.role === "user" && m.files && m.files.length > 0) {
            const imageFiles = m.files.filter((f) =>
              f.type?.startsWith("image/"),
            );
            const nonImageFiles = m.files.filter(
              (f) => !f.type?.startsWith("image/"),
            );

            let finalContent = m.content || "";
            if (nonImageFiles.length > 0) {
              finalContent += "\n\n--- TÀI LIỆU ĐÍNH KÈM ---";
              for (const df of nonImageFiles) {
                finalContent += `\n- [${df.name}](${df.url})`;
              }
              finalContent += "\n------------------------";
            }

            if (imageFiles.length > 0) {
              const parts = [{ type: "text", text: finalContent }];
              for (const img of imageFiles) {
                parts.push({ type: "image_url", image_url: { url: img.url } });
              }
              reqMsgs.push({ role: m.role, content: parts });
            } else {
              reqMsgs.push({ role: m.role, content: finalContent });
            }
          } else {
            reqMsgs.push({ role: m.role, content: m.content });
          }
        }
      }

      // Format target user message
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
            const multiImageInstruction = `[HƯớNG DẪN ĐỌC NHIỀU ẢNH: Bạn đang nhận được ${imageFiles.length} ảnh. Hãy:
1. ĐỌC toàn bộ nội dung từ tất cả ${imageFiles.length} ảnh trước khi trả lời.
2. Xác định các câu hỏi riêng lẻ: mỗi câu được đánh số (câu 1, câu 2...) hoặc phân tách bằng ký hiệu.
3. Ghep lại các câu bị cắt nửa giữa 2 ảnh: nếu một câu bắt đầu ở ảnh này và tiếp tục sang ảnh khác, hãy ghép chúng lại thành một câu hoàn chỉnh trước khi giải.
4. Sắp xếp đúng thứ tự: theo số câu tăng dần (câu 1, câu 2, câu 3...) bất kể câu nằm ở ảnh nào.
5. Trả lời từng câu đầy đủ, không bỏ sót câu nào.]

`;
            msgText = multiImageInstruction + msgText;
          }
          const parts = [{ type: "text", text: msgText }];
          for (const img of imageFiles) {
            parts.push({ type: "image_url", image_url: { url: img.url } });
          }
          finalUserContent = parts;
        } else {
          finalUserContent = finalContent;
        }
      } else {
        finalUserContent = updatedUserMsg.content;
      }

      if (outlinesTextList.length > 0 || templatesTextList.length > 0) {
        const citationReminder = `\n\n[LƯU Ý QUAN TRỌNG VỀ TRÍCH NGUỒN: Tuyệt đối KHÔNG viết cụm "Tham khảo: nội dung kiến thức..." ở ngoài hay ở đáy các câu trả lời chat thông thường. Thay vào đó, bạn BẮT BUỘC phải gán danh sách nguồn tham khảo tại phần cuối cùng bên trong cặp thẻ [START_REPORT]...[END_REPORT] ở đáy của toàn bộ báo cáo chi tiết, trình bày thành một mục "## DANH MỤC TÀI LIỆU THAM KHẢO" chuyên biệt. Danh mục này CHỈ LIỆT KÊ các liên kết web thực tế thu thập từ Tavily Search/Jina Reader hoặc các URL do người dùng cung cấp trong prompt. TUYỆT ĐỐI không liệt kê link Supabase (đề cương/báo cáo mẫu/knowledge).]`;
        if (typeof finalUserContent === "string") {
          finalUserContent += citationReminder;
        } else if (Array.isArray(finalUserContent)) {
          const textPart = finalUserContent.find((p) => p.type === "text");
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
          const headers = {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          };
          if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

          let attempts = 0;
          const maxAttempts = 6;
          let delay = 3000; // Start with a 3s delay
          const maxDelayMs = 60000;

          while (attempts < maxAttempts) {
            try {
              const res = await fetch("/api/v1/chat/completions", {
                method: "POST",
                headers,
                body: JSON.stringify({
                  model: model.id,
                  messages,
                  stream: true,
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
                      fullPart += delta;
                      onDelta(delta, fullPart);
                    }
                  } catch { }
                }
              }
              return fullPart;
            } catch (err) {
              if (err.name === "AbortError") throw err;
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

        const stages = [
          {
            name: "LẬP DÀN Ý & BỐ CỤC CHI TIẾT",
            prompt: (
              userPrompt,
            ) => `Dựa trên yêu cầu: "${userPrompt}" cùng các Đề cương (Outlines) và Báo cáo mẫu đã cung cấp, hãy lập một Dàn ý chi tiết cho báo cáo.
Dàn ý BẮT BUỘC phải bám sát cấu trúc trong Đề cương được cung cấp: giữ đúng tên phần/chương/mục, thứ tự, phạm vi nội dung và các bảng biểu/yêu cầu bắt buộc. Báo cáo mẫu chỉ được dùng để tham khảo cách trình bày và hành văn, KHÔNG được dùng để thêm, bỏ, đổi tên, gộp/tách hoặc đảo thứ tự đề mục của đề cương.
Mục tiêu dung lượng bản báo cáo hoàn chỉnh: khoảng 5.000-6.000 từ nếu đề cương không quy định ngắn hơn. Phân bổ theo đề cương; nếu đề cương không nêu quota cụ thể thì dùng mặc định: Trang bìa & Lời mở đầu ~500-600 từ, Chương 1 ~1.100-1.300 từ, Chương 2 ~1.600-2.000 từ, Chương 3 ~900-1.100 từ, Kết luận & Tài liệu tham khảo ~900-1.100 từ. Không viết chi tiết nội dung, chỉ xuất ra dàn ý bằng Markdown. Không viết placeholder kiểu "(Nội dung Chương ... sẽ tiếp nối tại đây...)".`,
          },
          {
            name: "VIẾT TRANG BÌA & LỜI MỞ ĐẦU",
            prompt: (
              outline,
            ) => `Dựa trên Dàn ý chi tiết sau đây:\n${outline}\n\nĐồng thời tuân thủ văn phong học thuật của các báo cáo mẫu. Hãy viết đủ chi tiết nhưng gọn cho **TRANG BÌA & LỜI MỞ ĐẦU**.
Yêu cầu:
- Không thêm, bỏ, đổi tên hoặc đảo thứ tự các mục so với Dàn ý đã lập từ Đề cương.
- Trang bìa phải tuân thủ đúng định dạng của báo cáo mẫu (Trường học, khoa viện, tên báo cáo, thông tin sinh viên).
- Lời mở đầu dài khoảng 500-600 từ, nêu rõ lý do chọn đề tài, mục tiêu, đối tượng, phạm vi, phương pháp nghiên cứu và bố cục báo cáo.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới 500 từ thì bổ sung chiều sâu học thuật, nếu vượt 700 từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT] vào bài viết, hệ thống sẽ tự động thêm chúng ở ngoài.
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`,
          },
          {
            name: "VIẾT CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN VÀ CƠ CẤU TỔ CHỨC",
            prompt: (
              prevContent,
            ) => `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 1**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 1 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Viết giới thiệu tổng quan đơn vị kiến tập, lịch sử hình thành, chức năng nhiệm vụ, vẽ Sơ đồ cơ cấu tổ chức bộ máy và thuyết minh chi tiết sơ đồ đó.
- Độ dài khoảng 1.100-1.300 từ. Sử dụng phong cách in đậm cho tiêu đề mục lớn, in nghiêng cho nhận xét/ghi chú bổ trợ khi thật cần thiết.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới 1.100 từ thì phát triển thêm đúng các mục của đề cương, nếu vượt 1.400 từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`,
          },
          {
            name: "VIẾT CHƯƠNG 2: THỰC TRẠNG HOẠT ĐỘNG VÀ PHÂN TÍCH SỐ LIỆU",
            prompt: (
              prevContent,
            ) => `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 2**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 2 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Lập bảng biểu số liệu chi tiết trong 3 năm gần nhất là 2023, 2024, và 2025. Cấm lấy dữ liệu 2026.
- Sau mỗi bảng biểu BẮT BUỘC có đoạn văn nhận xét đánh giá sự tăng/giảm, phân tích nguyên nhân khoảng 80-120 từ.
- Vẽ sơ đồ Mermaid.js thuyết minh 1 quy trình/hoạt động cốt lõi của đơn vị kiến tập nếu đề cương cần.
- Độ dài khoảng 1.600-2.000 từ.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới 1.600 từ thì bổ sung phân tích, bảng biểu và nhận xét theo đúng đề cương, nếu vượt 2.200 từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`,
          },
          {
            name: "VIẾT CHƯƠNG 3: ĐÁNH GIÁ CHUNG VÀ BÀI HỌC KINH NGHIỆM",
            prompt: (
              prevContent,
            ) => `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy tiếp tục viết chi tiết **CHƯƠNG 3**.
Yêu cầu:
- Chỉ viết các mục thuộc CHƯƠNG 3 theo Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Đánh giá ưu điểm, nhược điểm, nguyên nhân hạn chế của đơn vị kiến tập.
- Đề xuất các giải pháp khả thi và bài học kinh nghiệm thu được sau thời gian kiến tập.
- Độ dài khoảng 900-1.100 từ.
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới 900 từ thì phát triển thêm đánh giá, nguyên nhân và bài học theo đúng đề cương, nếu vượt 1.200 từ thì rút gọn.
- Chỉ xuất nội dung thuộc báo cáo, không viết lời chào, lời dẫn của trợ lý, lời giải thích hệ thống hoặc tự xưng agent.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].
- Kết thúc phần này bằng tag [PAGE_BREAK] ở dòng cuối cùng.`,
          },
          {
            name: "VIẾT KẾT LUẬN & DANH MỤC TÀI LIỆU THAM KHẢO",
            prompt: (
              prevContent,
            ) => `Dựa trên dàn ý và nội dung đã viết (trích đoạn gần nhất):\n${prevContent}\n\nHãy hoàn thành phần cuối cùng của báo cáo gồm: **KẾT LUẬN & ĐỀ XUẤT** và **DANH MỤC TÀI LIỆU THAM KHẢO**.
Yêu cầu:
- Phần cuối phải bám đúng Dàn ý/Đề cương; không tự thêm, bỏ, đổi tên hoặc đảo thứ tự mục.
- Phần Kết luận tổng hợp đầy đủ đánh giá, bài học kinh nghiệm, định hướng của sinh viên và hiệu quả kiến tập (độ dài khoảng 900-1.100 từ).
- Phải tự kiểm tra dung lượng trước khi trả lời; nếu dưới 900 từ thì bổ sung tổng hợp và định hướng, nếu vượt 1.200 từ thì rút gọn.
- Phần Danh mục tài liệu tham khảo: CHỈ liệt kê các liên kết web thực tế lấy từ Tavily Search/Jina Reader hoặc URL do người dùng cung cấp. Tuyệt đối KHÔNG liệt kê link Supabase (đề cương/báo cáo mẫu/knowledge).
- Chèn tag [PAGE_BREAK] ngay trước tiêu đề **DANH MỤC TÀI LIỆU THAM KHẢO** để bắt đầu trang mới.
- Tuyệt đối không chèn bất kỳ dòng trích nguồn nào ở giữa báo cáo.
- Bắt đầu ngay bằng tiêu đề **KẾT LUẬN VÀ ĐỀ XUẤT** hoặc **DANH MỤC TÀI LIỆU THAM KHẢO**; không viết lời chào, lời dẫn, lời xác nhận đã tiếp nhận yêu cầu, hoặc bất kỳ câu tự xưng hệ thống/agent nào.
- Tuyệt đối KHÔNG tự ý viết các thẻ [START_REPORT] hay [END_REPORT].`,
          },
        ];

        const conclusionStartMatchers = [
          /^ket luan\b/,
          /^ket luan va de xuat\b/,
          /^phan ket luan\b/,
          /^danh muc tai lieu tham khao\b/,
          /^(\d+\s+)+ket luan\b/,
          /^(\d+\s+)+danh muc\b/,
        ];
        const cleanTags = (s, startMatchers = []) =>
          cleanReportStageContent(s, startMatchers);

        let finalFullContent = "";

        // Step 1: Planning / Outline
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 1/6",
            "ĐANG LẬP DÀN Ý CHI TIẾT CHO BÁO CÁO...",
          ),
        );
        const userPrompt = updatedUserMsg.content;
        const outlinePrompt = stages[0].prompt(userPrompt);
        const outlineMsgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: outlinePrompt },
        ];
        let outlineResult = "";
        await streamCompletion(
          outlineMsgs,
          (delta, full) => {
            outlineResult = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 1/6",
                "ĐANG LẬP DÀN Ý CHI TIẾT CHO BÁO CÁO...",
                full,
              ),
            );
          },
          OUTLINE_MAX_TOKENS,
        );
        const outlineTitle = getDocTitle(outlineResult, "Dàn ý báo cáo");
        setSelectedOutline({ title: outlineTitle, content: outlineResult });
        setSelectedReport(null);
        const outlineContext = clampTextForContext(
          outlineResult,
          MAX_OUTLINE_CONTEXT_CHARS,
        );

        // Step 2: Trang bìa & Lời mở đầu (Bắt đầu gán START_REPORT trực tiếp từ code)
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 2/6",
            "ĐANG VIẾT TRANG BÌA & LỜI MỞ ĐẦU (Mục tiêu 400-500 từ)...",
          ),
        );
        const introPrompt = stages[1].prompt(outlineContext);
        const introMsgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: introPrompt },
        ];
        let introResult = "";
        await streamCompletion(
          introMsgs,
          (delta, full) => {
            introResult = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 2/6",
                "ĐANG VIẾT TRANG BÌA & LỜI MỞ ĐẦU (Mục tiêu 400-500 từ)...",
                full,
              ),
            );
          },
          REPORT_MAX_TOKENS,
        );
        const introClean = ensurePageBreakSuffix(cleanTags(introResult));
        finalFullContent += "[START_REPORT]\n" + introClean + "\n\n";

        // Step 3: Chương 1
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 3/6",
            "ĐANG VIẾT CHƯƠNG 1 (Mục tiêu 900-1.100 từ)...",
          ),
        );
        const ch1Context = buildStageContext(outlineResult, finalFullContent);
        const ch1Prompt = stages[2].prompt(ch1Context);
        const ch1Msgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: ch1Prompt },
        ];
        let ch1Result = "";
        await streamCompletion(
          ch1Msgs,
          (delta, full) => {
            ch1Result = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 3/6",
                "ĐANG VIẾT CHƯƠNG 1 (Mục tiêu 900-1.100 từ)...",
                full,
              ),
            );
          },
          REPORT_MAX_TOKENS,
        );
        const ch1Clean = ensurePageBreakSuffix(cleanTags(ch1Result));
        finalFullContent += ch1Clean + "\n\n";

        // Step 4: Chương 2
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 4/6",
            "ĐANG VIẾT CHƯƠNG 2 (Mục tiêu 1.300-1.600 từ)...",
          ),
        );
        const ch2Context = buildStageContext(outlineResult, finalFullContent);
        const ch2Prompt = stages[3].prompt(ch2Context);
        const ch2Msgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: ch2Prompt },
        ];
        let ch2Result = "";
        await streamCompletion(
          ch2Msgs,
          (delta, full) => {
            ch2Result = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 4/6",
                "ĐANG VIẾT CHƯƠNG 2 (Mục tiêu 1.300-1.600 từ)...",
                full,
              ),
            );
          },
          REPORT_MAX_TOKENS,
        );
        const ch2Clean = ensurePageBreakSuffix(cleanTags(ch2Result));
        finalFullContent += ch2Clean + "\n\n";

        // Step 5: Chương 3
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 5/6",
            "ĐANG VIẾT CHƯƠNG 3 (Mục tiêu 700-900 từ)...",
          ),
        );
        const ch3Context = buildStageContext(outlineResult, finalFullContent);
        const ch3Prompt = stages[4].prompt(ch3Context);
        const ch3Msgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: ch3Prompt },
        ];
        let ch3Result = "";
        await streamCompletion(
          ch3Msgs,
          (delta, full) => {
            ch3Result = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 5/6",
                "ĐANG VIẾT CHƯƠNG 3 (Mục tiêu 700-900 từ)...",
                full,
              ),
            );
          },
          REPORT_MAX_TOKENS,
        );
        const ch3Clean = ensurePageBreakSuffix(cleanTags(ch3Result));
        finalFullContent += ch3Clean + "\n\n";

        // Step 6: Kết luận & Tài liệu tham khảo
        updateAssistantMsg(
          reportProgressMessage(
            "BƯỚC 6/6",
            "ĐANG HOÀN THIỆN PHẦN KẾT LUẬN & TÀI LIỆU THAM KHẢO...",
          ),
        );
        const concContext = buildStageContext(outlineResult, finalFullContent);
        const concPrompt = stages[5].prompt(concContext);
        const concMsgs = [
          { role: "system", content: effectivePrompt },
          { role: "user", content: concPrompt },
        ];
        let concResult = "";
        await streamCompletion(
          concMsgs,
          (delta, full) => {
            concResult = full;
            updateAssistantMsg(
              reportProgressMessage(
                "BƯỚC 6/6",
                "ĐANG HOÀN THIỆN PHẦN KẾT LUẬN & TÀI LIỆU THAM KHẢO...",
                cleanTags(full, conclusionStartMatchers),
              ),
            );
          },
          REPORT_MAX_TOKENS,
        );
        let concClean = removeTrailingPageBreak(
          cleanTags(concResult, conclusionStartMatchers),
        );
        concClean = stripSupabaseReportLinks(concClean);
        concClean = ensurePageBreakBeforeReferences(concClean);
        finalFullContent += `${concClean}\n[END_REPORT]`;

        const finalOutput =
          `[START_OUTLINE]\n${outlineResult}\n[END_OUTLINE]\n` +
          finalFullContent;

        const reportMatch = finalOutput.match(
          /\[START_REPORT\]([\s\S]*?)\[END_REPORT\]/,
        );
        const reportContent = reportMatch ? reportMatch[1].trim() : "";
        const reportTitle = getDocTitle(reportContent, "Báo cáo Kiến tập");

        const latencyMs = Date.now() - t0;
        updateAssistantMsg(finalOutput, "done", latencyMs);
        setSelectedReport({ title: reportTitle, content: reportContent });
        setSelectedOutline(null);
      } catch (err) {
        if (err.name !== "AbortError") {
          updateAssistantMsg(`Error: ${textValue(err)}`, "error");
        }
      } finally {
        if (shouldUseReportMode) {
          setAssistantOnlyMode(true);
        }
        setIsSending(false);
        setStreamingId("");
        abortRef.current = null;
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
                  className="px-4 py-2 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white transition-all text-sm font-semibold shadow-sm"
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

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex min-w-0 min-h-0 relative overflow-hidden">
          {/* Left Side: Chat Panel */}
          <div
            className={cn(
              "flex flex-col min-w-0 min-h-0 h-full border-r border-border-subtle transition-all duration-300",
              activeDoc ? "hidden md:flex md:w-[40%] xl:w-[35%]" : "flex-1",
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
                  onOpenReport={setSelectedReport}
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
            <div className="flex-shrink-0 border-t border-border-subtle bg-surface px-4 py-3">
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

          {/* Right Panel: Preview or Agent view */}
          {activeDoc ? (
            <div
              className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-surface border-l border-border-subtle asst-slide-left relative overflow-hidden"
              style={{
                animation:
                  "asstSlideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
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
                {(() => {
                  const pages = paginateReportContent(
                    prepareReportContent(activeDoc.content || ""),
                  );
                  return (
                    <div className="flex flex-col items-center gap-6 w-full">
                      {pages.map((pageContent, idx) => (
                        <div
                          key={idx}
                          className="relative w-[90%] min-h-[297mm] bg-white dark:bg-bg border border-border/40 rounded-[4px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.22)] overflow-hidden report-view select-text text-text-main"
                          style={{
                            paddingTop: "2.5cm",
                            paddingRight: "2cm",
                            paddingBottom: "3.2cm",
                            paddingLeft: "3cm",
                            animation: "asstFadeIn 0.3s ease both",
                          }}
                        >
                          <div
                            className="w-full h-full overflow-visible"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownAndMath(pageContent),
                            }}
                          />
                          <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-text-subtle select-none font-sans pointer-events-none">
                            Trang {idx + 1} / {pages.length}
                          </div>
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
                className="flex-1 md:max-w-[45%] xl:max-w-[40%] flex flex-col min-w-0 min-h-0 h-full bg-surface/75 dark:bg-bg/75 backdrop-blur-xl border-l border-border/60 asst-slide-left relative overflow-hidden shadow-2xl"
                style={{
                  animation:
                    "asstSlideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
                }}
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
                          disabled={agentLoading && agentCancelRequestedRef.current}
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
                                : ""}
                      </p>
                    </div>
                  </div>

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
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelAgent}
                          disabled={agentLoading && agentCancelRequestedRef.current}
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
                      {(agentState.sections_progress || []).map((sec, idx) => {
                        const isDrafting = sec.status === "drafting";
                        const isDone = sec.status === "done";
                        return (
                          <div
                            key={sec.id}
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
                                  {idx + 1}. {sec.title}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold flex items-center gap-1 uppercase tracking-wider shadow-sm shrink-0",
                                  isDrafting
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
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
                                {sec.status.toUpperCase()}
                              </span>
                            </div>

                            <p className="text-text-muted text-[11px] leading-relaxed font-medium">
                              {sec.description}
                            </p>

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
