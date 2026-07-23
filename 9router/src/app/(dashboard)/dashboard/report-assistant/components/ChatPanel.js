"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { renderMarkdownAndMath } from "../utils/markdownRenderer";
import { buildContentWithAttachments } from "../utils/attachmentExtractor";
import { formatBytes, createId } from "../utils/helpers";
import {
  AssistantAvatar,
  UserAvatar,
  TypingDots,
  MessageFilesGrid,
} from "./ChatBubble";

export function ChatPanel({
  activeDoc,
  agentActive,
  agentState,
  activeSession,
  activeSessionId,
  setSessions,
  allModels,
  activeModel,
  setSelectedModelId,
  setModelDropdownOpen,
  modelDropdownOpen,
  usernameLoaded,
  username,
  getSK,
  setSettingsOpen,
  draft,
  setDraft,
  attachedFiles,
  setAttachedFiles,
  isSending,
  streamingId,
  searchStatus,
  webSearchEnabled,
  setWebSearchEnabled,
  assistantOnlyMode,
  setAssistantOnlyMode,
  setAgentActive,
  streamEnabled,
  setStreamEnabled,
  thinkingMode,
  setThinkingMode,
  selectedKnowledgeSubject,
  setSelectedKnowledgeSubject,
  allSubjects,
  removeAttachedFile,
  handleFileChange,
  triggerFileInput,
  fileInputRef,
  textareaRef,
  handleSendMessage,
  handleStopStreaming,
  handleRegenerateMessage,
  showToast,
  copiedMessageId,
  setCopiedMessageId,
  confirmOutlineAndStartDrafting,
  setSelectedReport,
  setSelectedOutline,
  openAgentProgressPreview,
  loadAgentStatus,
}) {
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [draft, textareaRef]);

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 min-h-0 h-full bg-bg relative transition-all duration-300",
        activeDoc
          ? "hidden md:flex md:w-[50%] xl:w-[45%] border-r border-border"
          : agentActive && agentState
          ? "hidden md:flex flex-1"
          : "flex-1"
      )}
    >
      {/* Top Header */}
      <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-text-main">Trợ lý học tập</h1>
          {/* Custom Model Selector */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-bg hover:bg-surface-2 transition-all text-xs font-semibold text-text-main cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-brand-500">
                smart_toy
              </span>
              <span>{activeModel?.id?.split("/").pop() || "Chọn mô hình"}</span>
              <span className="material-symbols-outlined text-[16px] text-text-subtle">
                expand_more
              </span>
            </button>

            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
                <div className="absolute left-0 mt-1.5 z-40 w-64 bg-surface border border-border rounded-xl shadow-lg overflow-hidden py-1">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {allModels.map((m) => {
                      const active = m.id === activeModel?.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModelId(m.id);
                            if (usernameLoaded) {
                              const uSK = getSK(username);
                              try {
                                localStorage.setItem(uSK.activeModel, m.id);
                              } catch {}
                            }
                            if (activeSessionId) {
                              setSessions((prev) =>
                                prev.map((s) =>
                                  s.id === activeSessionId
                                    ? {
                                        ...s,
                                        modelId: m.id,
                                        updatedAt: new Date().toISOString(),
                                      }
                                    : s
                                )
                              );
                            }
                            setModelDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                            active
                              ? "bg-brand-500/10 text-brand-600 font-semibold"
                              : "text-text-main hover:bg-surface-2"
                          )}
                        >
                          <span className="material-symbols-outlined text-[15px] text-brand-500">
                            psychology
                          </span>
                          <span className="truncate">{m.id.split("/").pop()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
          Cấu hình
        </Button>
      </div>

      {/* Message Panel */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col">
        {!activeSession?.messages || activeSession.messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-xl mx-auto my-auto space-y-4 select-none">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-2">
              <span className="material-symbols-outlined text-[36px]">
                auto_awesome
              </span>
            </div>
            <h3 className="text-lg font-bold text-text-main">Trợ lý Soạn thảo Báo cáo Học tập</h3>
            <p className="text-xs text-text-subtle leading-relaxed">
              Chào mừng bạn! Tôi có thể giúp bạn tạo báo cáo, soạn thảo đề cương học tập, và phân tích tài liệu một cách thông minh. Hãy bắt đầu bằng cách nhập một tin nhắn hoặc chọn một tài liệu mẫu bên dưới.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <button
                onClick={() => setDraft("Lập đề cương báo cáo chi tiết về đề tài chuyển đổi số trong giáo dục đại học.")}
                className="p-3 text-left border border-border rounded-xl bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
              >
                <div className="font-semibold text-text-main flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-brand-500">edit_note</span>
                  Lập đề cương báo cáo
                </div>
                <div className="text-[10px] text-text-subtle truncate">Chuyển đổi số giáo dục...</div>
              </button>
              <button
                onClick={() => setDraft("Viết một báo cáo phân tích về tiềm năng ứng dụng AI trong học tập.")}
                className="p-3 text-left border border-border rounded-xl bg-surface hover:bg-surface-2 transition-all hover:border-brand-500/30 text-xs cursor-pointer group"
              >
                <div className="font-semibold text-text-main flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-brand-500">school</span>
                  AI trong học tập
                </div>
                <div className="text-[10px] text-text-subtle truncate">Phân tích ứng dụng AI...</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const rawMsgs = activeSession?.messages || [];
              const currentRunId = agentState?.session_id || agentState?.run_id || agentState?.sections_progress?.[0]?.reportContext?.runId || "";
              
              const seenReportCardKeys = new Set();
              const cleanedRawMsgs = rawMsgs.filter((m) => {
                if (m.isReportCard || m.content === "Báo cáo hoàn chỉnh") {
                  const key = m.sessionId ? `session_${m.sessionId}` : "legacy_report_card";
                  if (seenReportCardKeys.has(key)) return false;
                  seenReportCardKeys.add(key);
                }
                return true;
              });

              const hasReportCardForCurrentRun = currentRunId 
                ? cleanedRawMsgs.some((m) => (m.isReportCard || m.content === "Báo cáo hoàn chỉnh") && (m.sessionId === currentRunId || m.id.includes(currentRunId)))
                : cleanedRawMsgs.some((m) => m.isReportCard || m.content === "Báo cáo hoàn chỉnh");

              const finalMsgs = [...cleanedRawMsgs];
              if (agentState?.current_step === "COMPLETED" && !hasReportCardForCurrentRun) {
                finalMsgs.push({
                  id: `virtual-completed-report-card-${currentRunId || "v1"}`,
                  role: "assistant",
                  isReportCard: true,
                  sessionId: currentRunId || "v1",
                  content: "Báo cáo hoàn chỉnh",
                  createdAt: new Date().toISOString(),
                });
              }
              return finalMsgs.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-4 max-w-3xl group relative",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {msg.role === "user" ? <UserAvatar /> : <AssistantAvatar />}
                  <div className="relative">
                    {msg.isOutlineCard ? (
                      <div className="flex items-center justify-between gap-6 px-4 py-3 bg-surface border border-border/80 rounded-2xl shadow-sm hover:shadow transition-all min-w-[320px]">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                            {msg.outlineStatus === "generating" && agentState?.current_step !== "WAIT_APPROVAL" ? (
                              <span className="material-symbols-outlined text-[20px] animate-spin text-amber-500">sync</span>
                            ) : msg.outlineStatus === "error" ? (
                              <span className="material-symbols-outlined text-[20px] text-rose-500">error</span>
                            ) : (
                              <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-main leading-tight">
                              Dàn ý báo cáo
                            </div>
                            <div className="text-[10px] text-text-subtle mt-0.5">
                              {msg.outlineStatus === "generating" && agentState?.current_step !== "WAIT_APPROVAL" ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Đang lập dàn ý...</span>
                              ) : msg.outlineStatus === "error" ? (
                                <span className="text-rose-500 font-medium">{msg.errorText || "Tạo dàn ý thất bại"}</span>
                              ) : (
                                msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(msg.outlineStatus === "ready" || !msg.outlineStatus) && agentState?.current_step === "WAIT_APPROVAL" && (
                            <button
                              onClick={() => confirmOutlineAndStartDrafting()}
                              className="px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              Xác nhận dàn ý
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedReport(null);
                              setAgentActive(true);
                              if (activeSessionId) {
                                loadAgentStatus(activeSessionId, true);
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 transition-all cursor-pointer shadow-2xs"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    ) : msg.isReportCard ? (
                      <div className="flex items-center justify-between gap-6 px-4 py-3 bg-surface border border-brand-500/30 rounded-2xl shadow-sm hover:shadow transition-all min-w-[320px]">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined text-[20px]">description</span>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-text-main leading-tight">
                              Báo cáo hoàn chỉnh
                            </div>
                            <div className="text-[10px] text-text-subtle mt-0.5">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedOutline(null);
                            openAgentProgressPreview(agentState, "Báo cáo hoàn chỉnh", "card");
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Xem báo cáo</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "p-4 rounded-2xl border text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-brand-500 border-brand-500 text-white"
                            : "bg-surface border-border text-text-main"
                        )}
                      >
                        {msg.role === "assistant" && !msg.content && msg.status === "streaming" ? (
                          <div className="flex items-center gap-2 text-text-subtle py-0.5">
                            <span className="material-symbols-outlined text-[16px] animate-spin text-brand-500">progress_activity</span>
                            <span className="text-xs font-medium italic">Đang suy nghĩ & tạo phản hồi...</span>
                          </div>
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownAndMath(msg.content || ""),
                            }}
                          />
                        )}
                        <MessageFilesGrid files={msg.files || []} />
                      </div>
                    )}

                    {/* Hover actions */}
                    {!msg.isOutlineCard && !msg.isReportCard && (
                      <div
                        className={cn(
                          "absolute opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-surface border border-border shadow-sm rounded-lg p-0.5 z-10 top-full mt-1",
                          msg.role === "user" ? "right-2" : "left-2"
                        )}
                      >
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            showToast("Sao chép thành công!", "success");
                            setCopiedMessageId(msg.id);
                            setTimeout(() => setCopiedMessageId(null), 2000);
                          }}
                          className={cn(
                            "p-1 rounded cursor-pointer flex items-center justify-center transition-colors",
                            copiedMessageId === msg.id
                              ? "text-green-500 bg-green-500/10"
                              : "text-text-subtle hover:text-text-main hover:bg-surface-2"
                          )}
                          title={copiedMessageId === msg.id ? "Đã sao chép" : "Sao chép"}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {copiedMessageId === msg.id ? "done" : "content_copy"}
                          </span>
                        </button>
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => handleRegenerateMessage(msg.id)}
                            disabled={isSending}
                            className="p-1 rounded text-text-subtle hover:text-text-main hover:bg-surface-2 cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tạo lại câu trả lời"
                          >
                            <span className="material-symbols-outlined text-[15px]">refresh</span>
                          </button>
                        )}
                        {msg.role === "user" && (
                          <button
                            onClick={() => {
                              setDraft(msg.content);
                              textareaRef.current?.focus();
                            }}
                            className="p-1 rounded text-text-subtle hover:text-text-main hover:bg-surface-2 cursor-pointer flex items-center justify-center"
                            title="Sửa tin nhắn"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {isSending && (!activeSession?.messages?.some(m => m.id === streamingId && m.content.trim())) && (
          <div className="flex gap-4 max-w-3xl mr-auto">
            <AssistantAvatar />
            <TypingDots />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-border bg-surface flex flex-col gap-2">
        {searchStatus && (
          <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 text-brand-600 rounded-[10px] text-xs font-semibold animate-pulse">
            <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            <span>{searchStatus}</span>
          </div>
        )}

        {/* Active Features Status Badges Bar */}
        <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 text-xs">
          {webSearchEnabled && (
            <span
              onClick={() => setWebSearchEnabled(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium text-[11px] cursor-pointer hover:bg-blue-500/20 transition-colors"
              title="BẬT: Tìm kiếm & Thu thập Web (Click để tắt)"
            >
              <span className="material-symbols-outlined text-[14px]">language</span>
              <span>Web Fetch: BẬT</span>
              <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
            </span>
          )}

          {!assistantOnlyMode && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-medium text-[11px] cursor-pointer hover:bg-brand-500/20 transition-colors"
              title="BẬT: Chế độ AI tạo báo cáo tự động (Click chữ để mở xem tiến độ, click [x] để tắt)"
            >
              <span className="material-symbols-outlined text-[14px]">support_agent</span>
              <span onClick={() => { if (agentState) setAgentActive(true); }}>AI tạo báo cáo: BẬT</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setAssistantOnlyMode(true);
                  setAgentActive(false);
                }}
                className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100 p-0.5"
              >
                close
              </span>
            </span>
          )}

          {streamEnabled && (
            <span
              onClick={() => setStreamEnabled(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] cursor-pointer hover:bg-emerald-500/20 transition-colors"
              title="BẬT: Stream Real-time (Click để tắt)"
            >
              <span className="material-symbols-outlined text-[14px]">stream</span>
              <span>Stream: BẬT</span>
              <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
            </span>
          )}

          {(() => {
            const currentThinkingMode = thinkingMode;
            return (
              <span
                onClick={() => {
                  const modes = ["auto", "fast", "thinking"];
                  const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                  setThinkingMode(modes[nextIdx]);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer hover:opacity-80",
                  currentThinkingMode === "thinking"
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                    : currentThinkingMode === "fast"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-surface border-border text-text-muted"
                )}
                title={`Thinking Mode: ${currentThinkingMode.toUpperCase()} (Click để đổi)`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
                </span>
                <span className="capitalize">Thinking: {currentThinkingMode}</span>
              </span>
            );
          })()}

          {selectedKnowledgeSubject !== "none" && (
            <span
              onClick={() => setSelectedKnowledgeSubject("none")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-medium text-[11px] cursor-pointer hover:bg-purple-500/20 transition-colors"
              title={`Chủ đề báo cáo đang chọn: ${selectedKnowledgeSubject} (Click để bỏ chọn)`}
            >
              <span className="material-symbols-outlined text-[14px]">menu_book</span>
              <span className="max-w-[150px] truncate">{selectedKnowledgeSubject}</span>
              <span className="material-symbols-outlined text-[12px] opacity-70 hover:opacity-100">close</span>
            </span>
          )}
        </div>

        {/* Attached Files Bar */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-bg/50 rounded-xl">
            {attachedFiles.map((file) => {
              const isImg = file.type?.startsWith("image/");
              const isUploading = file.status === "uploading";
              const isError = file.status === "error";

              return (
                <div
                  key={file.id}
                  className={cn(
                    "relative flex items-center gap-2 pl-2 pr-1 py-1 rounded-[8px] border text-xs font-medium bg-surface min-w-[120px] max-w-[200px]",
                    isError
                      ? "border-danger/30 bg-danger/5 text-danger"
                      : "border-border"
                  )}
                >
                  {isImg && file.url ? (
                    <img
                      src={file.url}
                      alt={file.name || "Tệp hình ảnh"}
                      className="size-6 rounded-[4px] object-cover flex-shrink-0"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[16px] text-text-muted flex-shrink-0">
                      {isImg ? "image" : "description"}
                    </span>
                  )}

                  <div className="flex-1 min-w-0 leading-tight">
                    <p
                      className="truncate text-[11px] text-text-main"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    {isUploading ? (
                      <p className="text-[9px] text-text-subtle animate-pulse">
                        Uploading...
                      </p>
                    ) : isError ? (
                      <p
                        className="text-[9px] text-danger truncate"
                        title={file.errorMsg}
                      >
                        {file.errorMsg}
                      </p>
                    ) : (
                      <p className="text-[9px] text-text-subtle">
                        {formatBytes(file.size)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => removeAttachedFile(file.id)}
                    className="size-5 rounded-full hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-main transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      close
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-3 bg-bg border border-border rounded-2xl px-4 py-2">
          {/* Main Combined "+" Menu */}
          <div className="relative mb-0.5">
            <button
              type="button"
              onClick={() => setPlusMenuOpen((prev) => !prev)}
              className={cn(
                "size-8 rounded-[8px] flex items-center justify-center transition-all cursor-pointer shrink-0 border border-border/60 hover:bg-surface-2",
                plusMenuOpen ? "bg-surface-2 text-brand-500 border-brand-500/40" : "bg-surface text-text-muted hover:text-text-main"
              )}
              title="Mở menu công cụ hỗ trợ (+)"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform duration-200" style={{ transform: plusMenuOpen ? "rotate(45deg)" : "none" }}>
                add
              </span>
            </button>

            {plusMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPlusMenuOpen(false)} />
                <div className="absolute left-0 bottom-full mb-2 z-40 w-64 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden py-1.5 backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-border/50 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                    Công cụ & Chế độ
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setWebSearchEnabled((prev) => !prev)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                        webSearchEnabled ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-brand-500">language</span>
                        <span>Tìm kiếm & Thu thập Web (fetch-combo)</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-text-main hover:bg-surface-2 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px] text-brand-500">attach_file</span>
                      <span>Đính kèm tài liệu / file</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssistantOnlyMode((prev) => !prev)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                        !assistantOnlyMode ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-brand-500">support_agent</span>
                        <span>AI tạo báo cáo</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                        {!assistantOnlyMode ? "BẬT" : "TẮT"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStreamEnabled((prev) => !prev)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-colors",
                        streamEnabled ? "bg-emerald-500/10 text-emerald-600 font-semibold" : "text-text-main hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500">{streamEnabled ? "stream" : "pause_circle"}</span>
                        <span>Stream Real-time</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle">
                        {streamEnabled ? "BẬT" : "TẮT"}
                      </span>
                    </button>

                    {(() => {
                      const currentThinkingMode = thinkingMode;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            const modes = ["auto", "fast", "thinking"];
                            const nextIdx = (modes.indexOf(thinkingMode) + 1) % modes.length;
                            setThinkingMode(modes[nextIdx]);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-surface-2 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-purple-500">
                              {currentThinkingMode === "thinking" ? "psychology" : currentThinkingMode === "fast" ? "bolt" : "tune"}
                            </span>
                            <span>Thinking Mode</span>
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 capitalize">
                            {currentThinkingMode}
                          </span>
                        </button>
                      );
                    })()}

                    {allSubjects.length > 0 && (
                      <div className="pt-1.5 border-t border-border/50">
                        <div className="px-3 py-1 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                          Chủ đề Báo cáo
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar p-0.5">
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
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                              selectedKnowledgeSubject === "none" ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                            )}
                          >
                            <span className="material-symbols-outlined text-[15px] text-text-subtle">layers_clear</span>
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
                                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                                  active ? "bg-brand-500/10 text-brand-600 font-semibold" : "text-text-main hover:bg-surface-2"
                                )}
                              >
                                <span className="material-symbols-outlined text-[15px] text-brand-500">library_books</span>
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
            className="flex-1 bg-transparent border-0 outline-none text-sm resize-none text-text-main placeholder:text-text-subtle py-1.5 max-h-40 overflow-y-auto"
          />
          {isSending ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-danger border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors mb-0.5"
              title="Dừng phản hồi"
            >
              <span className="material-symbols-outlined text-[18px]">stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!draft.trim() && attachedFiles.length === 0}
              className={cn(
                "flex-shrink-0 size-8 rounded-[8px] flex items-center justify-center transition-all mb-0.5",
                (draft.trim() || attachedFiles.length > 0)
                  ? "bg-brand-500 hover:bg-brand-600 text-white shadow-sm active:scale-95 cursor-pointer"
                  : "bg-surface-2 text-text-muted cursor-not-allowed opacity-50"
              )}
              title="Gửi tin nhắn"
            >
              <span className="material-symbols-outlined text-[18px] rotate-[-30px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
