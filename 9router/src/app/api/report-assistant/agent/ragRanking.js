export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rankKnowledgeItems(query, items, limit = 3) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const queryWords = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
    
  const queryRegexes = queryWords.map((word) => new RegExp(escapeRegExp(word), "gi"));

  if (queryRegexes.length === 0) return [];

  return items
    .map((item) => {
      const text = String(item?.content_text || "");
      let score = queryRegexes.reduce((total, regex) => {
        const matches = text.match(regex);
        return total + (matches?.length || 0);
      }, 0);
      
      // Section-aware matching: Boost điểm nếu có chứa từ khóa của query trong định dạng heading
      // Ví dụ: # Chương 1, 1.1. Thực trạng, ### Giải pháp
      if (score > 0) {
        const lines = text.split('\n');
        for (const line of lines) {
           // Nếu dòng là một heading (có chứa # hoặc số mục lục như 1., 1.1., a))
           if (/^(#{1,4}|\d+\.\d*|[a-z]\))\s/.test(line.trim())) {
              const lineLower = line.toLowerCase();
              // Kiểm tra xem heading này có chứa từ khóa nào từ query không
              let matchCount = 0;
              for (const word of queryWords) {
                if (lineLower.includes(word)) {
                   matchCount++;
                }
              }
              // Nếu heading chứa nhiều từ khóa, boost điểm mạnh lên
              if (matchCount > 0) {
                score += matchCount * 5; // Boost mạnh cho mỗi từ khóa xuất hiện trong heading
              }
           }
        }
      }

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
