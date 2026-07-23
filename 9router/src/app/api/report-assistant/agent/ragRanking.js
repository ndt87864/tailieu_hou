export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rankKnowledgeItems(query, items, limit = 2) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const queryWords = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map((word) => new RegExp(escapeRegExp(word), "gi"));

  if (queryWords.length === 0) return [];

  return items
    .map((item) => {
      const text = String(item?.content_text || "");
      const score = queryWords.reduce((total, regex) => {
        const matches = text.match(regex);
        return total + (matches?.length || 0);
      }, 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Cắt đoạn trích RAG phù hợp nhất dựa theo section (Heading / ID / Title / Keywords)
 * Tránh việc luôn lấy 4000 ký tự đầu tiên (Trang bìa, Lời mở đầu, Mục 1.1) của tài liệu mẫu.
 */
export function extractBestKnowledgeExcerpt(contentText, sectionInfo = {}, query = "", maxLen = 4000) {
  const text = String(contentText || "");
  if (!text) return "";
  if (text.length <= maxLen) return text;

  const sectionId = String(sectionInfo?.id || "").trim();
  const cleanTitle = String(sectionInfo?.cleanTitle || sectionInfo?.title || "")
    .replace(/^\d+(\.\d+)*\s*/, "")
    .trim();
  const subsections = Array.isArray(sectionInfo?.subsections) ? sectionInfo.subsections : [];

  const searchPhrases = [];

  if (sectionId) {
    searchPhrases.push(
      new RegExp(`(?:mục|chương|phần)?\\s*${escapeRegExp(sectionId)}(?:\\.|\\s|$)`, "i")
    );
  }

  if (cleanTitle && cleanTitle.length > 3) {
    searchPhrases.push(new RegExp(escapeRegExp(cleanTitle), "i"));
    const words = cleanTitle.split(/\s+/).filter(Boolean);
    if (words.length > 3) {
      const corePhrase = words.slice(0, 4).join(" ");
      searchPhrases.push(new RegExp(escapeRegExp(corePhrase), "i"));
    }
  }

  for (const sub of subsections) {
    const subClean = String(sub || "").replace(/^\d+(\.\d+)*\s*/, "").trim();
    if (subClean.length > 4) {
      searchPhrases.push(new RegExp(escapeRegExp(subClean), "i"));
    }
  }

  let bestIndex = -1;

  for (const regex of searchPhrases) {
    let match;
    const globalRegex = new RegExp(regex.source, "gi");
    while ((match = globalRegex.exec(text)) !== null) {
      const idx = match.index;
      const snippetAfter = text.slice(idx, idx + 120);
      const isTocLine = /\.{3,}|[\.\s]{3,}\d+/i.test(snippetAfter);
      if (idx < 2500 && isTocLine) {
        continue;
      }
      bestIndex = idx;
      break;
    }
    if (bestIndex !== -1) break;
  }

  if (bestIndex !== -1) {
    const startIdx = Math.max(0, bestIndex - 100);
    return text.slice(startIdx, startIdx + maxLen);
  }

  const keywords = Array.from(
    new Set(
      `${query} ${cleanTitle} ${subsections.join(" ")}`
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )
  ).map((w) => new RegExp(escapeRegExp(w), "gi"));

  if (keywords.length > 0) {
    const windowSize = maxLen;
    const step = 800;
    let maxScore = -1;
    let maxWindowStart = 0;

    for (let start = 0; start < text.length; start += step) {
      const windowText = text.slice(start, start + windowSize);
      let windowScore = 0;
      for (const kwRegex of keywords) {
        const matches = windowText.match(kwRegex);
        if (matches) {
          windowScore += matches.length;
        }
      }

      if (start > 1500 && !/TRƯỜNG ĐẠI HỌC|LỜI MỞ ĐẦU|MỤC LỤC/i.test(windowText.slice(0, 300))) {
        windowScore *= 1.25;
      }

      if (windowScore > maxScore) {
        maxScore = windowScore;
        maxWindowStart = start;
      }
    }

    if (maxScore > 0) {
      return text.slice(maxWindowStart, maxWindowStart + maxLen);
    }
  }

  return text.slice(0, maxLen);
}

