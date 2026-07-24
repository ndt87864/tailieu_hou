import { describe, expect, it } from "vitest";
import { tableRowsToOoxml } from "../../src/app/(dashboard)/dashboard/report-assistant/utils/ooxmlConverter.js";

describe("report assistant DOCX tables", () => {
  it("shades only the header row of a regular table", () => {
    const xml = tableRowsToOoxml([
      ["Tiêu chí phân loại", "Số lượng (Người)", "Tỷ lệ (%)"],
      ["Đại học", "22", "62,9%"],
      ["Cao đẳng/Trung cấp", "8", "22,8%"],
    ]);
    const tableRows = xml.split("<w:tr>").slice(1);

    expect(tableRows[0]).toContain('w:fill="F2F2F2"');
    expect(tableRows[1]).not.toContain('w:fill="F2F2F2"');
    expect(tableRows[2]).not.toContain('w:fill="F2F2F2"');
  });

  it("does not shade the first row of a borderless signature table", () => {
    const xml = tableRowsToOoxml([
      ["Cán bộ hướng dẫn", "Xác nhận của đơn vị kiến tập"],
      ["Kí tên và ghi rõ họ tên", "Kí tên, đóng dấu và ghi rõ họ tên"],
    ]);

    expect(xml).not.toContain('w:fill="F2F2F2"');
  });
});
