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
