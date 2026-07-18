import { describe, expect, it } from "vitest";
import {
  escapeRegExp,
  rankKnowledgeItems,
} from "../../src/app/api/report-assistant/agent/ragRanking.js";

describe("report assistant RAG ranking", () => {
  it("ranks normal keyword matches by occurrence count", () => {
    const ranked = rankKnowledgeItems("doanh thu", [
      { filename: "a", content_text: "Doanh thu tăng. Doanh thu ổn định." },
      { filename: "b", content_text: "Doanh thu giảm." },
    ]);

    expect(ranked.map(({ item, score }) => [item.filename, score])).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
  });

  it("treats RegExp metacharacters as literal query text", () => {
    const ranked = rankKnowledgeItems("C++ [2025] (HOSE)", [
      { filename: "market", content_text: "C++ [2025] (HOSE) C++" },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(4);
    expect(escapeRegExp("C++ [2025] (HOSE)")).toBe("C\\+\\+ \\[2025\\] \\(HOSE\\)");
  });

  it("matches Vietnamese Unicode text case-insensitively", () => {
    const ranked = rankKnowledgeItems("TÀI CHÍNH", [
      { filename: "vi", content_text: "Phân tích tài chính và TÀI CHÍNH doanh nghiệp" },
    ]);

    expect(ranked[0].score).toBe(4);
  });

  it("returns no results when keywords do not match", () => {
    expect(rankKnowledgeItems("không khớp", [
      { filename: "a", content_text: "doanh thu lợi nhuận" },
    ])).toEqual([]);
  });

  it("handles empty query, empty items, and empty content", () => {
    expect(rankKnowledgeItems("", [{ content_text: "anything" }])).toEqual([]);
    expect(rankKnowledgeItems("keyword", [])).toEqual([]);
    expect(rankKnowledgeItems("keyword", [{ content_text: "" }, {}])).toEqual([]);
  });
});
