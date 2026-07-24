"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "../utils/helpers";

export function ChatInputBar({
  searchStatus,
  webSearchEnabled,
  setWebSearchEnabled,
  assistantOnlyMode,
  setAssistantOnlyMode,
  agentState,
  setAgentActive,
  isLunaModel,
  streamEnabled,
  setStreamEnabled,
  thinkingMode,
  setThinkingMode,
  activeModel,
  selectedKnowledgeSubject,
  setSelectedKnowledgeSubject,
  allSubjects,
  attachedFiles,
  removeAttachedFile,
  fileInputRef,
  handleFileChange,
  triggerFileInput,
  textareaRef,
  draft,
  setDraft,
  handleSendMessage,
  isSending,
  handleStopStreaming,
  setSessions,
  activeSessionId,
}) {
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  return (
    <div className="p-3 border-t border-border bg-surface flex flex-col gap-1.5">
      {searchStatus && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-500/10 text-brand-600 rounded-md text-[11px] font-semibold animate-pulse">
          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
          <span>{searchStatus}</span>
        </div>
      )}

      {/* Active Features Status Badges Bar */}
      <div className="flex flex-wrap items-center gap-1 px-1 py-0.5 text-xs">
        {webSearchEnabled && (
          <span
            onClick={() => setWebSearchEnabled(false)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium text-[10px] cursor-pointer hover:bg-blue-500/20 transition-colors"
            title="BẬT: Tìm kiếm & Thu thập Web (Click để tắt)"
          >
            <span className="material-symbols-outlined text-[12px]">language</span>
            <span>Web Fetch: BẬT</span>
            <span className="material-symbols-outlined text-[10px] opacity-70 hover:opacity-100">close</span>
          </span>
        )}

        {!assistantOnlyMode && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-medium text-[10px] cursor-pointer hover:bg-brand-500/20 transition-colors"
            title="BẬT: Chế độ AI tạo báo cáo tự động"
          >
            <span className="material-symbols-outlined text-[12px]">support_agent</span>
            <span onClick={() => { if (agentState) setAgentActive(true); }}>AI tạo báo cáo: BẬT</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setAssistantOnlyMode(true);
                setAgentActive(false);
              }}
              className="material-symbols-outlined text-[10px] opacity-70 hover:opacity-100 p-0.5"
            >
              close
            </span>
          </span>
        )}

        {!isLunaModel && streamEnabled && (
          <span
            onClick={() => setStreamEnabled(false)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium text-[10px] cursor-pointer hover:bg-emerald-500/20 transition-colors"
            title="BẬT: Stream Real-time (Click để tắt)"
          >
            <span className="material-symbols-outlined text-[12px]">stream</span>
            <span>Stream: BẬT</span>
            <span className="material-symbols-outlined text-[10px] opacity-70 hover:opacity-100">close</span>
          </span>
        )}

        {(() => {
          const isLockedQwen38 = String(activeModel?.id || activeModel?.name || "").includes("3.8");
          const currentThinkingMode = isLockedQwen38 ? "thinking" : thinkingMode;
          return (
            <span
              onClick={() => {
                if (isLockedQwen38) return;
                const modes = ["auto", "fast", "thinking"];
                const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                setThinkingMode(modes[nextIdx]);
              }}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors cursor-pointer hover:opacity-80",
                currentThinkingMode === "thinking"
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                  : currentThinkingMode === "fast"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-surface border-border text-text-muted",
                isLockedQwen38 && "cursor-not-allowed opacity-90"
              )}
              title={isLockedQwen38 ? "Thinking Mode: KHÓA TỰ ĐỘNG (Dành cho Qwen 3.8 Max)" : `Thinking Mode: ${currentThinkingMode.toUpperCase()} (Click để đổi)`}
            >
              <span className="material-symbols-outlined text-[12px]">
                {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
              </span>
              <span className="capitalize">Thinking: {currentThinkingMode} {isLockedQwen38 ? "(Khóa)" : ""}</span>
            </span>
          );
        })()}

        {selectedKnowledgeSubject !== "none" && (
          <span
            onClick={() => setSelectedKnowledgeSubject("none")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-medium text-[10px] cursor-pointer hover:bg-purple-500/20 transition-colors"
            title={`Chủ đề báo cáo đang chọn: ${selectedKnowledgeSubject} (Click để bỏ chọn)`}
          >
            <span className="material-symbols-outlined text-[12px]">menu_book</span>
            <span className="max-w-[130px] truncate">{selectedKnowledgeSubject}</span>
            <span className="material-symbols-outlined text-[10px] opacity-70 hover:opacity-100">close</span>
          </span>
        )}
      </div>

      {/* Attached Files Bar */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 py-1.5 border-b border-border bg-bg/50 rounded-lg">
          {attachedFiles.map((file) => {
            const isImg = file.type?.startsWith("image/");
            const isUploading = file.status === "uploading";
            const isError = file.status === "error";

            return (
              <div
                key={file.id}
                className={cn(
                  "relative flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border text-[11px] font-medium bg-surface min-w-[100px] max-w-[180px]",
                  isError
                    ? "border-danger/30 bg-danger/5 text-danger"
                    : "border-border"
                )}
              >
                {isImg && file.url ? (
                  <img
                    src={file.url}
                    alt={file.name || "Tệp hình ảnh"}
                    className="size-5 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="material-symbols-outlined text-[14px] text-text-muted flex-shrink-0">
                    {isImg ? "image" : "description"}
                  </span>
                )}

                <div className="flex-1 min-w-0 leading-tight">
                  <p
                    className="truncate text-[10px] text-text-main"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  {isUploading ? (
                    <p className="text-[8px] text-text-subtle animate-pulse">
                      Uploading...
                    </p>
                  ) : isError ? (
                    <p
                      className="text-[8px] text-danger truncate"
                      title={file.errorMsg}
                    >
                      {file.errorMsg}
                    </p>
                  ) : (
                    <p className="text-[8px] text-text-subtle">
                      {formatBytes(file.size)}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeAttachedFile(file.id)}
                  className="size-4 rounded hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    close
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-end gap-2 bg-bg border border-border rounded-xl px-3 py-1.5">
        {/* Main Combined "+" Menu */}
        <div className="relative mb-0.5">
          <button
            type="button"
            onClick={() => setPlusMenuOpen((prev) => !prev)}
            className={cn(
              "size-7 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 border border-border/60 hover:bg-surface-2",
              plusMenuOpen ? "bg-surface-2 text-brand-500 border-brand-500/40" : "bg-surface text-text-muted hover:text-text-main"
            )}
            title="Mở menu công cụ hỗ trợ (+)"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200" style={{ transform: plusMenuOpen ? "rotate(45deg)" : "none" }}>
              add
            </span>
          </button>

          {plusMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPlusMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-2 z-40 w-60 bg-surface border border-border rounded-xl shadow-xl overflow-hidden py-1 backdrop-blur-md">
                <div className="px-3 py-1 border-b border-border/50 text-[10px] font-semibold text-text-subtle uppercase tracking-wider">
                  Công cụ & Chế độ
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setWebSearchEnabled((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors",
                      webSearchEnabled ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-brand-500">language</span>
                      <span>Tìm kiếm Web</span>
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                      {webSearchEnabled ? "BẬT" : "TẮT"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerFileInput();
                      setPlusMenuOpen(false);
                    }}
                    disabled={isSending || !activeModel}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px] text-brand-500">attach_file</span>
                    <span>Đính kèm tài liệu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssistantOnlyMode((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors",
                      !assistantOnlyMode ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-brand-500">support_agent</span>
                      <span>AI tạo báo cáo</span>
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                      {!assistantOnlyMode ? "BẬT" : "TẮT"}
                    </span>
                  </button>

                  {!isLunaModel && (
                    <button
                      type="button"
                      onClick={() => setStreamEnabled((prev) => !prev)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors",
                        streamEnabled ? "bg-emerald-500/10 text-emerald-600 font-semibold" : "text-text-main hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-emerald-500">{streamEnabled ? "stream" : "pause_circle"}</span>
                        <span>Stream Real-time</span>
                      </div>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                        {streamEnabled ? "BẬT" : "TẮT"}
                      </span>
                    </button>
                  )}

                  {(() => {
                    const isLockedQwen38 = String(activeModel?.id || activeModel?.name || "").includes("3.8");
                    const currentThinkingMode = isLockedQwen38 ? "thinking" : thinkingMode;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (isLockedQwen38) return;
                          const modes = ["auto", "fast", "thinking"];
                          const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                          setThinkingMode(modes[nextIdx]);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs font-medium hover:bg-surface-2 cursor-pointer transition-colors",
                          isLockedQwen38 && "cursor-not-allowed opacity-90"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-purple-500">
                            {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
                          </span>
                          <span>Thinking Mode</span>
                        </div>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 capitalize">
                          {currentThinkingMode} {isLockedQwen38 ? "(Khóa)" : ""}
                        </span>
                      </button>
                    );
                  })()}

                  {allSubjects.length > 0 && (
                    <div className="pt-1 border-t border-border/50">
                      <div className="px-2.5 py-0.5 text-[10px] font-semibold text-text-subtle uppercase tracking-wider">
                        Chủ đề Báo cáo
                      </div>
                      <div className="max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                        <button
                          onClick={() => {
                            setSelectedKnowledgeSubject("none");
                            if (activeSessionId) {
                              setSessions((prev) =>
                                prev.map((s) =>
                                  s.id === activeSessionId
                                    ? { ...s, subject: "none", updatedAt: new Date().toISOString() }
                                    : s
                                )
                              );
                            }
                            setPlusMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] transition-colors",
                            selectedKnowledgeSubject === "none" ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                          )}
                        >
                          <span className="material-symbols-outlined text-[14px] text-text-subtle">layers_clear</span>
                          <span>-- Không chọn --</span>
                        </button>

                        {allSubjects.map((s) => {
                          const active = s === selectedKnowledgeSubject;
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                setSelectedKnowledgeSubject(s);
                                if (activeSessionId) {
                                  setSessions((prev) =>
                                    prev.map((sItem) =>
                                      sItem.id === activeSessionId
                                        ? { ...sItem, subject: s, updatedAt: new Date().toISOString() }
                                        : sItem
                                    )
                                  );
                                }
                                setPlusMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] transition-colors",
                                active ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                              )}
                            >
                              <span className="material-symbols-outlined text-[14px] text-brand-500">library_books</span>
                              <span className="truncate">{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (draft.trim() || attachedFiles.length > 0) {
                handleSendMessage();
              }
            }
          }}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-transparent border-0 outline-none text-xs resize-none text-text-main placeholder:text-text-subtle py-1 max-h-36 overflow-y-auto"
        />
        {isSending ? (
          <button
            type="button"
            onClick={handleStopStreaming}
            className="flex-shrink-0 size-7 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-danger border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors mb-0.5 cursor-pointer"
            title="Dừng phản hồi"
          >
            <span className="material-symbols-outlined text-[16px]">stop</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!draft.trim() && attachedFiles.length === 0}
            className={cn(
              "flex-shrink-0 size-7 rounded-lg flex items-center justify-center transition-all mb-0.5",
              (draft.trim() || attachedFiles.length > 0)
                ? "bg-brand-500 hover:bg-brand-600 text-white shadow-2xs active:scale-95 cursor-pointer"
                : "bg-surface-2 text-text-muted cursor-not-allowed opacity-50"
            )}
            title="Gửi tin nhắn"
          >
            <span className="material-symbols-outlined text-[15px] rotate-[-30px]">send</span>
          </button>
        )}
      </div>
    </div>
  );
}
