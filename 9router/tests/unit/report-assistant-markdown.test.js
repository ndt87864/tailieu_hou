import { describe, expect, it } from "vitest";
import { renderMarkdownAndMath } from "../../src/app/(dashboard)/dashboard/report-assistant/utils/markdownRenderer.js";
import { paginateReportContent } from "../../src/app/(dashboard)/dashboard/report-assistant/utils/reportExporter.js";

describe("report assistant Markdown pagination", () => {
  it("keeps a fenced Mermaid diagram with blank lines on one preview page", () => {
    const content = [
      "#### 1.4.1. Tổ chức bộ máy quản trị của doanh nghiệp",
      "",
      "Để minh họa rõ hơn, dưới đây là sơ đồ cơ cấu tổ chức bộ máy quản trị:",
      "",
      "```mermaid",
      "flowchart TD",
      "    A[Hội đồng Quản trị] --> B[Ban Giám đốc]",
      "    B --> C[Phòng Tư vấn Pháp lý]",
      "    B --> D[Phòng Môi giới & Đấu giá BĐS]",
      "",
      "    C --> C1[Tổ Thẩm định Hồ sơ]",
      "    C --> C2[Tổ Soạn thảo Hợp đồng]",
      "",
      "    D --> D1[Tổ Tìm kiếm Nguồn hàng]",
      "    D --> D2[Tổ Tổ chức Đấu giá]",
      "",
      "    style A fill:#f9f,stroke:#333,stroke-width:2px",
      "    style B fill:#bbf,stroke:#333,stroke-width:2px",
      "```",
      "",
      "*Sơ đồ 1.4.1: Cơ cấu tổ chức bộ máy quản trị*",
      "",
      "Nhìn vào sơ đồ trên, có thể thấy sự phân chia nhiệm vụ rõ ràng.",
      "",
      "| STT | Họ và Tên | Chức Danh |",
      "| --- | --- | --- |",
      "| 1 | Trần Thanh Tùng | Giám đốc |",
      "",
      "#### 1.4.2. Các quy trình quản trị cơ bản",
    ].join("\n");

    const pages = paginateReportContent(content, 180);
    const diagramPage = pages.find((page) => page.includes("```mermaid"));
    const html = pages.map((page) => renderMarkdownAndMath(page)).join("\n");

    expect(diagramPage.match(/```/g)).toHaveLength(2);
    expect(html).toContain('<code class="language-mermaid">');
    expect(html).toContain("<em>Sơ đồ 1.4.1: Cơ cấu tổ chức bộ máy quản trị</em>");
    expect(html).toContain("<table>");
    expect(html).toContain("<h4>1.4.2. Các quy trình quản trị cơ bản</h4>");
    expect(html.indexOf("</code></pre>")).toBeLessThan(html.indexOf("<em>Sơ đồ"));
  });
});
