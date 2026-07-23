"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";

function SmoothStreamText({ text, isDone = false, className = "" }) {
  const [displayedText, setDisplayedText] = useState(text || "");
  const targetTextRef = useRef(text || "");

  useEffect(() => {
    targetTextRef.current = text || "";
    if (isDone) {
      setDisplayedText(text || "");
      return;
    }

    const target = text || "";
    setDisplayedText((prev) => {
      if (!prev) return target.slice(0, Math.min(target.length, 30));
      return prev;
    });

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        const currentTarget = targetTextRef.current || "";
        if (prev.length >= currentTarget.length) return currentTarget;
        const diff = currentTarget.length - prev.length;
        const step = Math.max(2, Math.ceil(diff / 3));
        return currentTarget.slice(0, prev.length + step);
      });
    }, 16);

    return () => clearInterval(interval);
  }, [isDone, text]);

  const cleanText = (displayedText || "").replace(/^#+\s*.*(\r?\n|$)/, "").trim();

  return (
    <div className={className}>
      {cleanText}
      {!isDone && <span className="inline-block w-1.5 h-3.5 bg-amber-500 ml-1 animate-pulse" />}
    </div>
  );
}

export function AgentProgressPanel({
  agentState,
  agentLoading,
  cancelAgentWorkflow,
  setAgentActive,
  confirmOutlineAndStartDrafting,
  openAgentProgressPreview,
  showToast,
  reloadSection,
}) {
  const [reloadModal, setReloadModal] = useState({
    isOpen: false,
    sectionId: null,
    sectionTitle: "",
  });

  if (!agentState) return null;

  return (
    <div className="w-[714px] border-l border-border bg-surface flex flex-col h-full shrink-0 shadow-lg z-20 transition-all">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {(() => {
            const isCompleted = agentState?.current_step === "COMPLETED";
            const isCancelled = agentState?.current_step === "CANCELLED";
            const isRunning = agentState?.current_step === "OUTLINING" || agentState?.current_step === "DRAFTING";
            return (
              <div
                className={cn(
                  "size-9 rounded-xl flex items-center justify-center font-bold shrink-0",
                  isCompleted
                    ? "bg-emerald-500/10 text-emerald-500"
                    : isCancelled
                    ? "bg-red-500/10 text-red-500"
                    : "bg-brand-500/10 text-brand-500"
                )}
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[22px]",
                    isRunning && "animate-spin"
                  )}
                >
                  {isCompleted ? "check_circle" : isCancelled ? "cancel" : "sync"}
                </span>
              </div>
            );
          })()}
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-brand-600 dark:text-brand-400 truncate">
              AI Agent - Báo cáo tự động
            </h3>
            <p className="text-[11px] text-text-subtle truncate">
              Quy trình RAG tự động đa bước
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(agentState.current_step === "OUTLINING" || agentState.current_step === "DRAFTING") && (
            <button
              onClick={cancelAgentWorkflow}
              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Dừng khẩn cấp quy trình AI Agent"
            >
              <span className="material-symbols-outlined text-[15px]">stop_circle</span>
              <span>HỦY</span>
            </button>
          )}

          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">
            {agentState.current_step || "DRAFTING"}
          </span>

          <button
            onClick={() => setAgentActive(false)}
            className="size-7 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng bảng Agent"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Banner Status */}
      <div className="p-4 border-b border-border/50 bg-amber-500/5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
          <span className="material-symbols-outlined text-[18px]">
            {agentState.current_step === "WAIT_APPROVAL" || agentState.current_step === "OUTLINING"
              ? "fact_check"
              : agentState.current_step === "COMPLETED"
              ? "check_circle"
              : "sync"}
          </span>
          <span>
            {agentState.current_step === "OUTLINING"
              ? "Agent đang phân tích tài liệu và lập dàn ý..."
              : agentState.current_step === "WAIT_APPROVAL"
              ? "Đã tạo xong dàn ý báo cáo! Vui lòng xác nhận để bắt đầu viết."
              : agentState.current_step === "DRAFTING"
              ? "Agent đang tự động viết từng chương mục..."
              : agentState.current_step === "COMPLETED"
              ? "Đã hoàn thành toàn bộ báo cáo!"
              : "Agent đang thực thi quy trình..."}
          </span>
        </div>
        <p className="text-[11px] text-text-subtle leading-relaxed">
          {agentState.current_step === "OUTLINING"
            ? "Vui lòng chờ trong giây lát. Hệ thống đang trích xuất tri thức và phân tích đề cương mẫu..."
            : agentState.current_step === "WAIT_APPROVAL"
            ? "Kiểm tra danh sách các mục bên dưới và bấm nút Xác nhận dàn ý để kích hoạt quá trình tự động soạn thảo từng chương mục."
            : "Hệ thống đang chạy tuần tự từng chương mục độc lập theo đề cương. Trạng thái mỗi mục sẽ liên tục cập nhật bên dưới."}
        </p>

        {((agentState.current_step === "WAIT_APPROVAL" || agentState.current_step === "OUTLINING") && 
          ((Array.isArray(agentState.outline) && agentState.outline.length > 0) || 
           (Array.isArray(agentState.sections_progress) && agentState.sections_progress.length > 0 && agentState.sections_progress[0].id !== "planning"))) && (
          <button
            onClick={() => confirmOutlineAndStartDrafting()}
            disabled={agentLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>XÁC NHẬN DÀN Ý & BẮT ĐẦU TẠO BÁO CÁO</span>
          </button>
        )}

        {agentState.current_step === "COMPLETED" && (
          <button
            onClick={() => {
              openAgentProgressPreview(agentState, "Báo cáo hoàn chỉnh", "agent");
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span>XEM PREVIEW BÁO CÁO HOÀN CHỈNH</span>
          </button>
        )}
      </div>

      {/* Sections Progress List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <div className="flex items-center justify-between text-xs font-extrabold text-text-subtle uppercase tracking-wider">
          <span>TIẾN ĐỘ CÁC CHƯƠNG MỤC ({agentState.sections_progress?.length || 0})</span>
          <div className="flex items-center gap-2">
            <span>
              {agentState.sections_progress?.filter((s) => s.status === "done").length || 0}/
              {agentState.sections_progress?.length || 0} Hoàn thành
            </span>
            {agentState.sections_progress?.some((s) => s.status === "done" && s.content) && (
              <button
                onClick={() => {
                  const completedText = (agentState.sections_progress || [])
                    .filter((s) => s.status === "done" && s.content)
                    .map((s) => `## ${s.title}\n\n${s.content}`)
                    .join("\n\n");
                  navigator.clipboard.writeText(completedText);
                  showToast("Đã sao chép toàn bộ nội dung hoàn thành!", "success");
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                title="Sao chép toàn bộ các chương đã hoàn thành"
              >
                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                <span>Copy All</span>
              </button>
            )}
          </div>
        </div>

        {(agentState.sections_progress || []).map((sec, idx) => {
          const isDone = sec.status === "done";
          const isStreamDrafting = sec.status === "stream_drafting";
          const isDrafting = sec.status === "drafting" || sec.status === "in_progress" || isStreamDrafting;

          return (
            <div
              key={sec.id || idx}
              className={cn(
                "p-3.5 rounded-2xl border transition-all text-xs space-y-2",
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : isStreamDrafting
                  ? "bg-purple-500/5 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-500/20"
                  : isDrafting
                  ? "bg-brand-500/5 border-brand-500/40 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-brand-500/20"
                  : "bg-bg/60 border-border text-text-main"
              )}
            >
              <div className="flex items-start justify-between gap-2 font-bold">
                <span className="leading-snug">
                  {sec.id && !/^\d+/.test(sec.title?.trim() || "") && !sec.title?.startsWith(sec.id)
                    ? `${sec.id}. ${sec.title}`
                    : sec.title}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {typeof reloadSection === "function" && !isDrafting && (
                    <button
                      onClick={() => {
                        setReloadModal({
                          isOpen: true,
                          sectionId: sec.id,
                          sectionTitle: sec.title || sec.id,
                        });
                      }}
                      disabled={agentLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-extrabold border border-brand-500/25 transition-all cursor-pointer text-[11px] disabled:opacity-50 shadow-2xs active:scale-95"
                      title="Tách riêng mục này để AI tạo lại mà không ảnh hưởng các mục khác"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      <span>Soạn lại</span>
                    </button>
                  )}
                  <span
                    className={cn(
                      "text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                      isDone
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                        : isDrafting
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-600 animate-pulse"
                        : "bg-surface border-border text-text-subtle"
                    )}
                  >
                    {isDone ? "Hoàn thành" : isDrafting ? "DRAFTING" : "TODO"}
                  </span>
                </div>
              </div>

              {sec.description && (
                <p className="text-[11px] text-text-subtle leading-relaxed">{sec.description}</p>
              )}

              {/* Subsections list */}
              {Array.isArray(sec.subsections) && sec.subsections.length > 0 && (
                <div className="pt-1 space-y-1 border-t border-border/40">
                  <div className="text-[10px] font-bold text-text-subtle uppercase">Mục con:</div>
                  {sec.subsections.map((sub, sIdx) => (
                    <div key={sIdx} className="text-[11px] text-text-muted flex items-start gap-1 pl-1">
                      <span className="text-brand-500">•</span>
                      <span>{sub}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Content Preview Snippet */}
              {isDone && sec.content && (
                <div className="pt-2 border-t border-emerald-500/20 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      <span>Nội dung đã hoàn thành:</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sec.content);
                        showToast("Đã sao chép nội dung chương mục này!", "success");
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer font-bold border border-emerald-500/20 bg-emerald-500/5 text-[11px]"
                      title="Sao chép chương mục này"
                    >
                      <span className="material-symbols-outlined text-[13px]">content_copy</span>
                      <span>Sao chép</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-text-main/90 max-h-48 overflow-y-auto custom-scrollbar bg-emerald-500/5 p-2 rounded-xl leading-relaxed whitespace-pre-wrap font-sans border border-emerald-500/10">
                    {sec.content.replace(/^#+\s*.*(\r?\n|$)/, "").trim()}
                  </div>
                </div>
              )}

              {/* Active Drafting Live Progress Box */}
              {isDrafting && (
                <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    <span>{agentState.current_activity?.message || "Agent đang phân tích & soạn thảo nội dung..."}</span>
                  </div>
                  {sec.content ? (
                    <SmoothStreamText
                      text={sec.content}
                      isDone={false}
                      className="text-[11px] text-text-main/90 max-h-48 overflow-y-auto custom-scrollbar bg-amber-500/5 p-2 rounded-xl leading-relaxed whitespace-pre-wrap font-sans border border-amber-500/10 relative"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-600/80 dark:text-amber-400/80 italic">
                      <span className="material-symbols-outlined text-[14px] animate-bounce">edit_note</span>
                      <span>Đang đọc tài liệu RAG & tổng hợp nội dung...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modern Custom UI Confirmation Modal */}
      {reloadModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/20">
                <span className="material-symbols-outlined text-[22px]">refresh</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-text-main">
                  Xác nhận soạn lại mục báo cáo
                </h3>
                <p className="mt-1 text-xs text-text-subtle leading-relaxed">
                  Bạn có chắc chắn muốn tách riêng mục{" "}
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    "{reloadModal.sectionTitle}"
                  </span>{" "}
                  để AI tạo lại không?
                </p>
                <div className="mt-3 p-2.5 rounded-xl bg-surface-2 border border-border/60 text-[11px] text-text-muted leading-relaxed flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">
                    check_circle
                  </span>
                  <span>Nội dung của toàn bộ các mục khác đã hoàn thành sẽ được giữ nguyên 100%.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setReloadModal({ isOpen: false, sectionId: null, sectionTitle: "" })}
                className="px-4 py-2 rounded-xl border border-border bg-bg hover:bg-surface-2 text-text-muted hover:text-text-main text-xs font-bold transition-all cursor-pointer select-none"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const secId = reloadModal.sectionId;
                  setReloadModal({ isOpen: false, sectionId: null, sectionTitle: "" });
                  if (secId && typeof reloadSection === "function") {
                    reloadSection(secId);
                  }
                }}
                disabled={agentLoading}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-98 text-white text-xs font-bold transition-all shadow-md cursor-pointer select-none flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Xác nhận soạn lại</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
