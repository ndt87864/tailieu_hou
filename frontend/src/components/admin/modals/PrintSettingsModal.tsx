// frontend/src/components/admin/modals/PrintSettingsModal.tsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { parseCellAddress, colLetterToNumber, numberToColLetter } from "../../../utils/formulaEvaluator.js";
import { Sheet } from "../../../hooks/useSpreadsheetState.js";

interface PrintSettingsModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  sheets: Sheet[];
  activeSheetIdx: number;
}

export const PrintSettingsModal: React.FC<PrintSettingsModalProps> = ({
  show,
  onClose,
  title,
  sheets,
  activeSheetIdx,
}) => {
  const [printScope, setPrintScope] = useState<"current" | "workbook">("current");
  const [printPaperSize, setPrintPaperSize] = useState<"a4" | "a3" | "letter">("a4");
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [printScale, setPrintScale] = useState<"fit_width" | "fit_page" | "100">("fit_width");
  const [printMargins, setPrintMargins] = useState<"normal" | "narrow" | "wide">("normal");

  if (!show) return null;

  const handleExecuteExportPdf = async () => {
    onClose();
    const toastId = toast.info("Đang tạo tệp PDF...", { autoClose: false });

    setTimeout(async () => {
      try {
        const targetSheets = printScope === "workbook" ? sheets : [sheets[activeSheetIdx] || { name: "Sheet1", cells: {} }];
        const isLandscape = printOrientation === "landscape";
        const paperW = isLandscape ? "1123px" : "794px";
        const paddingPx = printMargins === "narrow" ? "12px" : printMargins === "wide" ? "40px" : "24px";

        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "-9999px";
        container.style.width = paperW;
        container.style.padding = paddingPx;
        container.style.backgroundColor = "#ffffff";
        container.style.fontFamily = "'Segoe UI', Roboto, Arial, sans-serif";
        container.style.boxSizing = "border-box";

        let combinedHtml = "";
        targetSheets.forEach((sh, sIdx) => {
          let maxR = 1;
          let maxCIdx = 0;
          const shCells = sh.cells || {};
          const colWidthsMap = sh.colWidths || {};

          Object.keys(shCells).forEach((addr) => {
            const parsed = parseCellAddress(addr);
            if (parsed) {
              if (parsed.row > maxR) maxR = parsed.row;
              const cIdx = colLetterToNumber(parsed.col);
              if (cIdx > maxCIdx) maxCIdx = cIdx;
            }
          });

          let tableHtml = `<table style="border-collapse: collapse; width: 100%; font-size: 11px; line-height: 1.4; table-layout: auto; margin-bottom: 20px;">`;
          tableHtml += `<thead><tr><th style="border: 1px solid #cbd5e1; padding: 6px; background: #e2e8f0; color: #334155; width: 35px; text-align: center;"></th>`;
          for (let c = 0; c <= maxCIdx; c++) {
            const colLetter = numberToColLetter(c);
            const customW = colWidthsMap[colLetter] ? `min-width: ${Math.max(colWidthsMap[colLetter], 50)}px;` : "min-width: 55px;";
            tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 6px 10px; background: #3b82f6; color: #ffffff; text-align: center; font-weight: 600; white-space: nowrap; ${customW}">${colLetter}</th>`;
          }
          tableHtml += `</tr></thead><tbody>`;

          for (let r = 1; r <= maxR; r++) {
            tableHtml += `<tr><td style="border: 1px solid #cbd5e1; padding: 6px; background: #f1f5f9; color: #475569; text-align: center; font-weight: 600;">${r}</td>`;
            for (let c = 0; c <= maxCIdx; c++) {
              const colLetter = numberToColLetter(c);
              const cell = shCells[`${colLetter}${r}`];
              const val = cell ? cell.value || cell.formula || "" : "";
              const isBold = cell?.bold ? "font-weight: bold;" : "";
              const isItalic = cell?.italic ? "font-style: italic;" : "";
              const align = cell?.align ? `text-align: ${cell.align};` : "";
              const bg = cell?.bg ? `background-color: ${cell.bg};` : "";
              const color = cell?.color ? `color: ${cell.color};` : "";
              const customW = colWidthsMap[colLetter] ? `min-width: ${Math.max(colWidthsMap[colLetter], 50)}px;` : "min-width: 55px;";
              tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; white-space: pre-wrap; word-break: normal; overflow-wrap: normal; vertical-align: middle; ${customW} ${isBold} ${isItalic} ${align} ${bg} ${color}">${val}</td>`;
            }
            tableHtml += `</tr>`;
          }
          tableHtml += `</tbody></table>`;

          combinedHtml += `
            <div style="text-align: center; margin-bottom: 12px; ${sIdx > 0 ? "page-break-before: always; margin-top: 30px;" : ""}">
              <h2 style="margin: 0 0 4px 0; font-size: 20px; color: #0f172a; font-weight: 700;">${title || "Trang tính"}</h2>
              <p style="margin: 0 0 14px 0; font-size: 12px; color: #64748b;">Trang tính: ${sh.name || `Sheet${sIdx + 1}`} | Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}</p>
            </div>
            ${tableHtml}
          `;
        });

        container.innerHTML = combinedHtml;
        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
          scale: 1.25,
          useCORS: true,
          logging: false,
          allowTaint: true
        });

        const containerRect = container.getBoundingClientRect();
        const trElements = Array.from(container.querySelectorAll("tbody tr"));
        const rowBottomsInPx: number[] = trElements.map((tr) => tr.getBoundingClientRect().bottom - containerRect.top);

        document.body.removeChild(container);

        const pdf = new jsPDF({
          orientation: isLandscape ? "landscape" : "portrait",
          unit: "mm",
          format: printPaperSize
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const scaleRatio = pdfWidth / containerRect.width;

        const rowBottomsInMM = rowBottomsInPx.map((px) => px * scaleRatio);
        const totalHeightMM = containerRect.height * scaleRatio;

        let currentY = 0;
        let isFirstPage = true;

        while (currentY < totalHeightMM - 1) {
          if (!isFirstPage) {
            pdf.addPage();
          }
          isFirstPage = false;

          const targetMaxY = currentY + pdfPageHeight;
          let cutY = targetMaxY;

          if (targetMaxY < totalHeightMM) {
            const validBottoms = rowBottomsInMM.filter((b) => b > currentY + 10 && b <= targetMaxY);
            if (validBottoms.length > 0) {
              cutY = Math.max(...validBottoms);
            }
          }

          const sliceHeightMM = cutY - currentY;
          const cropCanvas = document.createElement("canvas");
          const cropYPx = (currentY / totalHeightMM) * canvas.height;
          const cropH = Math.min(((sliceHeightMM) / totalHeightMM) * canvas.height, canvas.height - cropYPx);

          cropCanvas.width = canvas.width;
          cropCanvas.height = Math.max(cropH, 1);
          const ctx = cropCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, cropYPx, canvas.width, cropH, 0, 0, canvas.width, cropH);
          }

          const pageImgData = cropCanvas.toDataURL("image/jpeg", 0.92);
          pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, sliceHeightMM);

          currentY = cutY;
        }

        pdf.save(`${title || "sheet"}.pdf`);
        toast.dismiss(toastId);
        toast.success("Đã xuất tệp PDF thành công!");
      } catch (err: any) {
        console.error(err);
        toast.dismiss(toastId);
        toast.error("Lỗi khi tải tệp PDF: " + err.message);
      }
    }, 10);
  };

  return (
    <div className="sheets-print-modal-overlay" onClick={onClose}>
      <div className="sheets-print-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheets-print-modal-header">
          <div className="sheets-print-modal-header-left">
            <span className="sheets-print-modal-title">Cài đặt in</span>
          </div>
          <div className="sheets-print-modal-header-actions">
            <button className="sheets-print-btn-cancel" onClick={onClose}>HỦY</button>
            <button className="sheets-print-btn-export" onClick={handleExecuteExportPdf}>XUẤT PDF</button>
          </div>
        </div>

        <div className="sheets-print-modal-body">
          <div className="sheets-print-preview-area">
            <div
              className="sheets-print-page-preview"
              style={{ aspectRatio: printOrientation === "landscape" ? "1.414 / 1" : "1 / 1.414" }}
            >
              <div className="sheets-print-page-content">
                <div className="sheets-print-page-title">{title || "Trang tính"}</div>
                <div className="sheets-print-page-sheet">
                  {printScope === "workbook"
                    ? `Toàn bộ sổ tính (${sheets.length} trang)`
                    : (sheets[activeSheetIdx]?.name || "Sheet1")}
                </div>
                <div className="sheets-print-page-table-wrap">
                  <table className="sheets-print-page-table">
                    <tbody>
                      {[1, 2, 3, 4].map((r) => (
                        <tr key={r}>
                          {[0, 1, 2, 3].map((c) => (
                            <td key={c} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="sheets-print-preview-label">
              {printPaperSize.toUpperCase()} • {printOrientation === "landscape" ? "Khổ ngang" : "Khổ dọc"}
            </div>
          </div>

          <div className="sheets-print-settings-panel">
            <div className="sheets-print-section">
              <div className="sheets-print-section-label">In</div>
              <div className="sheets-print-section-group">
                <label className={`sheets-print-radio-row${printScope === "current" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="printScope"
                    checked={printScope === "current"}
                    onChange={() => setPrintScope("current")}
                  />
                  <span>Trang tính hiện tại</span>
                </label>
                <label className={`sheets-print-radio-row${printScope === "workbook" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="printScope"
                    checked={printScope === "workbook"}
                    onChange={() => setPrintScope("workbook")}
                  />
                  <span>Toàn bộ sổ tính</span>
                </label>
              </div>
            </div>

            <div className="sheets-print-divider" />

            <div className="sheets-print-section">
              <div className="sheets-print-section-label">Khổ giấy</div>
              <select
                className="sheets-print-select"
                value={printPaperSize}
                onChange={(e) => setPrintPaperSize(e.target.value as "a4" | "a3" | "letter")}
              >
                <option value="a4">A4</option>
                <option value="a3">A3</option>
                <option value="letter">Letter</option>
              </select>
            </div>

            <div className="sheets-print-divider" />

            <div className="sheets-print-section">
              <div className="sheets-print-section-label">Hướng trang</div>
              <div className="sheets-print-section-group">
                <label className={`sheets-print-radio-row${printOrientation === "landscape" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="printOrientation"
                    checked={printOrientation === "landscape"}
                    onChange={() => setPrintOrientation("landscape")}
                  />
                  <span>Khổ ngang</span>
                </label>
                <label className={`sheets-print-radio-row${printOrientation === "portrait" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="printOrientation"
                    checked={printOrientation === "portrait"}
                    onChange={() => setPrintOrientation("portrait")}
                  />
                  <span>Khổ dọc</span>
                </label>
              </div>
            </div>

            <div className="sheets-print-divider" />

            <div className="sheets-print-section">
              <div className="sheets-print-section-label">Tỷ lệ</div>
              <select
                className="sheets-print-select"
                value={printScale}
                onChange={(e) => setPrintScale(e.target.value as "fit_width" | "fit_page" | "100")}
              >
                <option value="fit_width">Vừa chiều rộng</option>
                <option value="fit_page">Vừa trang</option>
                <option value="100">100%</option>
              </select>
            </div>

            <div className="sheets-print-divider" />

            <div className="sheets-print-section">
              <div className="sheets-print-section-label">Lề</div>
              <select
                className="sheets-print-select"
                value={printMargins}
                onChange={(e) => setPrintMargins(e.target.value as "normal" | "narrow" | "wide")}
              >
                <option value="normal">Thường</option>
                <option value="narrow">Hẹp</option>
                <option value="wide">Rộng</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
