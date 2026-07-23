"use client";

import { cn } from "@/shared/utils/cn";
import { renderMarkdownAndMath } from "../utils/markdownRenderer";
import { prepareReportContent } from "../utils/reportFormatter";
import {
  copyReportRichText,
  handlePrintReport,
  paginateReportContent,
} from "../utils/reportExporter";
import { dlDocx } from "../utils/docxGenerator";

export function ReportPreviewPanel({
  previewPanelRef,
  activeDocTitle,
  activeDocType,
  activeDocFileName,
  activeDoc,
  isRenderingPreview,
  showToast,
  closeDoc,
}) {
  return (
    <div
      ref={previewPanelRef}
      className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-surface border-l border-border relative overflow-hidden z-20"
    >
      {/* Preview Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface flex-shrink-0">
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
            className="size-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors cursor-pointer"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-bg text-text-muted hover:text-text-main hover:bg-surface-2 transition-all text-xs font-medium select-none cursor-pointer"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-all shrink-0 select-none shadow-sm cursor-pointer"
            title="Tải xuống định dạng Word (.docx)"
          >
            <span className="material-symbols-outlined text-[15px]">
              download
            </span>
            <span>Tải Word (.docx)</span>
          </button>
          <button
            onClick={closeDoc}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors shrink-0 cursor-pointer"
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
  );
}
